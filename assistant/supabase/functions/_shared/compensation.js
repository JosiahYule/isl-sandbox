// One pay decision for the website, assistant and build checks. The saved feed stays intact.
// Conflicting figures need a recruiter decision; do not pick one automatically.
const AMOUNT = String.raw`\d+(?:,\d{3})*(?:\.\d{1,2})?`;
const RATE = String.raw`\$\s*(${AMOUNT})(?:\s*(?:-|–|—|to)\s*\$?\s*(${AMOUNT}))?\s*(?:(?:/|per\s+|an?\s+)(hour|hr|year|yr|annum)|\s+(hourly|annually|yearly))\b`;
const number = (s) => Number(s.replace(/,/g, ''));
const unitOf = (s) => /hour|hr/i.test(s) ? 'hour' : 'year';
const money = (n) => '$' + n.toLocaleString('en-CA', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
const same = (a, b) => a.unit === b.unit && Math.abs(a.min - b.min) < 0.01 && Math.abs(a.max - b.max) < 0.01;

export function formatCompensation(rate) {
  return `${money(rate.min)}${rate.min !== rate.max ? ` to ${money(rate.max)}` : ''}/${rate.unit}`;
}

export function compensationRates(text = '') {
  return [...String(text).matchAll(new RegExp(RATE, 'gi'))].map((m) => {
    let min = number(m[1]);
    const max = number(m[2] || m[1]);
    const unit = unitOf(m[3] || m[4]);
    // "$55 to $65,000/year" is the feed's shorthand for 55,000 to 65,000.
    if (unit === 'year' && min < 1000 && max >= 1000 && min * 1000 <= max) min *= 1000;
    return { min, max, unit };
  }).filter((r) => r.min > 0 && r.max >= r.min);
}

export function advertisedCompensation(description = '') {
  const text = String(description).split(/\n\s*(?:refer talent|about integrated staffing|\{\s*"@context")/i)[0];
  // Bonuses, allowances and overtime are not the base rate. Keep separate work-site tiers.
  return text.split('\n').filter((line) => line.length < 600 && !/referral|bonus|allowance|overtime/i.test(line))
    .flatMap((line) => compensationRates(line));
}

export function checkCompensation(job) {
  const feed = compensationRates(job.pay)[0];
  const advertised = advertisedCompensation(job.description);
  const units = new Set(advertised.map((r) => r.unit));
  // Do not turn an hourly figure into a salary without knowing the actual hours.
  const comparable = units.size === 1 && (!feed || units.has(feed.unit));
  const envelope = comparable && advertised.length ? {
    min: Math.min(...advertised.map((r) => r.min)),
    max: Math.max(...advertised.map((r) => r.max)), unit: advertised[0].unit,
  } : null;
  return { feed, advertised, envelope, conflict: !!(feed && envelope && !same(feed, envelope)) };
}

export function resolveCompensation(job) {
  if (job.payStatus === 'conflict') return job;
  const check = checkCompensation(job);
  if (check.conflict) {
    return {
      ...job, pay: '', payLabel: 'Confirm pay with recruiter', payStatus: 'conflict',
      // Keep the raw snapshot unchanged, but never publish either unconfirmed rate.
      description: String(job.description || '').replace(new RegExp(RATE, 'gi'), 'Pay to be confirmed with recruiter'),
    };
  }
  const rate = check.feed || check.envelope;
  return { ...job, pay: rate ? formatCompensation(rate) : job.pay || '', payStatus: rate ? 'listed' : 'not-listed' };
}
