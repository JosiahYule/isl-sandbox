// =====================================================================
// isl-request — sends the website's "Tell us who you need" form to the right recruiter.
//
// What happens when someone presses Send request on /hire/:
//   1. The page posts the form here as JSON.
//   2. We check it (required fields, a real-looking email, not a bot).
//   3. routing.js picks the recruiter, exactly as the page's "Who'll reply" card did:
//      permanent -> Zowie, contract -> that province's contact, else the office line.
//   4. Resend emails the request to that recruiter, with Reply-To set to the employer,
//      so replying goes straight back to them.
//
// Secrets (set in Supabase > Edge Functions > Secrets, never in this file):
//   RESEND_API_KEY    an API key from resend.com (ISL already uses Resend for email)
//   REQUEST_FROM      the sender, on a domain verified in Resend, e.g.
//                     "Integrated Staffing website <website@integratedstaffing.ca>"
// Optional:
//   REQUEST_CC        comma-separated addresses copied on every request (e.g. info@)
//   REQUEST_FALLBACK  who gets requests routed to an office line (default info@integratedstaffing.ca)
//   ALLOWED_ORIGINS   comma-separated sites allowed to post here
//
// Deploy:  supabase functions deploy isl-request --no-verify-jwt
// Then paste the function's URL into src/data/site.js (forms.requestEndpoint).
// =====================================================================

import { route, placeFrom, provinceName } from "../_shared/routing.js";
import { isLeadId, sanitizeAttribution, attributionRows, pagePath, sanitizeMeasurement } from "../_shared/lead-context.js";

const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = Deno.env.get("REQUEST_FROM") ?? "";
const CC = (Deno.env.get("REQUEST_CC") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const FALLBACK = Deno.env.get("REQUEST_FALLBACK") ?? "info@integratedstaffing.ca";
const ALLOWED = (Deno.env.get("ALLOWED_ORIGINS") ??
  "https://www.integratedstaffing.ca,https://integratedstaffing.ca,https://josiahyule.github.io").split(",").map((s) => s.trim());

const SERVICES: Record<string, string> = { contract: "Contract workers", direct: "A permanent hire", unsure: "Not sure yet" };
const LIMITS = { role: 3000, short: 200 };

function corsHeaders(origin: string | null) {
  const ok = origin && ALLOWED.includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin! : ALLOWED[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Vary": "Origin",
  };
}

// A light brake on repeat sends from one address (resets when the function restarts)
const recent = new Map<string, number[]>();
function tooMany(ip: string) {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < 10 * 60 * 1000);
  hits.push(now);
  recent.set(ip, hits);
  return hits.length > 5;
}

const clean = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

Deno.serve(async (req) => {
  const headers = { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ ok: false, error: "method" }), { status: 405, headers });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ ok: false, error: "json" }), { status: 400, headers }); }

  // Bots fill every field, including the hidden "website" one people never see
  if (!body || typeof body !== 'object' || Array.isArray(body)) return new Response(JSON.stringify({ ok: false, error: 'json' }), { status: 400, headers });
  if (clean(body.website, 10)) return new Response(JSON.stringify({ ok: true, accepted: false }), { headers });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (tooMany(ip)) return new Response(JSON.stringify({ ok: false, error: "rate" }), { status: 429, headers });

  const f = {
    service: SERVICES[clean(body.service, 20)] ? clean(body.service, 20) : "unsure",
    role: clean(body.role, LIMITS.role),
    location: clean(body.location, LIMITS.short),
    name: clean(body.name, LIMITS.short),
    email: clean(body.email, LIMITS.short),
    company: clean(body.company, LIMITS.short),
    phone: clean(body.phone, LIMITS.short),
    page: pagePath(body.page) || '/hire/',
  };
  const leadId = isLeadId(body.lead_id) ? String(body.lead_id) : 'lead_' + crypto.randomUUID();
  const attribution = sanitizeAttribution(body.attribution);
  const measurement = sanitizeMeasurement(body.measurement);
  const missing = ["role", "location", "name", "email"].filter((k) => !f[k as keyof typeof f]);
  if (missing.length || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) {
    return new Response(JSON.stringify({ ok: false, error: "invalid", missing }), { status: 400, headers });
  }

  // Same routing as the page's "Who'll reply" card
  // (contract can't be staffed outside Atlantic Canada, so that request goes to a permanent search)
  const outside = /elsewhere/i.test(f.location);
  const place = outside ? { outside: true, province: "", city: "", rural: false, label: "outside Atlantic Canada" } : placeFrom(f.location);
  const asked = outside && f.service !== "direct" ? "direct" : f.service;
  const r = route({ audience: "employer", service: asked, place });
  const to = r.person?.email || FALLBACK;
  const who = r.person?.name || (r.office ? `${r.office.city} office` : "ISL");

  const rows: [string, string][] = [
    ["Lead reference", leadId],
    ["Needs", SERVICES[f.service]],
    ["Where", f.location],
    ["Name", f.name],
    ["Email", f.email],
    ["Company", f.company || "Not given"],
    ["Phone", f.phone || "Not given"],
    ["Routed to", who],
    ["Sent from", f.page || "/hire/"],
    ...attributionRows(attribution) as [string, string][],
    ...(measurement ? [['Analytics consent', 'Granted'], ['Analytics client ID', measurement.client_id],
      ...(measurement.session_id ? [['Analytics session ID', measurement.session_id]] : [])] as [string, string][] : []),
  ];
  const html = `<p><strong>New request from the website</strong></p>
<p style="white-space:pre-wrap">${esc(f.role)}</p>
<table cellpadding="4" style="border-collapse:collapse;font-size:14px">${rows.map(([k, v]) => `<tr><td style="color:#666">${k}</td><td>${esc(v)}</td></tr>`).join("")}</table>
<p style="color:#666;font-size:13px">Reply to this email to answer ${esc(f.name)} directly. Integrated Staffing replies within one business day.</p>`;
  const text = `New request from the website\n\n${f.role}\n\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}`;

  if (!RESEND_KEY || !FROM) return new Response(JSON.stringify({ ok: false, error: "not_configured" }), { status: 500, headers });
  let res: Response;
  try { res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json", "Idempotency-Key": 'isl-request/' + leadId },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      cc: CC.filter((a) => a !== to),
      reply_to: f.email,
      subject: `${SERVICES[f.service]}: ${f.location}${f.company ? `, ${f.company}` : ""}`,
      html,
      text,
    }),
  }); } catch {
    return new Response(JSON.stringify({ ok: false, error: 'send' }), { status: 502, headers });
  }
  if (!res.ok) return new Response(JSON.stringify({ ok: false, error: "send" }), { status: 502, headers });
  return new Response(JSON.stringify({ ok: true, accepted: true, lead_id: leadId, routedTo: who, province: place?.province ? provinceName(place.province) : null }), { headers });
});
