// =====================================================================
// chat-miss — saves a message the chat assistant couldn't understand.
//
// The chat runs on rules, and rules only get better when someone sees what they missed.
// When the chat answers "I'm not sure I follow" (or can't find a kind of work it has no
// word for), the window sends that one message here. Contact details are stripped
// (redact.js) before anything is saved; nothing else from the conversation is sent.
//
// Review the list with:  node scripts/chat-misses.mjs   (needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)
//
// Secrets: none of its own. Supabase gives every function SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
// Optional: ALLOWED_ORIGINS, comma-separated sites allowed to post here.
//
// Deploy:  supabase functions deploy chat-miss --no-verify-jwt
// Then put the function's URL in forms.chatMissEndpoint (src/brands/isl.js and src/brands/specialist.js),
// or set PUBLIC_CHAT_MISS_ENDPOINT for the build.
// Needs the tables in assistant/supabase/migrations/.
// =====================================================================

import { redact } from "../_shared/redact.js";
import { restClient } from "../_shared/db.js";
import { readJson, rateLimiter, BodyError } from "../_shared/http.js";
import { pagePath } from "../_shared/lead-context.js";

const rest = restClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
const ALLOWED = (Deno.env.get("ALLOWED_ORIGINS") ??
  "https://www.integratedstaffing.ca,https://integratedstaffing.ca,https://www.accountantstaffing.ca,https://accountantstaffing.ca,https://www.administrativestaffing.ca,https://administrativestaffing.ca,https://josiahyule.github.io")
  .split(",").map((s) => s.trim());

const tooMany = rateLimiter(20, 10 * 60 * 1000); // a busy visitor misses a few times; a script misses hundreds

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = {
    "Access-Control-Allow-Origin": origin && ALLOWED.includes(origin) ? origin : ALLOWED[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Vary": "Origin",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (origin && !ALLOWED.includes(origin)) return reply({ ok: false, error: "origin" }, 403);
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return reply({ ok: false, error: "method" }, 405);
  if (!rest) return reply({ ok: false, error: "not_configured" }, 500);

  let body: Record<string, unknown>;
  try { body = await readJson(req, 4096); } catch (e) { return reply({ ok: false, error: e instanceof BodyError ? e.message : "json" }, e instanceof BodyError ? e.status : 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return reply({ ok: false, error: "json" }, 400);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (tooMany(ip)) return reply({ ok: false, error: "rate" }, 429);

  const text = redact(body.text);
  if (!text) return reply({ ok: false, error: "invalid" }, 400);
  const row = {
    brand: ["isl", "as", "ads"].includes(String(body.brand)) ? String(body.brand) : "isl",
    lang: body.lang === "fr" ? "fr" : "en",
    kind: body.kind === "no-match" ? "no-match" : "unclear",
    text,
    page: pagePath(body.page) || null,
  };
  try { await rest("chat_misses", { method: "POST", body: row, prefer: "return=minimal" }); }
  catch { return reply({ ok: false, error: "save" }, 502); }
  return reply({ ok: true });
});
