// =====================================================================
// specialist-request — sends the Accountant Staffing and Administrative Staffing "Request talent"
// forms to the office that covers the work. (ISL's form has its own function, isl-request, which
// routes to a named recruiter.)
//
// What happens when someone presses Send request on accountantstaffing.ca/hire/ or administrativestaffing.ca/hire/:
//   1. The page posts the form here as JSON.
//   2. We check it (required fields, a real-looking email, not a bot).
//   3. The brand comes from the site it was sent from, and the office from the province, as the
//      page's "Who'll reply" card showed: Nova Scotia and PEI -> Halifax, New Brunswick -> Moncton,
//      Newfoundland and Labrador -> St. John's, anywhere else -> Halifax (head office).
//   4. Resend emails it to that office's address, with Reply-To set to the employer.
//
// Secrets (Supabase > Edge Functions > Secrets, never in this file):
//   RESEND_API_KEY    the same Resend key isl-request uses
//   REQUEST_FROM_AS   the sender for Accountant Staffing, on a domain verified in Resend,
//                     e.g. "Accountant Staffing website <website@accountantstaffing.ca>"
//   REQUEST_FROM_ADS  the same for Administrative Staffing
//   REQUEST_TO        who gets each office's requests, as JSON:
//                     {"as":{"halifax":"…","moncton":"…","st-johns":"…"},"ads":{"halifax":"…","moncton":"…","st-johns":"…"}}
// Optional:
//   REQUEST_FALLBACK  where a request goes if its office has no address in REQUEST_TO
//   REQUEST_CC        comma-separated addresses copied on every request
//   ALLOWED_ORIGINS   comma-separated sites allowed to post here
//
// Deploy:  supabase functions deploy specialist-request --no-verify-jwt
// Then set the function's URL as AS_REQUEST_ENDPOINT and ADS_REQUEST_ENDPOINT (GitHub > Settings >
// Secrets and variables > Actions > Variables) and rebuild.
// =====================================================================

import { isLeadId, sanitizeAttribution, attributionRows, pagePath, sanitizeMeasurement } from "../_shared/lead-context.js";
import { readJson, rateLimiter, BodyError } from "../_shared/http.js";

const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM: Record<string, string> = { as: Deno.env.get("REQUEST_FROM_AS") ?? "", ads: Deno.env.get("REQUEST_FROM_ADS") ?? "" };
const CC = (Deno.env.get("REQUEST_CC") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const FALLBACK = Deno.env.get("REQUEST_FALLBACK") ?? "";
let TO: Record<string, Record<string, string>> = {};
try { TO = JSON.parse(Deno.env.get("REQUEST_TO") ?? "{}"); } catch { TO = {}; }

// Which brand a site belongs to. The sandbox preview hosts both, so there the page says which.
const SITES: Record<string, string> = {
  "https://www.accountantstaffing.ca": "as", "https://accountantstaffing.ca": "as",
  "https://www.administrativestaffing.ca": "ads", "https://administrativestaffing.ca": "ads",
};
const SANDBOX = "https://josiahyule.github.io";
const ALLOWED = (Deno.env.get("ALLOWED_ORIGINS") ?? [...Object.keys(SITES), SANDBOX].join(",")).split(",").map((s) => s.trim());

const BRANDS: Record<string, { name: string; services: Record<string, string> }> = {
  as: { name: "Accountant Staffing", services: { contract: "A temporary contractor", direct: "A permanent hire", unsure: "Not sure yet" } },
  ads: { name: "Administrative Staffing", services: { contract: "A temporary contractor", direct: "A permanent hire", unsure: "Not sure yet" } },
};
// The offices each brand has, and which one covers each province (src/brands/specialist.js)
const OFFICES: Record<string, string> = { halifax: "Halifax", moncton: "Moncton", "st-johns": "St. John's" };
const PROVINCE_OFFICE: Record<string, string> = {
  "Nova Scotia": "halifax", "Prince Edward Island": "halifax", "New Brunswick": "moncton", "Newfoundland and Labrador": "st-johns",
};
const LIMITS = { role: 3000, short: 200 };

function corsHeaders(origin: string | null) {
  const ok = origin && ALLOWED.includes(origin);
  return { "Access-Control-Allow-Origin": ok ? origin! : ALLOWED[0], "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type", "Vary": "Origin" };
}
const tooMany = rateLimiter(5, 10 * 60 * 1000);
const clean = (v: unknown, max: number) => (typeof v === "string" ? v : "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = { ...corsHeaders(origin), "Content-Type": "application/json", "Cache-Control": "no-store" };
  if (origin && !ALLOWED.includes(origin)) return new Response(JSON.stringify({ ok: false, error: "origin" }), { status: 403, headers });
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ ok: false, error: "method" }), { status: 405, headers });

  let body: Record<string, unknown>;
  try { body = await readJson(req, 16384); } catch (e) { return new Response(JSON.stringify({ ok: false, error: e instanceof BodyError ? e.message : "json" }), { status: e instanceof BodyError ? e.status : 400, headers }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return new Response(JSON.stringify({ ok: false, error: "json" }), { status: 400, headers });
  if (clean(body.website, 10)) return new Response(JSON.stringify({ ok: true, accepted: false }), { headers }); // the hidden field only bots fill in
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (tooMany(ip)) return new Response(JSON.stringify({ ok: false, error: "rate" }), { status: 429, headers });

  // The brand: from the live site, or (sandbox only) from the page
  const brandKey = (origin && SITES[origin]) || (origin === SANDBOX || !origin ? clean(body.brand, 5) : "");
  const brand = BRANDS[brandKey];
  if (!brand) return new Response(JSON.stringify({ ok: false, error: "brand" }), { status: 400, headers });

  const f = {
    service: brand.services[clean(body.service, 20)] ? clean(body.service, 20) : "unsure",
    role: clean(body.role, LIMITS.role),
    location: clean(body.location, LIMITS.short),
    name: clean(body.name, LIMITS.short),
    email: clean(body.email, LIMITS.short),
    company: clean(body.company, LIMITS.short),
    phone: clean(body.phone, LIMITS.short),
    page: pagePath(body.page) || "/hire/",
  };
  const leadId = isLeadId(body.lead_id) ? String(body.lead_id) : "lead_" + crypto.randomUUID();
  const attribution = sanitizeAttribution(body.attribution);
  const measurement = sanitizeMeasurement(body.measurement);
  const missing = ["role", "location", "name", "email"].filter((k) => !f[k as keyof typeof f]);
  if (missing.length || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) {
    return new Response(JSON.stringify({ ok: false, error: "invalid", missing }), { status: 400, headers });
  }

  // The office that covers the province; anywhere outside Atlantic Canada goes to Halifax
  const officeKey = PROVINCE_OFFICE[f.location] ?? "halifax";
  const office = OFFICES[officeKey];
  const to = TO[brandKey]?.[officeKey] || FALLBACK;
  if (!RESEND_KEY || !FROM[brandKey] || !to) return new Response(JSON.stringify({ ok: false, error: "not_configured" }), { status: 500, headers });

  const rows: [string, string][] = [
    ["Lead reference", leadId],
    ["Needs", brand.services[f.service]],
    ["Where", f.location],
    ["Name", f.name],
    ["Email", f.email],
    ["Company", f.company || "Not given"],
    ["Phone", f.phone || "Not given"],
    ["Routed to", `${office} office`],
    ["Sent from", f.page],
    ...attributionRows(attribution) as [string, string][],
    ...(measurement ? [["Analytics consent", "Granted"], ["Analytics client ID", measurement.client_id],
      ...(measurement.session_id ? [["Analytics session ID", measurement.session_id]] : [])] as [string, string][] : []),
  ];
  const html = `<p><strong>New request from the ${esc(brand.name)} website</strong></p>
<p style="white-space:pre-wrap">${esc(f.role)}</p>
<table cellpadding="4" style="border-collapse:collapse;font-size:14px">${rows.map(([k, v]) => `<tr><td style="color:#666">${k}</td><td>${esc(v)}</td></tr>`).join("")}</table>
<p style="color:#666;font-size:13px">Reply to this email to answer ${esc(f.name)} directly.</p>`;
  const text = `New request from the ${brand.name} website\n\n${f.role}\n\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}`;

  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json", "Idempotency-Key": "specialist-request/" + leadId },
      body: JSON.stringify({
        from: FROM[brandKey], to: [to], cc: CC.filter((a) => a !== to), reply_to: f.email,
        subject: `${brand.name}: ${brand.services[f.service]}, ${f.location}${f.company ? `, ${f.company}` : ""}`,
        html, text,
      }),
    });
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "send" }), { status: 502, headers });
  }
  if (!res.ok) return new Response(JSON.stringify({ ok: false, error: "send" }), { status: 502, headers });
  const receipt = await res.json().catch(() => null);
  if (!receipt || typeof receipt.id !== "string" || !receipt.id) return new Response(JSON.stringify({ ok: false, error: "send" }), { status: 502, headers });
  return new Response(JSON.stringify({ ok: true, accepted: true, lead_id: leadId, routedTo: `Our ${office} office` }), { headers });
});
