// =====================================================================
// converse.js: one turn of the AI chat, without the web server around it.
//
// The Supabase function (isl-job-chat/index.ts) calls this for each visitor message, and so does
// the test harness (assistant/evals/run.mjs), so the AI is tested exactly as it runs on the site.
//
// What one turn does:
//   1. Tidies the conversation the window sent, and tells the model what was on screen with each
//      earlier reply (which job cards, which request summary), so "the first one" or "make that 5"
//      can be resolved against what the visitor actually saw.
//   2. Sends it to the model with the tools. While the model asks for tools, runs them and sends
//      the results back (at most MAX_TOOL_ROUNDS times).
//   3. Returns the reply plus whatever the tools produced (cards, contact, summary...).
//   4. If the model can't be reached (an outage, the monthly spend limit, a timeout), answers
//      without it: the offices and how to reach them, so nobody is stuck.
//
// callModel is passed in, so the caller decides how to reach the model (the function uses the
// Claude API; tests pass a fake).
// =====================================================================

import { systemPrompt, TOOLS, runTool } from "./assistant.js";
import { OFFICES } from "./routing.js";

export const MAX_TURNS_KEPT = 16;      // older messages are dropped to keep calls fast and cheap
export const MAX_MESSAGE_CHARS = 2000; // one visitor message
export const MAX_TOOL_ROUNDS = 5;      // safety stop for the tool loop

const FRENCH = /\b(je|j'|vous|bonjour|merci|emplois?|travail|cherche|besoin|quel|quelle|où|est-ce|embauche|salaire|bureau|pour|avec)\b/i;

// What the window shows when the AI can't answer: every office with its number, in the visitor's language
export function fallbackReply(lang = "en") {
  const offices = Object.values(OFFICES).map((o) => ({ city: o.city === "Halifax" ? "Halifax (Dartmouth)" : o.city, phone: o.phone, address: o.address }));
  return {
    reply: lang === "fr"
      ? "Je ne peux pas répondre pour le moment. Nos bureaux peuvent vous aider tout de suite, et toutes nos offres sont sur la page Trouver un emploi."
      : "I can't answer right now. Our offices can help straight away, and every opening is on the Find Work page.",
    offices,
    jobs: [], contact: null, summary: null, insight: null,
    choices: [],
    meta: { fallback: true, lang },
  };
}

// The conversation as the model should see it. The window sends [{role, content, meta}], greeting first.
// For each earlier reply, a short note says what was on screen with it. Only job ids that exist in the
// feed are kept, and their titles come from the feed, so a tampered request can't plant text here.
export function cleanConversation(input, jobs = []) {
  if (!Array.isArray(input)) return null;
  const byId = new Map(jobs.map((j) => [j.id, j]));
  const turns = input
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m) => {
      let content = m.content.slice(0, MAX_MESSAGE_CHARS);
      if (m.role === "assistant") {
        const shown = (Array.isArray(m.meta?.shown) ? m.meta.shown : []).map(String).filter((id) => byId.has(id)).slice(0, 6);
        const notes = [];
        if (shown.length) notes.push("job cards shown, in order: " + shown.map((id, i) => `${i + 1}. ${byId.get(id).title} (job_id ${id})`).join("; "));
        const summary = Array.isArray(m.meta?.summary) ? m.meta.summary.filter((r) => Array.isArray(r) && r.length === 2).slice(0, 8) : [];
        if (summary.length) notes.push("request summary shown: " + summary.map(([k, v]) => `${String(k).slice(0, 20)}: ${String(v).slice(0, 120)}`).join("; "));
        if (notes.length) content += `\n[On screen with this reply: ${notes.join(". ")}]`;
      }
      return { role: m.role, content };
    })
    .slice(-MAX_TURNS_KEPT);
  while (turns.length && turns[0].role !== "user") turns.shift(); // must start with the visitor
  if (!turns.length || turns[turns.length - 1].role !== "user") return null; // must end with the visitor
  return turns;
}

// One visitor message in, one reply out
export async function converse({ messages, context = {}, jobs, callModel, today }) {
  const lastUser = [...(messages || [])].reverse().find((m) => m?.role === "user")?.content || "";
  const lang = FRENCH.test(String(lastUser)) ? "fr" : "en";
  const conversation = cleanConversation(messages, jobs);
  if (!conversation) return { error: "Send messages ending with a user message." };

  // The window sends its greeting first, with the page's mode (employer / seeker) in its memo
  const first = Array.isArray(messages) ? messages[0] : null;
  const pageMode = first?.role === "assistant" && ["employer", "seeker"].includes(first?.meta?.mode) ? first.meta.mode : null;
  const jobId = typeof context?.job === "string" ? context.job.slice(0, 40) : "";
  const job = jobId ? jobs.find((j) => j.id === jobId) || null : null;

  const state = {};
  const trace = [];
  const usage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, calls: 0 };
  const turn = [...conversation];
  let reply = "";
  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const result = await callModel({ system: systemPrompt(today, pageMode, job), tools: TOOLS, messages: turn });
      usage.calls++;
      for (const k of Object.keys(usage)) if (k !== "calls" && Number.isFinite(result?.usage?.[k])) usage[k] += result.usage[k];
      if (!Array.isArray(result?.content)) throw new Error("Invalid model response");
      const text = result.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      if (result.stop_reason !== "tool_use") { reply = text; break; }
      turn.push({ role: "assistant", content: result.content });
      const toolResults = result.content.filter((b) => b.type === "tool_use").map((b) => {
        trace.push({ tool: b.name, input: b.input });
        try {
          return { type: "tool_result", tool_use_id: b.id, content: JSON.stringify(runTool(b.name, b.input, jobs, state)) };
        } catch (e) {
          return { type: "tool_result", tool_use_id: b.id, content: "Error: " + e.message, is_error: true };
        }
      });
      turn.push({ role: "user", content: toolResults });
      if (round === MAX_TOOL_ROUNDS - 1) reply = text || (lang === "fr" ? "Désolé, je n’ai pas réussi. Pouvez-vous reformuler?" : "Sorry, I got stuck there. Could you say that another way?");
    }
  } catch {
    // No model, no reply: the offices instead, never an empty error
    return { ...fallbackReply(lang), trace, usage };
  }

  return {
    reply: reply || (lang === "fr" ? "Pouvez-vous reformuler, ou joindre votre bureau le plus proche?" : "Could you say that another way, or contact your nearest office?"),
    jobs: state.cards ?? [],
    contact: state.contact ?? null,
    summary: state.summary ?? null,
    insight: state.insight ?? null,
    offices: null,
    choices: state.choices ?? [],
    meta: { mode: state.contact && state.summary ? "employer" : state.cards ? "seeker" : pageMode, lang },
    trace,
    usage,
  };
}
