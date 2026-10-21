// JOB AD CHECK: the rules behind /learn/tools/job-ad-check/.
// Everything runs in the visitor's browser on the ad they paste; nothing is sent anywhere.
//
// Three parts:
//   checkAd(text, province)  weighted checks, like the Resume check: what a job seeker looks for
//                            first (pay, place, hours, the work), and what puts good people off
//   readAdPay(text)          the pay the ad offers, as an hourly figure, so it can be compared
//                            with ISL's open jobs (insights.js payFor, done on the page)
//   PAY_LAW                  whether the province requires pay in the ad (checked October 2026)
//
// The pay law check is weighted heavily where pay is required: an ad without it isn't just weaker,
// it's out of line with the law there.

const words = (t) => t.match(/[A-Za-z][A-Za-z'’-]*/g) || [];
const lines = (t) => t.split(/\n/).map((l) => l.trim()).filter(Boolean);
const BULLET = /^[•▪●◦\-–*·]\s*/;

// ---- Pay transparency rules for job ads, by province ----
// status: 'required' | 'not yet'
export const PAY_LAW = {
  PE: { status: 'required', since: 'June 1, 2022',
    text: 'Public job ads must include the expected pay or pay range. You also can’t ask applicants what they were paid before.',
    source: ['PEI Employment Standards Act changes (Stewart McKelvey)', 'https://stewartmckelvey.com/thought-leadership/pay-transparency-recent-changes-to-peis-employment-standards-act/'] },
  NB: { status: 'required', since: 'June 12, 2026',
    text: 'The Pay Transparency Act requires the expected wage or salary, or a range, in public and internal job postings. You also can’t ask applicants what they were paid before.',
    source: ['New Brunswick Pay Transparency Act (Cox & Palmer)', 'https://coxandpalmerlaw.com/publication/pay-transparency-comes-to-new-brunswick-what-employers-need-to-know-now/'] },
  NS: { status: 'not yet',
    text: 'Not required in job ads yet. Nova Scotia has said more pay transparency rules are coming, and ads with pay get more applicants either way.',
    source: ['Atlantic pay transparency overview (McInnes Cooper)', 'https://www.mcinnescooper.com/publications/pay-equity-and-transparency-laws-creating-obligations-and-opportunities-in-employment/'] },
  NL: { status: 'not yet',
    text: 'Not required in job ads yet. The pay transparency parts of the 2022 Pay Equity and Pay Transparency Act aren’t in force.',
    source: ['Atlantic pay transparency overview (McInnes Cooper)', 'https://www.mcinnescooper.com/publications/pay-equity-and-transparency-laws-creating-obligations-and-opportunities-in-employment/'] },
  OTHER: { status: 'varies',
    text: 'British Columbia (since November 2023) and Ontario (since January 2026, for employers with 25 or more staff, with a range no wider than $50,000) also require pay in public job ads.',
    source: ['Pay transparency in Canada (Payworks, July 2026)', 'https://blog.payworks.ca/pay-transparency-is-now-law-in-three-provinces-is-your-business-ready'] },
};

// ---- The pay the ad offers ----
// "$18 - $20/hour", "$18.50 per hour", "$55,000 to $65,000", "65K". Returns hourly figures
// (a salary over a 2,080-hour year), or null when the ad has no figure.
export function readAdPay(text) {
  const t = String(text).replace(/(\d)\s*[kK]\b/g, '$1,000');
  const money = /\$\s?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d{1,2})?)(?:\s*(?:-|–|to)\s*\$?\s?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d{1,2})?))?/;
  const m = t.match(money);
  if (!m) return null;
  const n = (s) => Number(String(s).replace(/,/g, ''));
  let lo = n(m[1]);
  let hi = m[2] ? n(m[2]) : lo;
  if (lo < 1000 && hi >= 1000 && lo * 1000 <= hi) lo *= 1000; // "$55 - $65,000"
  if (hi < lo) [lo, hi] = [hi, lo];
  const yearly = hi >= 1000;
  if (!yearly && (lo < 10 || hi > 300)) return null; // a bonus or a fee, not a wage
  const toHour = (v) => (yearly ? v / 2080 : v);
  return { lo: toHour(lo), hi: toHour(hi), mid: toHour((lo + hi) / 2), unit: yearly ? 'year' : 'hour', range: hi > lo, text: m[0].trim() };
}

const HYPE = /\b(rock ?stars?|ninjas?|gurus?|wizards?|superstars?|unicorns?|jedi|hustlers?)\b/i;
const CODED = /\b(aggressive(ly)?|dominant|fearless|forceful|headstrong|young|youthful|digital natives?|recent grad(uate)?s? only|manpower|salesm[ae]n|he will|he must|his duties|canadian experience)\b/gi;
const FILLER = /\b(fast[- ]paced environment|wear (many|multiple) hats|self[- ]starter|team player|work hard,? play hard|like a family|go[- ]getter|hit the ground running|other duties as (assigned|required))\b/gi;
const MUST = /\b(must|required|requirement|mandatory|minimum of|at least)\b/i;

export const CHECKS = [
  { id: 'pay', group: 'Pay', weight: 4, label: 'Pay is in the ad',
    test: (t) => !!readAdPay(t),
    fix: (t, p) => (PAY_LAW[p]?.status === 'required'
      ? `Add the pay or a pay range. It’s required in ${p === 'PE' ? 'PEI' : 'New Brunswick'}, and it’s the first thing job seekers look for.`
      : 'Add the pay or a pay range. It’s the first thing job seekers look for, and ads without it get fewer applicants.') },
  { id: 'vague', group: 'Pay', weight: 1, label: 'No “competitive pay” without a figure',
    test: (t) => !!readAdPay(t) || !/\b(competitive (pay|wage|wages|salary|rate|compensation)|depending on experience|\bDOE\b|commensurate)/i.test(t),
    fix: '“Competitive pay” on its own reads as low pay. Put the number in.' },
  { id: 'width', group: 'Pay', weight: 1, label: 'A pay range that means something',
    test: (t) => { const p = readAdPay(t); return !p || !p.range || p.hi / p.lo <= 1.4; },
    fix: (t) => { const p = readAdPay(t); return `The range runs ${Math.round((p.hi / p.lo - 1) * 100)}% from bottom to top. A tighter range is more believable; say what moves someone up it.`; } },
  { id: 'place', group: 'The basics', weight: 2, label: 'Where the work is',
    test: (t) => /\b(nova scotia|new brunswick|prince edward island|newfoundland|labrador|halifax|dartmouth|bedford|burnside|truro|sydney|moncton|dieppe|saint john|fredericton|charlottetown|summerside|st\.? john'?s|mount pearl|bridgewater|kentville|antigonish|remote|hybrid|on[- ]site)\b|,\s*(NS|NB|PE|PEI|NL)\b/i.test(t),
    fix: 'Say where the work is: the town at least. People filter by distance before anything else.' },
  { id: 'hours', group: 'The basics', weight: 2, label: 'Hours or schedule',
    test: (t) => /\b(\d{1,2}(:\d{2})?\s?(am|pm|a\.m\.|p\.m\.)|monday|weekdays?|weekends?|evenings?|mornings?|nights?|shifts?|hours|full[- ]time|part[- ]time|overtime|days a week)\b/i.test(t),
    fix: 'Add the hours or shifts: days, nights, weekends, and roughly how many hours a week.' },
  { id: 'type', group: 'The basics', weight: 1, label: 'Permanent, contract or seasonal',
    test: (t) => /\b(permanent|contract|temporary|temp|seasonal|casual|term position|full[- ]time|part[- ]time)\b/i.test(t),
    fix: 'Say whether it’s permanent, contract or seasonal. Someone leaving a steady job needs to know.' },
  { id: 'title', group: 'The basics', weight: 2, label: 'A plain job title',
    test: (t) => { const first = lines(t)[0] || ''; return first.length > 0 && first.length <= 60 && !HYPE.test(first) && first !== first.toUpperCase(); },
    fix: (t) => { const first = lines(t)[0] || '';
      return HYPE.test(first) ? 'Use the title people search for (“Shipper/Receiver”, not “Logistics Rockstar”). Job boards match on it.'
        : first.length > 60 ? 'Start with the job title on its own line, under 60 characters. Job boards show the first line.'
        : 'Start with the job title on its own line, in normal capitals.'; } },
  { id: 'duties', group: 'The work', weight: 2, label: 'What the job involves',
    test: (t) => /^\s*(key |main |your )?(responsibilities|duties|what you('|’)?ll do|the role|day[- ]to[- ]day|what you will do)\b/im.test(t) || lines(t).filter((l) => BULLET.test(l)).length >= 4,
    fix: 'Add a short list of what they’ll actually do day to day. Four to six bullets is plenty.' },
  { id: 'musts', group: 'The work', weight: 2, label: 'A short must-have list',
    test: (t) => lines(t).filter((l) => MUST.test(l)).length <= 6,
    fix: (t) => `${lines(t).filter((l) => MUST.test(l)).length} lines say “must” or “required”. Long must-have lists put off people who could do the job. Keep the true deal-breakers and call the rest “nice to have”.` },
  { id: 'offer', group: 'The work', weight: 1, label: 'What’s in it for them',
    test: (t) => /\b(benefits?|insurance|dental|rrsp|pension|vacation|training|paid time off|bonus|growth|advancement|career path|weekly pay|perks?|discount|parking)\b/i.test(t),
    fix: 'Add a line on what you offer beyond pay: benefits, training, steady hours, weekly pay, parking. It’s what separates two similar ads.' },
  { id: 'apply', group: 'The work', weight: 1, label: 'How to apply',
    test: (t) => /\b(apply|send (us )?your resume|email|contact|call|submit)\b/i.test(t),
    fix: 'End with how to apply and what happens next (“We reply to every applicant within a week”).' },
  { id: 'length', group: 'Writing', weight: 2, label: 'Long enough, short enough',
    test: (t) => { const n = words(t).length; return n >= 80 && n <= 700; },
    fix: (t) => (words(t).length < 80 ? 'Under 80 words leaves out what people need to decide. Add the duties, hours and pay.' : 'Over 700 words gets skimmed on a phone. Cut the company history and keep what changes someone’s decision.') },
  { id: 'coded', group: 'Writing', weight: 2, label: 'Wording open to everyone',
    test: (t) => !(t.match(CODED) || []).length,
    fix: (t) => { const hits = [...new Map((t.match(CODED) || []).map((w) => [w.toLowerCase(), w])).values()];
      return `“${hits.slice(0, 3).join('”, “')}” can read as aimed at one kind of person (or, for “Canadian experience”, shuts out skilled newcomers). Describe the work instead.`; } },
  { id: 'filler', group: 'Writing', weight: 1, label: 'No filler phrases',
    test: (t) => (t.match(FILLER) || []).length <= 1,
    fix: (t) => `Phrases like “${[...new Set((t.match(FILLER) || []).map((w) => w.toLowerCase()))].slice(0, 2).join('” and “')}” are in every ad. Swap them for something specific to this job.` },
  { id: 'sentences', group: 'Writing', weight: 1, label: 'Short sentences',
    test: (t) => { const s = t.split(/[.!?]+\s|\n/).map((x) => words(x).length).filter((n) => n > 3); return !s.length || s.reduce((a, b) => a + b, 0) / s.length <= 22; },
    fix: 'Sentences average over 22 words. Most people read job ads on a phone: break them up.' },
];

export function checkAd(text, province = 'NS') {
  const t = String(text || '');
  const required = PAY_LAW[province]?.status === 'required';
  const results = CHECKS.map((c) => {
    const weight = c.id === 'pay' && required ? 8 : c.weight; // required by law here: it matters more
    const pass = !!c.test(t);
    return { id: c.id, group: c.group, label: c.label, weight, pass, fix: pass ? '' : (typeof c.fix === 'function' ? c.fix(t, province) : c.fix) };
  });
  const total = results.reduce((n, r) => n + r.weight, 0);
  const got = results.filter((r) => r.pass).reduce((n, r) => n + r.weight, 0);
  return {
    score: Math.round((got / total) * 100),
    words: words(t).length,
    title: (lines(t)[0] || '').slice(0, 80),
    pay: readAdPay(t),
    law: PAY_LAW[province] || PAY_LAW.OTHER,
    fixes: results.filter((r) => !r.pass).sort((a, b) => b.weight - a.weight),
    passed: results.filter((r) => r.pass),
  };
}
