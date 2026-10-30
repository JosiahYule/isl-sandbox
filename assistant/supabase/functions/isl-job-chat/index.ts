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
//      a contact card, a request summary, a pay or cost card, and quick-reply buttons.
//   If Claude can't be reached (an outage, the monthly spend limit), the visitor gets the
//   offices and their numbers instead of an error.
// Steps 3 to 5 live in _shared/converse.js, which the test harness (assistant/evals/run.mjs) runs too.
//
// On a job page the widget also sends { context: { job: "<job id>" } }, so questions
// like "what are the hours?" are answered from that posting.
//
// Secrets (set in Supabase, never in this file):
//   ANTHROPIC_API_KEY   your Claude API key
//   AVIONTE_FEED_URL    the jsonjobsv3.aspx?...&proc=getalljobs URL
// Optional:
//   ANTHROPIC_MODEL     defaults to claude-haiku-5-5 (fast and cheap)
//   ALLOWED_ORIGINS     comma-separated sites allowed to call this
// =====================================================================

import { normalizeFeed } from "../_shared/jobs.js";
import { converse, fallbackReply, cleanConversation } from "../_shared/converse.js";
import { readJson, rateLimiter, BodyError } from "../_shared/http.js";
import { claudeCaller } from "../_shared/claude.js";

const MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-haiku-5-5";
const API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const FEED_URL = Deno.env.get("AVIONTE_FEED_URL") ?? "";
const ALLOWED = (Deno.env.get("ALLOWED_ORIGINS") ??
  "https://www.integratedstaffing.ca,https://integratedstaffing.ca").split(",").map((s) => s.trim());

// ---- Rate limit: each message costs a Claude call, so one visitor can't run up the bill ----
// 30 messages per 10 minutes per IP address, counted in memory (resets when the function restarts).
const RATE = { max: 30, windowMs: 10 * 60 * 1000 };
const limited = rateLimiter(RATE.max, RATE.windowMs);

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
let loading: Promise<any[]> | null = null;
async function loadJobs() {
  if (cache && Date.now() - cache.at < 10 * 60 * 1000) return cache.jobs;
  // Concurrent visitors share one refresh. Never present an expired cache as live openings.
  if (!loading) loading = (async () => {
    const res = await fetch(FEED_URL, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error("Avionte feed returned " + res.status);
    const jobs = normalizeFeed(await res.json());
    if (!jobs.length) throw new Error('Avionte feed returned no jobs');
    cache = { at: Date.now(), jobs };
    return jobs;
  })().finally(() => { loading = null; });
  return loading;
}

// ---- One call to the Claude API (shared with the tests: _shared/claude.js) ----
const claude = (signal: AbortSignal) => claudeCaller({ apiKey: API_KEY, model: MODEL, signal });

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const headers = { ...corsHeaders(origin), "content-type": "application/json", 'Cache-Control': 'no-store' };
  if (origin && !ALLOWED.includes(origin)) return new Response(JSON.stringify({ error: 'Origin not allowed.' }), { status: 403, headers });
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers });

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  if (limited(ip)) {
    return new Response(JSON.stringify({ error: "That's a lot of messages in a short time. Please wait a few minutes, or call your nearest ISL office." }), { status: 429, headers });
  }

  let body: any;
  try { body = await readJson(req); }
  catch (e) { return new Response(JSON.stringify({ error: e instanceof BodyError ? e.message : 'Invalid JSON.' }), { status: e instanceof BodyError ? e.status : 400, headers }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return new Response(JSON.stringify({ error: 'Send a JSON object.' }), { status: 400, headers });
  // Check the conversation's shape before contacting anyone
  if (!cleanConversation(body.messages)) return new Response(JSON.stringify({ error: "Send messages ending with a user message." }), { status: 400, headers });
  // Not configured yet, or the feed is down: the offices, not an error
  if (!API_KEY || !FEED_URL) return new Response(JSON.stringify(fallbackReply()), { headers });
  let jobs: any[];
  try { jobs = await loadJobs(); }
  catch { console.error('isl-job-chat: job feed unavailable'); return new Response(JSON.stringify(fallbackReply()), { headers }); }

  const out: any = await converse({ messages: body.messages, context: body.context, jobs, callModel: claude(AbortSignal.timeout(30000)) });
  if (out.error) return new Response(JSON.stringify({ error: out.error }), { status: 400, headers });
  if (out.meta?.fallback) console.error('isl-job-chat: model unavailable, sent the offices'); // never log visitor messages or provider bodies
  const { trace, usage, ...visible } = out; // the tool trace and token counts are for tests and logs, not the browser
  return new Response(JSON.stringify(visible), { headers });
});
