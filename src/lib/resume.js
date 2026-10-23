// RESUME CHECK: the rules behind /learn/tools/resume-check/.
// Everything runs in the visitor's browser on the text they paste; nothing is sent anywhere.
//
// Each check has a weight (how much it matters to a recruiter skimming for 30 seconds),
// a test, and the fix to show when it fails. The score is the share of weight that passes.
// Failed checks are listed heaviest first, so the visitor knows what to fix first.
//
// keywordsFor() picks the terms a recruiter would look for in one of our postings:
// tickets and skills named in the posting (from a fixed list), plus the job title's words.
// It reads the posting as the job page shows it (src/lib/jobtext.js), so the standard closing
// ISL adds to every ad ("weekly payroll", the referral bonus) can't add false matches.
import { jobBlocks } from './jobtext.js';

const words = (t) => t.match(/[A-Za-z][A-Za-z'’-]*/g) || [];
const lines = (t) => t.split(/\n/).map((l) => l.trim()).filter(Boolean);
const count = (t, re) => (t.match(re) || []).length;
const BULLET = /^[•▪●◦\-–*·]\s*/;
// Count examples, not physical lines: pasted documents often join bullets into a paragraph.
function quantifiedExamples(text) {
  return text.split(/\n|[.!?;]+(?=\s|$)/).filter((part) =>
    /(?:\$\s*\d[\d,.]*|\b\d[\d,.]*\s*(?:%|\+?\s*(?:people|staff|employees|clients|customers|units|orders|pallets|trucks|loads|hours|days|weeks|per|team|sites|projects|accounts)\b))/i.test(part),
  ).length;
}

const VERBS = 'achieved assembled assisted built coached completed coordinated created cut delivered designed developed directed drove ensured established expanded handled improved increased installed introduced launched led loaded maintained managed monitored negotiated operated organized oversaw packed picked planned prepared processed produced provided reduced repaired resolved restored ran scheduled served set shipped solved sorted streamlined supervised supported trained unloaded updated wrote welded inspected cleaned cooked prepped answered booked billed reconciled audited calculated recruited hired onboarded drafted'.split(' ');

const SECTION = (names) => new RegExp(`^\\s*(${names})\\b[:\\s]*$`, 'im');

export const CHECKS = [
  { id: 'email', group: 'Contact', weight: 3, label: 'Email address',
    test: (t) => /[\w.+-]+@[\w-]+\.[\w.]+/.test(t),
    fix: 'Add an email address at the top, so a recruiter can reply.' },
  { id: 'phone', group: 'Contact', weight: 3, label: 'Phone number',
    test: (t) => /(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/.test(t),
    fix: 'Add a phone number. For contract work, recruiters often call the same day.' },
  { id: 'place', group: 'Contact', weight: 1, label: 'City and province',
    test: (t) => /\b(nova scotia|new brunswick|prince edward island|newfoundland|labrador|ontario|quebec|alberta|manitoba|saskatchewan|british columbia|halifax|dartmouth|moncton|saint john|fredericton|charlottetown|st\.? john'?s|sydney|truro|summerside)\b|,\s*(NS|NB|PE|PEI|NL|ON|QC|AB|BC|MB|SK)\b/i.test(t),
    fix: 'Add your city and province. Recruiters filling local roles look for it first.' },
  { id: 'length', group: 'Length', weight: 2, label: 'One to two pages',
    test: (t) => { const n = words(t).length; return n >= 200 && n <= 900; },
    fix: (t) => words(t).length < 200
      ? 'Under 200 words reads thin. Add a line or two about what you achieved in each job.'
      : 'Over 900 words is more than two pages. Cut older or less relevant jobs to one line each.' },
  { id: 'exp', group: 'Experience', weight: 2, label: 'An experience section',
    test: (t) => SECTION('(work |professional |relevant )?experience|employment( history)?|work history|career history').test(t),
    fix: 'Add a clear "Experience" heading, so your jobs are easy to find.' },
  { id: 'dates', group: 'Experience', weight: 2, label: 'Dates for each job',
    test: (t) => count(t, /\b(19|20)\d{2}\b/g) >= 2,
    fix: 'Add start and end dates (month and year) to each job. Gaps without dates raise more questions than gaps with them.' },
  { id: 'bullets', group: 'Experience', weight: 1, label: 'Bullet points, not paragraphs',
    test: (t) => lines(t).filter((l) => BULLET.test(l)).length >= 3,
    fix: 'Use three to five short bullet points under each job instead of paragraphs.' },
  { id: 'verbs', group: 'Experience', weight: 2, label: 'Lines start with what you did',
    test: (t) => {
      const ls = lines(t).filter((l) => BULLET.test(l)).map((l) => l.replace(BULLET, ''));
      if (ls.length < 3) return false;
      const hits = ls.filter((l) => VERBS.includes((l.split(/\s+/)[0] || '').toLowerCase().replace(/[^a-z]/g, '')));
      return hits.length / ls.length >= 0.4;
    },
    fix: 'Start each bullet with a verb: "Operated", "Trained", "Reduced". It reads as doing, not describing.' },
  { id: 'numbers', group: 'Achievements', weight: 3, label: 'At least two quantified examples',
    test: (t) => quantifiedExamples(t) >= 2,
    fix: (t) => quantifiedExamples(t) === 1
      ? 'You have one quantified example. Add another result showing how many, how much or how often.'
      : 'Add numbers: how many, how much, how often. "Picked 120 orders an hour" says more than "picked orders".' },
  { id: 'weak', group: 'Achievements', weight: 2, label: 'No "responsible for" lists',
    test: (t) => count(t, /\b(responsible for|duties included|tasks included|helped with|worked on)\b/gi) <= 1,
    fix: 'Replace "responsible for" and "duties included" with what you actually did or achieved.' },
  { id: 'skills', group: 'Skills', weight: 1, label: 'A skills section',
    test: (t) => SECTION('(key |technical |core )?skills|skills (and|&) (abilities|qualifications)|qualifications|core competencies').test(t),
    fix: 'Add a short "Skills" section: the tools, equipment and software you can use.' },
  { id: 'tickets', group: 'Skills', weight: 1, label: 'Tickets and certifications',
    test: (t) => /\b(whmis|first aid|cpr|forklift|red seal|licen[cs]e|class \d|certif|ticket|ppe|fall arrest|tdg|food ?safe|serv(e|r)ite|cpa|cpp)\b/i.test(t),
    fix: 'List your tickets and certifications (WHMIS, first aid, forklift, driver’s licence class). For industrial jobs they’re often checked first.' },
  { id: 'edu', group: 'Education', weight: 1, label: 'Education',
    test: (t) => SECTION('education|education (and|&) training|training|certifications|education (and|&) certifications').test(t) || /\b(diploma|degree|high school|ged|college|university|apprentice)/i.test(t),
    fix: 'Add your education, even if it’s high school or a course. Some roles require it.' },
  { id: 'firstperson', group: 'Writing', weight: 1, label: 'No "I" and "my"',
    test: (t) => count(t, /\b(I|me|my)\b/g) <= 2,
    fix: 'Drop "I" and "my". Start lines with what you did instead.' },
  { id: 'cliches', group: 'Writing', weight: 1, label: 'No filler phrases',
    test: (t) => count(t, /\b(hard[- ]?working|team player|detail[- ]oriented|go[- ]getter|self[- ]starter|results[- ]driven|think outside the box|synergy|dynamic individual|people person)\b/gi) <= 1,
    fix: 'Phrases like "team player" and "hard-working" are on every resume. Swap them for an example that shows it.' },
  { id: 'refs', group: 'Writing', weight: 1, label: 'No "references available"',
    test: (t) => !/references (are )?available (up)?on request/i.test(t),
    fix: 'Remove "References available upon request". Recruiters assume it, and the line is better used for a result.' },
];

const TOTAL = CHECKS.reduce((n, c) => n + c.weight, 0);

export function checkResume(text) {
  const t = String(text || '');
  const results = CHECKS.map((c) => {
    const pass = !!c.test(t);
    return { id: c.id, group: c.group, label: c.label, weight: c.weight, pass, fix: pass ? '' : (typeof c.fix === 'function' ? c.fix(t) : c.fix) };
  });
  const got = results.filter((r) => r.pass).reduce((n, r) => n + r.weight, 0);
  return {
    score: Math.round((got / TOTAL) * 100),
    words: words(t).length,
    // Each area's checks, in order, so the page can show where the points were won and lost
    areas: [...new Set(results.map((r) => r.group))].map((g) => ({ group: g, checks: results.filter((r) => r.group === g).map((r) => ({ label: r.label, pass: r.pass, weight: r.weight })) })),
    fixes: results.filter((r) => !r.pass).sort((a, b) => b.weight - a.weight),
    passed: results.filter((r) => r.pass),
  };
}

// ---- Matching against one of our postings ------------------------------

// Tickets, tools and skills that recruiters screen for, as [label, pattern]
const TERMS = [
  ['WHMIS', /whmis/i], ['First aid', /first aid/i], ['CPR', /\bcpr\b/i], ['Forklift', /forklift/i],
  ['Class 1 licence', /class 1\b/i], ['Class 3 licence', /class 3/i], ['Class 5 licence', /class 5/i], ['Air brakes', /air brake/i],
  ['Driver’s abstract', /abstract/i], ['Criminal record check', /criminal (record|background)/i], ['Red Seal', /red seal/i],
  ['Safety boots', /safety (boots|footwear)|steel[- ]toe/i], ['Fall protection', /fall (arrest|protection)/i], ['Confined space', /confined space/i],
  ['Power tools', /power tools/i], ['Blueprints', /blueprint|drawings/i], ['Welding', /weld/i], ['Carpentry', /carpent/i],
  ['Customer service', /customer service/i], ['Food safety', /food safe|food handl|servrite|serve it right/i], ['Inventory', /inventory/i],
  ['Shipping and receiving', /shipping|receiving/i], ['Pallet jack', /pallet jack/i], ['Heavy lifting', /lift(ing)? up to|\d+\s*(lb|lbs|pounds)/i],
  ['Excel', /\bexcel\b/i], ['Microsoft Office', /microsoft office|ms office|office 365|microsoft 365/i], ['QuickBooks', /quickbooks/i], ['Sage', /\bsage\b/i],
  ['Payroll', /payroll (admin|processing|software|experience|and)|process(ing)? payroll|\bpayroll\b(?! through)/i], ['Accounts payable', /accounts payable/i], ['Accounts receivable', /accounts receivable/i], ['Reconciliation', /reconcil/i],
  ['CPA', /\bcpa\b/i], ['Bilingual', /bilingual|french/i], ['Scheduling', /\bscheduling\b/i], ['Supervision', /\bsupervis(ing|ion|ed)\b|lead a team|team lead/i],
  ['Data entry', /data entry/i], ['ERP', /\berp\b/i], ['Mechanical', /mechanic/i], ['Electrical', /electric/i], ['Hydraulics', /hydraulic/i],
];
const GENERIC = new Set(['senior', 'junior', 'level', 'temporary', 'casual', 'general', 'and', 'the', 'ii', 'iii', 'i', '1', '2', '3', '2025', '2026', 'overnight', 'light', 'duty', 'heavy', 'skilled', 'lead', 'worker', 'team', 'member', 'staff', 'person', 'part', 'time', 'full']);
const TERM_LABELS = new Set(TERMS.map(([label]) => label));

export function keywordsFor(job) {
  const body = jobBlocks(job.description || '', job.title)
    .map((b) => b.text || (b.items || []).map((i) => (typeof i === 'string' ? i : `${i.label}: ${i.value}`)).join('\n')).join('\n');
  const text = `${job.title}\n${body}`;
  const found = TERMS.filter(([, re]) => re.test(text)).map(([label]) => label);
  // A place after a dash isn't a skill ("General Labourers - Prince County"), so it's left out
  const role = job.title.split(/\s+[-–]\s*|\s*[-–]\s+/)[0];
  const titleWords = (role.match(/[A-Za-z][A-Za-z-]+/g) || [])
    .map((w) => w.toLowerCase().replace(/s$/, ''))
    .filter((w) => w.length > 2 && !GENERIC.has(w));
  return [...new Set([...titleWords.map((w) => w.charAt(0).toUpperCase() + w.slice(1)), ...found])].slice(0, 12);
}

// The same patterns, used to see whether a resume mentions each term
export function matchTerms(text, terms) {
  const t = String(text || '');
  return terms.map((term) => {
    const known = TERMS.find(([label]) => label === term);
    // Title words match on their stem, so "Operator" finds "operated" and "Labourer" finds "labour"
    const stem = term.slice(0, Math.max(5, term.length - 2)).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = known ? known[1] : new RegExp(`\\b${stem}`, 'i');
    return { term, found: re.test(t) };
  });
}

// ---- Which of our open jobs fit this resume ------------------------------
// For every job, how many of its terms the resume mentions. The job title's own words count
// double: a resume that says "forklift" fits a Forklift Operator job better than one that only
// shares "WHMIS". A job is listed when the resume covers a title word and about a third of the
// job's terms, or at least three terms of any kind.
// Jobs in the province the resume's address names get a small lift, so nearby fits come first.
const PROV_IN = [['NS', /nova scotia|\bNS\b|halifax|dartmouth|truro|sydney|bedford/], ['NB', /new brunswick|\bNB\b|moncton|saint john|fredericton|dieppe/],
  ['PE', /prince edward island|\bPEI?\b|charlottetown|summerside/], ['NL', /newfoundland|labrador|\bNL\b|st\.? john'?s|mount pearl/]];
export function rankJobs(text, jobs, n = 5) {
  const head = String(text).split('\n').slice(0, 6).join(' '); // the address is near the top
  const home = (PROV_IN.find(([, re]) => re.test(head)) || [])[0];
  return jobs.map((job) => {
    const m = matchTerms(text, job.terms);
    const title = m.filter((x) => !TERM_LABELS.has(x.term));
    const skills = m.filter((x) => TERM_LABELS.has(x.term));
    const th = title.filter((x) => x.found).length;
    const sh = skills.filter((x) => x.found).length;
    const fit = (th * 2 + sh) / Math.max(1, title.length * 2 + skills.length);
    const near = home && String(job.place || '').endsWith(home) ? 0.15 : 0;
    return { ...job, fit, rank: fit + near, titleHits: th, found: m.filter((x) => x.found).map((x) => x.term) };
  })
    .filter((r) => (r.titleHits > 0 && r.fit >= 0.35) || r.found.length >= 3)
    .sort((a, b) => b.rank - a.rank || b.found.length - a.found.length)
    .slice(0, n);
}
