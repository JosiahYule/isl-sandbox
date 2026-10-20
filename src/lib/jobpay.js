// PAY ON OPEN JOBS: groups live postings into role families and reads their pay.
// Used by /learn/tools/pay-on-open-jobs/ and its preview card.
//
// Families are matched on the job title, first match wins (so "Class 3A Harvest Driver" is a
// driver, not general labour, and "Kitchen Stewards" is hospitality). Anything unmatched is "Other".
//
// Pay comes from the feed as "$18/hour", "$20 to $24/hour" or "$72,000 to $85,000/year".
// To compare everything on one scale, a yearly salary is shown as its hourly equivalent
// over a 2,080-hour year (40 hours x 52 weeks), the usual Canadian conversion.

export const FAMILIES = [
  ['Drivers', /\bdriver/i],
  ['Hospitality', /server|cook|banquet|kitchen|event|steward/i],
  ['Warehouse and logistics', /forklift|warehouse|shipper|receiver|material handler|inventory|dock/i],
  ['Skilled trades', /carpenter|millwright|technician|erector|assembler|foreman|electric|welder|mechanic|inspector|plumb/i],
  ['Professional and management', /manager|\blead\b|analyst|architect|controller|tax|engineer|director/i],
  ['Office and administration', /admin|payroll|accounts|clerk|assistant|agent|recruit|reception|coordinator/i],
  ['General labour', /labou?r|picker|garbage|harvest|cultivation|cleaner|helper/i],
];

export const familyOf = (title) => (FAMILIES.find(([, re]) => re.test(title)) || ['Other'])[0];

const HOURS_A_YEAR = 2080;

// "$20 to $24/hour" -> { min: 20, max: 24, unit: 'hour', mid: 22, hourly: 22 }; '' -> null
export function readPay(pay) {
  const m = String(pay || '').match(/^\$([\d,.]+)(?: to \$([\d,.]+))?\/(hour|year)$/);
  if (!m) return null;
  const n = (s) => Number(s.replace(/,/g, ''));
  let min = n(m[1]);
  const max = m[2] ? n(m[2]) : min;
  const unit = m[3];
  if (unit === 'year' && min < 1000) min = max; // "$55 to $65,000/year": a typo in the feed, keep the top figure
  const mid = (min + max) / 2;
  // A salary under $31,200 (minimum-wage territory over a full year) is a part-time or seasonal
  // role quoted as a yearly total; as an hourly figure it would mislead, so it's left out.
  if (unit === 'year' && mid < 31200) return null;
  return { min, max, unit, mid, hourly: unit === 'year' ? mid / HOURS_A_YEAR : mid };
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const k = Math.floor(s.length / 2);
  return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2;
};

// Jobs -> one row per family that has pay data, busiest first
export function payByFamily(jobs) {
  const rows = new Map();
  for (const j of jobs) {
    const p = readPay(j.pay);
    if (!p) continue;
    const f = familyOf(j.title);
    if (!rows.has(f)) rows.set(f, []);
    rows.get(f).push({ ...j, payInfo: p });
  }
  return [...rows.entries()]
    .map(([family, list]) => ({
      family,
      jobs: list.sort((a, b) => a.payInfo.hourly - b.payInfo.hourly),
      low: Math.min(...list.map((j) => j.payInfo.hourly)),
      high: Math.max(...list.map((j) => j.payInfo.hourly)),
      median: median(list.map((j) => j.payInfo.hourly)),
    }))
    .sort((a, b) => b.jobs.length - a.jobs.length || a.family.localeCompare(b.family));
}

export const perHour = (v) => '$' + (Math.round(v * 100) / 100).toFixed(v % 1 ? 2 : 0) + '/hour';
