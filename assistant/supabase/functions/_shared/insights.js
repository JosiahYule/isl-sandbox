// =====================================================================
// insights.js: answers worked out from ISL's own data, for the assistant.
//
// Three questions people ask in the chat that a job search can't answer:
//   payFor()     "What do forklift operators make in New Brunswick?"
//                -> the middle and range of pay on ISL's open jobs for that role
//   costFor()    "What would a $20/hour worker really cost me?"
//                -> the same maths as the True cost calculator (payroll.js)
//   jobAnswer()  "What are the hours?" on a job page
//                -> the lines of THAT posting that answer it (jobtext.js reads the posting)
//
// Like jobs.js, there's no AI in here. The AI (or the demo engine) decides which
// question is being asked; this file works out the answer from real data, so the
// assistant can only quote figures that exist.
//
// Each answer can be shown as an "insight" card in the chat window:
//   { kicker, figure, sub, rows?: [[label, value]], link?: { label, href } }
// =====================================================================
import { stemText, provinceCode } from "./jobs.js";
import { readPay, familyOf, perHour } from "./pay.js";
import { trueCost, money, RATES } from "./payroll.js";
import { jobBlocks, PAY_LABEL } from "./jobtext.js";
import { provinceName } from "./routing.js";

const FILLER = new Set(("worker workers staff person people job jobs role roles position positions employee employees help someone some " +
  "new good typical usually average experienced entry level the and for get make earn paid pay what how much does do they").split(" "));

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const k = Math.floor(s.length / 2);
  return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2;
};
const where = (j) => [j.city, j.province].filter(Boolean).join(", ");

/**
 * payFor(jobs, { role: "forklift operators", province: "NB" })
 * Looks for open jobs with every word of the role in the title, in the province first.
 * When there are fewer than two with pay listed, it widens step by step, and says so:
 *   the role anywhere -> the role's family in the province -> the family anywhere.
 * Returns null when nothing usable is open.
 */
export function payFor(jobs, { role = "", province = "" } = {}) {
  const prov = provinceCode(province);
  const words = String(role).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length > 2 && !FILLER.has(w));
  const needles = words.map(stemText).filter(Boolean);
  const family = familyOf(role);
  const paid = (list) => list.map((j) => ({ j, p: readPay(j.pay) })).filter((x) => x.p);
  const titled = (list) => needles.length ? list.filter((j) => { const t = stemText(j.title); return needles.every((n) => t.includes(n)); }) : [];
  const inProv = (list) => (prov ? list.filter((j) => j.province === prov) : list);

  const steps = [
    { basis: "role", list: paid(inProv(titled(jobs))), widened: false },
    { basis: "role", list: paid(titled(jobs)), widened: !!prov },
    { basis: "family", list: family === "Other" ? [] : paid(inProv(jobs.filter((j) => familyOf(j.title) === family))), widened: false },
    { basis: "family", list: family === "Other" ? [] : paid(jobs.filter((j) => familyOf(j.title) === family)), widened: !!prov },
  ];
  const step = steps.find((s) => s.list.length >= 2) || steps.find((s) => s.list.length === 1);
  if (!step) return null;

  const list = step.list;
  const allYearly = list.every((x) => x.p.unit === "year");
  const mid = allYearly ? median(list.map((x) => x.p.mid)) : median(list.map((x) => x.p.hourly));
  const lo = allYearly ? Math.min(...list.map((x) => x.p.min)) : Math.min(...list.map((x) => (x.p.unit === "year" ? x.p.hourly : x.p.min)));
  const hi = allYearly ? Math.max(...list.map((x) => x.p.max)) : Math.max(...list.map((x) => (x.p.unit === "year" ? x.p.hourly : x.p.max)));
  const fmt = (n) => (allYearly ? money(Math.round(n / 500) * 500, false) + "/year" : perHour(n));
  const mixed = !allYearly && list.some((x) => x.p.unit === "year");

  return {
    role: String(role).trim(),
    basis: step.basis,
    family,
    province: step.widened ? "" : prov,
    askedProvince: prov,
    widened: step.widened,
    count: list.length,
    unit: allYearly ? "year" : "hour",
    median: mid,
    hourly: allYearly ? mid / 2080 : mid,
    low: lo, high: hi,
    figure: fmt(mid),
    range: lo === hi ? fmt(lo) : `${fmt(lo).replace(/\/(hour|year)$/, "")} to ${fmt(hi)}`,
    mixed,
    examples: list.sort((a, b) => b.p.hourly - a.p.hourly).slice(0, 3).map(({ j }) => ({ id: j.id, title: j.title, location: where(j), pay: j.pay })),
  };
}

// payFor() result -> the card in the chat window
export function payInsight(r, siteUrl) {
  const region = r.province ? provinceName(r.province) : "Atlantic Canada";
  const what = r.basis === "role" ? r.role.charAt(0).toUpperCase() + r.role.slice(1) : r.family;
  const sub = r.count === 1 ? `From the one open ISL job like this, in ${r.examples[0].location}.`
    : `The middle of ${r.count} open ISL jobs, from ${r.range}.${r.mixed ? " Salaries shown as an hourly figure." : ""}`;
  return {
    kicker: `${what}, ${region}`,
    figure: r.figure,
    sub,
    link: { label: "Pay on every role", href: siteUrl("/learn/tools/pay-on-open-jobs/") },
  };
}

/**
 * costFor({ wage: 20, hours: 40, province: "NS" }) -> the True cost calculator's answer, trimmed
 */
export function costFor({ wage, hours = 40, province = "NS" } = {}) {
  const w = Number(wage);
  if (!(w > 0) || w > 500) return null;
  const prov = RATES.provinces[provinceCode(province)] ? provinceCode(province) : "NS";
  const h = Math.min(Math.max(Number(hours) || 40, 5), 60);
  const c = trueCost({ wage: w, hours: h, province: prov });
  const by = (keys) => c.lines.filter((l) => keys.includes(l.key)).reduce((n, l) => n + l.hour, 0);
  return {
    wage: w, hours: h, province: prov,
    perHour: c.perHour,
    uplift: c.uplift,
    timeOff: by(["holidays", "vacation"]),
    government: by(["cpp", "ei", "wcb"]),
    yearTotal: c.total,
    hoursWorked: c.worked,
  };
}

export function costInsight(r, siteUrl) {
  const q = new URLSearchParams({ wage: String(r.wage), hours: String(r.hours), province: r.province });
  return {
    kicker: `True cost at ${money(r.wage)}/hour, ${provinceName(r.province)}`,
    figure: money(r.perHour),
    sub: `per hour worked, ${Math.round(r.uplift * 100)}% on top of the wage`,
    rows: [["Wage", money(r.wage)], ["Paid holidays and vacation", money(r.timeOff)], ["CPP, EI and workers’ comp", money(r.government)]],
    link: { label: "See the full breakdown", href: siteUrl("/learn/tools/true-cost-of-an-employee/?" + q.toString()) },
  };
}

// ---------- Questions about one posting ----------
// For each topic: "Label: value" lines it can come from, headings whose section answers it,
// and words that mark a sentence about it (used when there's no such line or section).
const TOPICS = {
  pay: { labels: PAY_LABEL, heads: /compensation|^pay|wage|salary/i, words: /\$\s?\d|per hour|\/hour|an hour|\bsalary\b|\bwage\b/i },
  hours: { labels: /^(hours|schedule|shifts?|work schedule|working hours|hours of work|days|availability)$/i, heads: /schedule|hours|shift/i,
    words: /\b(\d{1,2}(:\d{2})?\s?(am|pm|a\.m\.|p\.m\.)|monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekends?|overtime|shifts?|hours|full[- ]time|part[- ]time|nights?|days a week)\b/i },
  needs: { labels: /^(requirements?|qualifications?|experience|education|licen[cs]e|certifications?|must have)$/i,
    heads: /requirement|qualification|what you (bring|need|have)|skills|experience|must|ideal|about you|you have|you are|asset|eligib|need to/i,
    words: /\b(must|licen[cs]e|certif|ticket|ability to|able to|whmis|first aid|diploma|degree|\d+\+? years|experience (is |would be )?(required|an asset|preferred|considered))/i },
  duties: { labels: /^(duties|responsibilities|tasks)$/i, heads: /responsib|duties|what you('|’)?ll (do|be doing)|the role|day[- ]to[- ]day|tasks|job description|overview|what you will do/i, words: null },
  benefits: { labels: /^(benefits|perks)$/i, heads: /benefit|perks|what we offer|why (join|work)|we offer|what('|’)s in it/i,
    words: /\b(benefits?|insurance|dental|rrsp|pension|bonus|perks?|discount)\b/i },
  start: { labels: /^(start|start date|starting|duration|length|term|contract length|assignment length)$/i, heads: /^(start|duration)/i,
    words: /\b(start(s|ing)? (date|immediately|asap|on|in)|immediate start|asap|duration|contract (length|term)|ongoing|long[- ]term|short[- ]term|\d+[- ](week|month)s?)\b/i },
};

/**
 * jobAnswer(job, "hours") -> { topic, lines: ["Schedule: Monday to Friday, 7am to 3:30pm"] }
 * lines is empty when the posting doesn't say.
 */
export function jobAnswer(job, topic) {
  const t = TOPICS[topic];
  if (!job || !t) return { topic, lines: [] };
  if (topic === 'pay' && job.payStatus === 'conflict') return { topic, lines: ['Pay is being confirmed. Contact the recruiter for the current rate.'] };
  const blocks = jobBlocks(job.description || "", job.title || "");
  const out = [];
  const add = (s) => { const v = String(s).trim(); if (v && !out.includes(v) && out.length < 5) out.push(v); };

  for (const b of blocks) if (b.type === "details") for (const i of b.items) if (t.labels.test(i.label)) add(`${i.label}: ${i.value}`);
  if (!out.length && t.heads) {
    const at = blocks.findIndex((b) => b.type === "heading" && t.heads.test(b.text));
    if (at >= 0) {
      for (const b of blocks.slice(at + 1)) {
        if (b.type === "heading") break;
        if (b.type === "list") b.items.forEach(add);
        else if (b.type === "p") add(b.text);
        else if (b.type === "details") b.items.forEach((i) => add(`${i.label}: ${i.value}`));
      }
    }
  }
  if (!out.length && t.words) {
    for (const b of blocks) {
      const items = b.type === "list" ? b.items : b.type === "p" ? [b.text] : b.type === "details" ? b.items.map((i) => `${i.label}: ${i.value}`) : [];
      items.filter((s) => s.length <= 200 && t.words.test(s)).forEach(add); // long paragraphs are intros, not answers
    }
  }
  return { topic, lines: out };
}
