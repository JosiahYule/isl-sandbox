// =====================================================================
// isl-job-chat — the backend for the website chat bubble.
//
// One request = one message from the visitor (a job seeker or an employer). What happens:
//   1. The chat bubble sends the whole conversation so far.
//   2. We load ISL's live jobs (cached for 10 minutes so we don't hammer Avionte).
//   3. We send the conversation to Claude along with the tool list.
//   4. If Claude asks to use a tool, we run it here and send the result back.
//      This repeats until Claude writes a normal reply (usually 2 or 3 rounds).
//   5. We send back the reply text, plus anything the tools produced: job cards,
//      a contact card, a request summary, and quick-reply buttons.
//
// Secrets (set in Supabase, never in this file):
//   ANTHROPIC_API_KEY   your Claude API key
//   AVIONTE_FEED_URL    the jsonjobsv3.aspx?...&proc=getalljobs URL
// Optional:
//   ANTHROPIC_MODEL     defaults to claude-haiku-5-5 (fast and cheap)
//   ALLOWED_ORIGINS     comma-separated sites allowed to call this
// =====================================================================

import { normalizeFeed } from "../_shared/jobs.js";
import { systemPrompt, TOOLS, runTool } from "../_shared/assistant.js";

const MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-haiku-5-5";
const API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const FEED_URL = Deno.env.get("AVIONTE_FEED_URL") ?? "";
const ALLOWED = (Deno.env.get("ALLOWED_ORIGINS") ??
  "https://www.integratedstaffing.ca,https://integratedstaffing.ca").split(",").map((s) => s.trim());

const MAX_TURNS_KEPT = 16;     // older messages are dropped to keep calls fast
const MAX_MESSAGE_CHARS = 2000; // one visitor message
const MAX_TOOL_ROUNDS = 5;      // safety stop for the tool loop

// ---- CORS: the browser rule that decides which websites may call us ----
function corsHeaders(origin: string | null) {
  const ok = origin && ALLOWED.includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin! : ALLOWED[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
    "Vary": "Origin",
  };
}

// ---- Job cache: lives in memory while this function instance is warm ----
let cache: { at: number; jobs: any[] } | null = null;
async function loadJobs() {
  if (cache && Date.now() - cache.at < 10 * 60 * 1000) return cache.jobs;
  const res = await fetch(FEED_URL);
  if (!res.ok) throw new Error("Avionte feed returned " + res.status);
  const jobs = normalizeFeed(await res.json());
  cache = { at: Date.now(), jobs };
  return jobs;
}

// ---- One call to the Claude API ----
async function callClaude(messages: any[], pageMode: string | null) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt(undefined, pageMode),
      tools: TOOLS,
      messages,
    }),
  });
  if (!res.ok) throw new Error("Claude API " + res.status + ": " + (await res.text()).slice(0, 300));
  return await res.json();
}

// Only accept what we expect: a list of {role, content} with short text.
function cleanConversation(input: unknown) {
  if (!Array.isArray(input)) return null;
  const turns = input
    .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m: any) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }))
    .slice(-MAX_TURNS_KEPT);
  while (turns.length && turns[0].role !== "user") turns.shift(); // must start with the visitor
  if (!turns.length || turns[turns.length - 1].role !== "user") return null; // must end with the visitor
  return turns;
}

Deno.serve(async (req) => {
  const headers = { ...corsHeaders(req.headers.get("origin")), "content-type": "application/json" };
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers });

  try {
    const body = await req.json().catch(() => ({}));
    const conversation = cleanConversation(body.messages);
    if (!conversation) return new Response(JSON.stringify({ error: "Send messages ending with a user message." }), { status: 400, headers });

    // The widget sends its greeting first, with the page's mode (employer / seeker) in its memo.
    const first = Array.isArray(body.messages) ? body.messages[0] : null;
    const pageMode = first?.role === "assistant" && ["employer", "seeker"].includes(first?.meta?.mode) ? first.meta.mode : null;

    const jobs = await loadJobs();
    const state: { cards?: any[]; contact?: any; summary?: any[]; choices?: string[] } = {};
    const messages: any[] = [...conversation];
    let reply = "";

    // The tool loop. Each pass is one round-trip to Claude.
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const result = await callClaude(messages, pageMode);
      const text = result.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();

      if (result.stop_reason !== "tool_use") { reply = text; break; }

      // Claude asked for one or more tools. Run each and hand back the results.
      messages.push({ role: "assistant", content: result.content });
      const toolResults = result.content
        .filter((b: any) => b.type === "tool_use")
        .map((b: any) => {
          try {
            return { type: "tool_result", tool_use_id: b.id, content: JSON.stringify(runTool(b.name, b.input, jobs, state)) };
          } catch (e) {
            return { type: "tool_result", tool_use_id: b.id, content: "Error: " + (e as Error).message, is_error: true };
          }
        });
      messages.push({ role: "user", content: toolResults });
      if (round === MAX_TOOL_ROUNDS) reply = text || "Sorry, I got stuck there. Could you rephrase that?";
    }

    return new Response(JSON.stringify({
      reply,
      jobs: state.cards ?? [],
      contact: state.contact ?? null,
      summary: state.summary ?? null,
      choices: state.choices ?? [],
      meta: { mode: state.contact && state.summary ? "employer" : state.cards ? "seeker" : pageMode },
    }), { headers });
  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ error: "The job assistant is having trouble right now. You can still browse all openings on the Find Work page." }),
      { status: 500, headers },
    );
  }
});
