// =====================================================================
// jobs.js — turns the raw Avionte feed into clean jobs, and searches them.
//
// This file has NO AI in it. It's ordinary code that the AI is allowed
// to call (that's what "tool calling" means). The AI decides WHAT to
// search for; this file decides WHICH jobs actually match. That split is
// what keeps the bot honest: it can only recommend jobs this code returns.
//
// The same file runs in three places without changes:
//   - the Supabase edge function (the real backend)
//   - Node, for the test script
//   - the browser, inside the demo page
// =====================================================================

// ---- Site settings. Check these match the live site. ----------------
export const SITE = {
  base: "https://www.integratedstaffing.ca",
  // {PostId} and {PostId20} get swapped for each job's real values.
  applyPath: "/careers/apply?rpid={PostId}&postid={PostId20}&webapp=1",
  detailPath: "/find-work/job?id={ReqID}",
  generalApplyPath: "/careers/general-apply",
};

const PROVINCES = {
  NS: ["ns", "nova scotia"],
  NB: ["nb", "new brunswick"],
  PE: ["pe", "pei", "prince edward island"],
  NL: ["nl", "newfoundland", "labrador", "newfoundland and labrador"],
  ON: ["on", "ontario"],
  QC: ["qc", "quebec", "québec"],
  MB: ["mb", "manitoba"],
  SK: ["sk", "saskatchewan"],
  AB: ["ab", "alberta"],
  BC: ["bc", "british columbia"],
};

// Places people say that cover more than one town in the feed.
const AREAS = {
  halifax: ["halifax", "dartmouth", "bedford", "sackville", "lower sackville", "burnside", "hammonds plains", "cole harbour", "timberlea", "fall river", "enfield", "windsor junction"],
  hrm: ["halifax", "dartmouth", "bedford", "sackville", "lower sackville", "burnside", "hammonds plains", "cole harbour", "timberlea", "fall river", "enfield"],
  "st. john's": ["st. john's", "st johns", "mount pearl", "paradise", "conception bay south", "cbs", "torbay", "portugal cove"],
  moncton: ["moncton", "dieppe", "riverview", "shediac"],
  "saint john": ["saint john", "quispamsis", "rothesay", "grand bay-westfield"],
  charlottetown: ["charlottetown", "stratford", "cornwall"],
};

// ---- Cleaning helpers -------------------------------------------------

// Job descriptions arrive as HTML. The AI only needs the words.
export function stripHtml(html) {
  return String(html || "")
    .replace(/<(br|\/p|\/li|\/div|\/h\d)[^>]*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&rsquo;|&lsquo;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&ndash;|&mdash;/gi, "-")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function titleCase(s) {
  return String(s || "").toLowerCase().replace(/(^|[\s\-'])([a-z])/g, (m, p, c) => p + c.toUpperCase())
    .replace(/'S\b/g, "'s");
}

function num(v) {
  const n = parseFloat(String(v ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

// Avionte gives PayActual, or a PayMin/PayMax range. Over $1,000 = yearly.
export function formatPay(raw) {
  const fmt = (n) => (n >= 1000 ? "$" + Math.round(n).toLocaleString("en-CA") : "$" + n.toFixed(2).replace(/\.00$/, ""));
  const unit = (n) => (n >= 1000 ? "/year" : "/hour");
  const actual = num(raw.PayActual), min = num(raw.PayMin), max = num(raw.PayMax);
  // A real range beats a single number (some postings fill both).
  if (min > 0 && max > 0 && max !== min) return fmt(min) + " to " + fmt(max) + unit(max);
  if (actual > 0) return fmt(actual) + unit(actual);
  if (min > 0 || max > 0) return fmt(min || max) + unit(min || max);
  return "";
}

// "Temp", "Contract", "Direct Hire", "Contract to Hire"... -> 3 plain buckets.
export function employmentKind(jobType) {
  const t = String(jobType || "").toLowerCase();
  if (/to[ -]?(hire|perm)/.test(t)) return "Temp to perm";
  if (/direct|perm|full[ -]?time/.test(t)) return "Permanent";
  return "Temporary / contract";
}

function parseDate(s) {
  // Avionte format: "10/5/2026 1:54:57 PM"
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function fillPath(path, raw) {
  return path.replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(raw[k] ?? ""));
}

// One raw feed entry -> one clean job object.
export function normalizeJob(raw) {
  const description = stripHtml(raw.JobDesc_HTML || raw.JobDesc || raw.Description || "");
  const firstLine = description.split("\n")[0] || "";
  // Some postings leave Name blank but start the description with the title.
  const fallbackTitle = firstLine.replace(/^job (opportunity|posting|title)\s*:\s*/i, "").slice(0, 80);
  const [category, subcategory] = String(raw.Category || "").split(":").map((s) => s.trim());
  const posted = parseDate(raw.PostDate);
  return {
    id: String(raw.ReqID || raw.PostId || ""),
    title: (raw.Name || fallbackTitle || "Open position").trim(),
    employment: employmentKind(raw.JobType),
    jobType: raw.JobType || "",
    city: titleCase(raw.JobCity || ""),
    province: String(raw.JobState || "").toUpperCase(),
    category: category || "",
    subcategory: subcategory || "",
    office: raw.Office || "",
    pay: formatPay(raw),
    posted: posted ? posted.toISOString().slice(0, 10) : "",
    description,
    viewUrl: SITE.base + fillPath(SITE.detailPath, raw),
    applyUrl: SITE.base + fillPath(SITE.applyPath, raw),
  };
}

// The feed is either an array, or an object holding an array somewhere.
export function extractRawJobs(feed) {
  if (Array.isArray(feed)) return feed;
  if (feed && typeof feed === "object") {
    for (const v of Object.values(feed)) {
      if (Array.isArray(v) && v.length && typeof v[0] === "object") return v;
    }
  }
  return [];
}

export function normalizeFeed(feed) {
  return extractRawJobs(feed).map(normalizeJob).filter((j) => j.id);
}

// ---- Searching -------------------------------------------------------

function provinceCode(input) {
  const s = String(input || "").trim().toLowerCase();
  if (!s) return "";
  for (const [code, names] of Object.entries(PROVINCES)) if (names.includes(s)) return code;
  return s.toUpperCase().slice(0, 2);
}

function placesFor(city) {
  const c = String(city || "").trim().toLowerCase();
  if (!c) return [];
  return AREAS[c] || AREAS[c.replace(/^st\.? /, "st. ")] || [c];
}

function norm(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ");
}

// A tiny stemmer: chops common endings so word forms line up.
// shipping/shipper -> "shipp", receiving/receiver -> "receiv", warehouse/warehousing -> "warehous".
function stem(w) {
  let s = w;
  for (const end of ["ings", "ing", "ers", "er", "ed", "es", "s"]) {
    if (s.length - end.length >= 3 && s.endsWith(end)) { s = s.slice(0, -end.length); break; }
  }
  if (s.length > 3 && s.endsWith("e")) s = s.slice(0, -1);
  return s;
}

// Text -> " stem stem stem " (padded so whole-word checks are a simple includes()).
function stemText(text) {
  const parts = norm(text).split(/\s+/).filter(Boolean).map(stem);
  return parts.length ? " " + parts.join(" ") + " " : "";
}

// Stemming every description on every search is wasteful, so remember it per job.
const stemCache = new WeakMap();
function stemsFor(job) {
  let s = stemCache.get(job);
  if (!s) {
    s = { title: stemText(job.title), cat: stemText(job.category + " " + job.subcategory), desc: stemText(job.description) };
    stemCache.set(job, s);
  }
  return s;
}

// A trimmed-down job for the AI to read. Small results = faster, cheaper calls.
function brief(job, extra = {}) {
  return {
    job_id: job.id,
    title: job.title,
    employment: job.employment,
    location: [job.city, job.province].filter(Boolean).join(", "),
    category: [job.category, job.subcategory].filter(Boolean).join(": "),
    pay: job.pay || "not listed",
    posted: job.posted,
    snippet: job.description.replace(/\n/g, " ").slice(0, 220),
    ...extra,
  };
}

/**
 * searchJobs(jobs, filters)
 *   keywords:   ["forklift", "warehouse"]  (any match counts; more matches rank higher)
 *   province:   "NS" or "Nova Scotia"      (hard filter)
 *   city:       "Halifax"                   (soft: nearby towns rank first, others still shown)
 *   employment: "permanent" | "temporary" | "any"
 *   limit:      how many to return (default 8)
 */
export function searchJobs(jobs, filters = {}) {
  const words = (Array.isArray(filters.keywords) ? filters.keywords : String(filters.keywords || "").split(","))
    .map((w) => norm(w).trim()).filter((w) => w.length > 1);
  const prov = provinceCode(filters.province);
  const places = placesFor(filters.city);
  const want = String(filters.employment || "any").toLowerCase();
  const limit = Math.min(Math.max(Number(filters.limit) || 8, 1), 15);

  let pool = jobs;
  if (prov) pool = pool.filter((j) => j.province === prov);
  if (want.startsWith("perm")) pool = pool.filter((j) => j.employment !== "Temporary / contract");
  if (want.startsWith("temp") || want.startsWith("contract")) pool = pool.filter((j) => j.employment !== "Permanent");

  // Compare word stems, whole words only: "rn" won't hit "learn", but
  // "shipping" finds "Shipper" and "driving" finds "Driver".
  const needles = words.map(stemText).filter(Boolean);

  const scored = pool.map((job) => {
    const s = stemsFor(job);
    let score = 0, strong = false;
    for (const n of needles) {
      if (s.title.includes(n)) { score += 6; strong = true; }
      else if (s.cat.includes(n)) { score += 3; strong = true; }
      else if (s.desc.includes(n)) score += 1;
    }
    const nearby = places.length > 0 && places.some((p) => norm(job.city).includes(norm(p)));
    return { job, score, strong, nearby };
  });

  // Prefer jobs whose title or category matched. Description-only mentions
  // are a weaker signal, so they only fill in when strong matches are thin.
  let keywordHits = words.length ? scored.filter((r) => r.score > 0) : scored;
  const strongHits = keywordHits.filter((r) => r.strong);
  if (strongHits.length >= 3) keywordHits = strongHits;
  const usedFallback = words.length > 0 && keywordHits.length === 0;
  const list = (usedFallback ? scored : keywordHits).sort((a, b) =>
    (b.nearby - a.nearby) || (b.score - a.score) || String(b.job.posted).localeCompare(String(a.job.posted)));

  return {
    total_open_jobs: jobs.length,
    matching: list.length,
    note: usedFallback
      ? "No postings matched those keywords. These are the other open jobs that fit the location and job-type filters, newest first."
      : undefined,
    results: list.slice(0, limit).map((r) => brief(r.job, { near_requested_city: places.length ? r.nearby : undefined })),
  };
}

export function getJobDetails(jobs, id) {
  const job = jobs.find((j) => j.id === String(id));
  if (!job) throw new Error("No open job with id " + id + ". Use search_jobs to find valid ids.");
  return { ...brief(job), description: job.description.slice(0, 2500), office: job.office };
}

// What the chat window shows as a card.
export function toCard(job, reason) {
  return {
    id: job.id, title: job.title, employment: job.employment,
    location: [job.city, job.province].filter(Boolean).join(", "),
    pay: job.pay, reason: String(reason || "").slice(0, 200),
    viewUrl: job.viewUrl, applyUrl: job.applyUrl,
  };
}
