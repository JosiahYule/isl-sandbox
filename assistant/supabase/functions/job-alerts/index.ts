// =====================================================================
// job-alerts — sign-ups for job alerts from the chat assistant (Integrated Staffing).
//
// How it works:
//   1. In the chat, a job seeker asks for jobs like the ones it showed, ticks the consent box and
//      gives their email. The window posts the email, the search and the consent wording here.
//   2. We save it as "pending" and email a confirmation link (double opt-in: nobody can sign up
//      someone else, and the consent record shows they confirmed).
//   3. The link (GET ?confirm=<token>) makes it "active".
//   4. Every morning scripts/send-job-alerts.mjs emails each active alert its new matches.
//   5. Every alert email has an unsubscribe link (?unsubscribe=<token>, one button) and the
//      one-click unsubscribe header email apps show. Unsubscribing clears the email and the search.
//
// Secrets (Supabase > Edge Functions > Secrets):
//   RESEND_API_KEY   the same Resend key as isl-request
//   ALERTS_FROM      the sender, on a domain verified in Resend,
//                    e.g. "Integrated Staffing jobs <jobs@integratedstaffing.ca>"
// Supabase provides SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to every function.
// Optional: SITE_URL (default https://www.integratedstaffing.ca), ALLOWED_ORIGINS.
//
// Deploy:  supabase functions deploy job-alerts --no-verify-jwt
// Then put the function's URL in forms.alertsEndpoint (src/brands/isl.js) or PUBLIC_ISL_ALERTS_ENDPOINT.
// Needs the tables in assistant/supabase/migrations/.
// =====================================================================

import { restClient } from "../_shared/db.js";
import { readJson, rateLimiter, BodyError } from "../_shared/http.js";
import { alertPage, confirmEmail, searchKey } from "../_shared/alerts.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const rest = restClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = Deno.env.get("ALERTS_FROM") ?? "";
const SITE = Deno.env.get("SITE_URL") ?? "https://www.integratedstaffing.ca";
const SELF = `${SUPABASE_URL.replace(/\/+$/, "")}/functions/v1/job-alerts`;
const ALLOWED = (Deno.env.get("ALLOWED_ORIGINS") ??
  "https://www.integratedstaffing.ca,https://integratedstaffing.ca,https://josiahyule.github.io").split(",").map((s) => s.trim());
const MAX_PER_EMAIL = 5;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const tooMany = rateLimiter(5, 60 * 60 * 1000);
const clean = (v: unknown, max: number) => (typeof v === "string" ? v : "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

async function sendEmail(msg: Record<string, unknown>) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, ...msg }),
  });
  if (!res.ok) throw new Error("send");
}
async function sendConfirmation(row: { email: string; token: string; label: string; lang: string }) {
  const m = confirmEmail({ label: row.label, lang: row.lang, confirmUrl: `${SELF}?confirm=${row.token}`, site: SITE });
  await sendEmail({ to: [row.email], subject: m.subject, html: m.html, text: m.text });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const origin = req.headers.get("origin");
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: {
    "Access-Control-Allow-Origin": origin && ALLOWED.includes(origin) ? origin : ALLOWED[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type", "Vary": "Origin",
    "Content-Type": "application/json", "Cache-Control": "no-store" } });
  const page = (kind: string, lang: string, token = "", status = 200) => new Response(alertPage(kind, { lang, site: SITE, action: token ? `${SELF}?unsubscribe=${token}` : "" }), {
    status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  if (!rest) return json({ ok: false, error: "not_configured" }, 500);

  // ---- Links from the emails ----
  const confirm = url.searchParams.get("confirm");
  const unsubscribe = url.searchParams.get("unsubscribe");
  if (confirm) {
    if (!UUID.test(confirm)) return page("expired", "en", "", 404);
    const rows = await rest(`job_alerts?token=eq.${confirm}&status=eq.pending`, { method: "PATCH", body: { status: "active", confirmed_at: new Date().toISOString() }, prefer: "return=representation" }).catch(() => null);
    if (rows?.length) return page("confirmed", rows[0].lang);
    const now = await rest(`job_alerts?token=eq.${confirm}&select=status,lang`).catch(() => null);
    return now?.[0]?.status === "active" ? page("confirmed", now[0].lang) : page("expired", now?.[0]?.lang || "en", "", 404);
  }
  if (unsubscribe) {
    if (!UUID.test(unsubscribe)) return page("expired", "en", "", 404);
    const found = await rest(`job_alerts?token=eq.${unsubscribe}&select=status,lang`).catch(() => null);
    const lang = found?.[0]?.lang || "en";
    if (!found?.length || found[0].status === "unsubscribed") return page("unsubscribed", lang);
    // A plain visit shows one button: link scanners in mail systems open links, and shouldn't unsubscribe anyone.
    // The button, and the email apps' one-click unsubscribe, POST here.
    if (req.method !== "POST") return page("unsubscribe", lang, unsubscribe);
    await rest(`job_alerts?token=eq.${unsubscribe}`, { method: "PATCH", body: { status: "unsubscribed", unsubscribed_at: new Date().toISOString(), email: null, search: null, search_key: null, label: null, sent_ids: [] }, prefer: "return=minimal" });
    return page("unsubscribed", lang);
  }

  // ---- A sign-up from the chat ----
  if (origin && !ALLOWED.includes(origin)) return json({ ok: false, error: "origin" }, 403);
  if (req.method === "OPTIONS") return json(null);
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  if (!RESEND_KEY || !FROM) return json({ ok: false, error: "not_configured" }, 500);

  let body: Record<string, unknown>;
  try { body = await readJson(req, 8192); } catch (e) { return json({ ok: false, error: e instanceof BodyError ? e.message : "json" }, e instanceof BodyError ? e.status : 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ ok: false, error: "json" }, 400);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (tooMany(ip)) return json({ ok: false, error: "rate" }, 429);

  const email = clean(body.email, 200).toLowerCase();
  const consentText = clean(body.consentText, 400);
  const search = body.search && typeof body.search === "object" && !Array.isArray(body.search) ? body.search : null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || body.consent !== true || !consentText || !search || JSON.stringify(search).length > 4000) {
    return json({ ok: false, error: "invalid" }, 400);
  }
  const row = {
    brand: "isl",
    lang: body.lang === "fr" ? "fr" : "en",
    email,
    search,
    search_key: await searchKey(search),
    label: clean(body.label, 200),
    consent_text: consentText,
    consent_at: new Date().toISOString(),
  };

  const mine = await rest(`job_alerts?email=eq.${encodeURIComponent(email)}&status=neq.unsubscribed&select=token,status,search_key,label,lang`);
  const same = mine.find((r: { search_key: string }) => r.search_key === row.search_key);
  if (same?.status === "active") return json({ ok: true, already: true });
  try {
    if (same) await sendConfirmation({ email, token: same.token, label: same.label, lang: same.lang }); // asked again before confirming: send the link again
    else {
      if (mine.length >= MAX_PER_EMAIL) return json({ ok: false, error: "limit" }, 400);
      const [saved] = await rest("job_alerts", { method: "POST", body: row, prefer: "return=representation" });
      await sendConfirmation({ email, token: saved.token, label: row.label, lang: row.lang });
    }
  } catch {
    return json({ ok: false, error: "send" }, 502);
  }
  return json({ ok: true });
});
