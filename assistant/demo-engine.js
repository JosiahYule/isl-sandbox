// =====================================================================
// demo-engine.js: the conversation, without the AI.
//
// Until the AI backend is connected, this stands in for it. It can't
// understand language the way Claude does, so it uses rules: it looks for
// job words, places, numbers and phrases like "permanent" or "next week".
// What makes it feel like a conversation:
//
//   1. It re-reads the WHOLE conversation every turn, so it remembers.
//      "Warehouse work in Halifax" then "what about Moncton?" keeps "warehouse".
//   2. It only asks for what's missing, one question at a time, with
//      tap-to-answer options.
//   3. Each reply carries a little memo ("meta") saying what it just asked.
//      The widget sends that memo back with the next message, so a short
//      answer like "Not sure" can be read in context.
//   4. It only searches for words it knows are about work. The vocabulary is
//      built from the live job titles plus a list of everyday words below
//      (SYNONYMS), so "chef" finds cooks and "I like working with my hands"
//      finds the trades. A message it doesn't understand gets an honest
//      "I didn't catch that" with options, never a pretend job search.
//   5. It fixes small spelling mistakes ("warehose in halifx") against that
//      vocabulary and the town list, and reads common French.
//
// Who it talks to: job seekers, employers, and people already working through
// ISL (pay, T4s, hours, a missed shift, an injury), who are sent to their office.
//
// The job matching is real, and so is the contact routing (routing.js). So are
// the figures: pay on open jobs and the true cost of an employee come from
// insights.js, the same code the website's tools use. On a job page it answers
// questions about that posting from the posting itself. Only the wording is rule-based.
// =====================================================================
import { toCard, SITE, stemText, placesFor, provinceCode } from './jobs.js';
const PROVINCE_CODES = new Set(['NS', 'NB', 'PE', 'NL', 'QC', 'ON', 'MB', 'SK', 'AB', 'BC', 'YT', 'NT', 'NU']);
import { placeFrom, route, toContact, provinceName, OFFICES, TOWN_NAMES, DUTIES, officeFor } from './routing.js';
import { DIRECTORY } from './directory.js';
import { payFor, payInsight, costFor, costInsight, jobAnswer } from './insights.js';
import { familyOf } from './pay.js';
import { resolveCompensation, compensationRates } from './compensation.js';

// ---------- Small helpers ----------
const lower = (s) => String(s || '').toLowerCase().replace(/[’‘]/g, "'");
const pick = (options, seed) => options[seed % options.length];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const NUM_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const numberWord = (n) => (n >= 0 && n < NUM_WORDS.length ? NUM_WORDS[n] : String(n));
const plural = (n, one, many) => `${numberWord(n)} ${n === 1 ? one : many}`;
const list = (items) => (items.length < 2 ? items.join('') : items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1]);

// ---------- French: read it, reply in English ----------
// The replies are written in English, so French is translated into the English words the rules
// already understand. The first reply to a French message says so, in French.
const FRENCH_RE = /\b(je|j'|vous|nous|bonjour|salut|merci|emploi|emplois|travail|cherche|besoin|avez|entrep[oô]t|journaliers?|chauffeurs?|oui|est-ce|poste|postes|permis|postuler)\b/;
const FRENCH = [
  [/\bje (re)?cherche\b/g, "i'm looking for"], [/\b(un|une|des|du|d') ?(emplois?|travail|jobs?|postes?)\b/g, ' work'], [/\bemplois?\b/g, 'work'],
  [/\b(j'ai|nous avons|on a|j'aurais) besoin d[e']\s?/g, 'we need '], [/\b(nous|on) cherch(ons|e)\b/g, 'we need'], [/\b(embaucher|recruter)\b/g, 'hire'],
  [/\bentrep[oô]ts?\b/g, 'warehouse'], [/\b(journaliers?|man(oe|œ)uvres?)\b/g, 'labourers'], [/\b(chauffeurs?|camionneurs?)\b/g, 'drivers'],
  [/\bcuisinier(e)?s?\b/g, 'cooks'], [/\b(nettoyage|concierges?|pr[ée]pos[ée]s? (à|a) l'entretien)\b/g, 'cleaners'], [/\bcomptab(les?|ilit[ée])\b/g, 'accounting'],
  [/\b(adjointe?s? )?administrati(f|ve|on)\b/g, 'admin'], [/\br[ée]ceptionnistes?\b/g, 'receptionist'], [/\b(caristes?|chariot [ée]l[ée]vateur)\b/g, 'forklift'],
  [/\b(menuisiers?|charpentiers?)\b/g, 'carpenters'], [/\bsoudeurs?\b/g, 'welders'], [/\b[ée]lectriciens?\b/g, 'electricians'], [/\bm[ée]caniciens?\b/g, 'mechanics'],
  [/\bpermis de travail\b/g, 'work permit'], [/\bpermis d'[ée]tudes?\b/g, 'study permit'], [/\b[ée]tudiant(e)?s? [ée]tranger(e)?s?\b/g, 'international student'],
  [/\br[ée]sident(e)? permanent(e)?\b/g, 'permanent resident'], [/\bcitoyen(ne)? canadien(ne)?\b/g, 'canadian citizen'], [/\bpostuler\b/g, 'apply'],
  [/\bpaie\b/g, 'payroll'], [/\b(à|au|aux)\b/g, 'in'], [/\b(bonjour|salut)\b/g, 'hi'], [/\bmerci\b/g, 'thanks'], [/\b(à )?temps partiel\b/g, 'part time'],
  [/\b(temporaire|contractuel)s?\b/g, 'temporary'], [/\bavez-vous\b/g, 'do you have'], [/\bcombien\b/g, 'how much'], [/\bsalaire\b/g, 'pay'],
  [/\bdeux\b/g, 'two'], [/\btrois\b/g, 'three'], [/\bquatre\b/g, 'four'], [/\bcinq\b/g, 'five'], [/\bsix\b/g, 'six'], [/\bdix\b/g, 'ten'],
  [/\b[ée]t[ée]\b/g, 'summer'], [/\b(est-ce )?gratuit\b/g, 'is it free'],
];
const toEnglish = (t) => FRENCH.reduce((s, [re, en]) => s.replace(re, en), t).replace(/\s+/g, ' ');
const FRENCH_NOTE = 'Je comprends le français, mais pour l’instant je réponds en anglais. ';

// ---------- Spelling: fix small typos against known words ----------
// Edit distance: how many single-letter changes turn one word into the other ("halifx" -> "halifax" is 1).
function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}
// Only longer words (6+ letters) are corrected, only to a word starting with the same letter,
// and only when exactly one known word is that close. Short words are too easy to get wrong.
function correctSpelling(t, targets, known) {
  return t.replace(/[a-z][a-z']{5,}/g, (w) => {
    if (known.has(w)) return w;
    const max = w.length <= 7 ? 1 : 2;
    let best = null, bestD = max + 1, tie = false;
    for (const c of targets) {
      if (c[0] !== w[0] || Math.abs(c.length - w.length) > max) continue;
      const dd = distance(w, c);
      if (dd < bestD) { best = c; bestD = dd; tie = false; } else if (dd === bestD && c !== best) tie = true;
    }
    return best && !tie ? best : w;
  });
}

// ---------- Words about work ----------
// Words that are never search terms on their own, even when a job title contains them.
const STOP = new Set(("i im i'm am a an the and or but for to of in on at by with from near around any some looking look want wanting need needs " +
  'job jobs work working worker workers position positions role roles something anything find me my have has had experience experienced years year do does can ' +
  "could would like please hi hello hey there is are be what whats what's open opening openings available currently new get got also just really " +
  'very good great kind type sort full part time permanent perm temporary temp contract casual short long term about how else other only show ' +
  'instead area city town rural place places where everywhere nearby close closer us you your yes no okay ok thanks thank sure maybe right now ' +
  'seasonal days weeks months week month somewhere more next actually now then still asap urgent urgently hiring hire hired student students ' +
  'ticket licence license help apply level senior junior assistant international county prince saint john 2025 2026 heavy light duty skilled ' +
  'general trade services service team member people staff employee employees place company').split(/\s+/));

// Everyday words people use, and what they mean in the job feed.
//   kw:  words to look for in job titles and categories
//   fam: job families from pay.js (Drivers, Hospitality, Skilled trades...)
//   rel: a family to suggest when nothing matches exactly ("no receptionist roles, but these office roles are open")
//   label: how the reply names it ("warehouse roles", "entry-level roles")
const T = (label, kw = [], fam = [], rel = '') => ({ label, kw, fam, rel });
const WAREHOUSE = T('warehouse', ['warehouse', 'forklift', 'shipper', 'receiver', 'material handler', 'dock', 'inventory'], ['Warehouse and logistics']);
const OFFICE = T('office and admin', [], ['Office and administration']);
const DRIVING = T('driving', ['driver'], ['Drivers']);
const CLEANING = T('cleaning', ['cleaner', 'janitor', 'custodian'], [], 'General labour');
const LABOUR = T('general labour', [], ['General labour']);
const TRADES = T('skilled trades', [], ['Skilled trades']);
const ACCOUNTING = T('accounting and finance', ['accounting', 'accounts', 'payroll', 'tax', 'financial', 'bookkeeper', 'controller'], [], 'Office and administration');
const KITCHEN = T('kitchen', ['cook', 'kitchen', 'steward', 'dishwasher'], [], 'Hospitality');
const HOSPITALITY = T('hospitality', [], ['Hospitality']);
const MANAGEMENT = T('management', ['manager', 'supervisor', 'foreman', 'lead', 'director'], [], 'Professional and management');
const IT = T('IT', ['developer', 'software', 'systems', 'network', 'technology'], [], 'Professional and management');
const FARM = T('farm and harvest', ['harvest', 'harvester', 'cultivation', 'farm'], [], 'General labour');
const MANUFACTURING = T('manufacturing', ['assembler', 'manufacturing', 'production', 'material handler', 'kitting'], [], 'Skilled trades');
const SYNONYMS = {
  warehouse: WAREHOUSE, warehousing: WAREHOUSE, logistics: WAREHOUSE, shipping: WAREHOUSE, receiving: WAREHOUSE,
  forklift: T('forklift', ['forklift'], [], 'Warehouse and logistics'), inventory: T('inventory', ['inventory'], [], 'Warehouse and logistics'),
  office: OFFICE, admin: OFFICE, administrative: OFFICE, administration: OFFICE, clerical: OFFICE, secretary: OFFICE, clerk: OFFICE,
  reception: T('receptionist', ['reception', 'receptionist'], [], 'Office and administration'), receptionist: T('receptionist', ['reception', 'receptionist'], [], 'Office and administration'),
  driver: DRIVING, drivers: DRIVING, driving: DRIVING, trucking: DRIVING, trucker: DRIVING, truck: DRIVING, delivery: DRIVING, courier: DRIVING,
  cleaning: CLEANING, cleaner: CLEANING, cleaners: CLEANING, janitor: CLEANING, janitorial: CLEANING, custodian: CLEANING, custodial: CLEANING, housekeeping: CLEANING, housekeeper: CLEANING,
  construction: T('construction', ['construction', 'erector', 'foreman', 'carpenter', 'labourer'], [], 'Skilled trades'),
  labour: LABOUR, labor: LABOUR, labourer: LABOUR, laborer: LABOUR, labourers: LABOUR, laborers: LABOUR, labouring: LABOUR,
  trades: TRADES, tradesperson: TRADES, tradesman: TRADES, tradesmen: TRADES,
  carpenter: T('carpentry', ['carpenter'], [], 'Skilled trades'), carpenters: T('carpentry', ['carpenter'], [], 'Skilled trades'), carpentry: T('carpentry', ['carpenter'], [], 'Skilled trades'),
  electrician: T('electrical', ['electrician', 'electrical'], [], 'Skilled trades'), electrical: T('electrical', ['electrician', 'electrical'], [], 'Skilled trades'),
  welder: T('welding', ['welder', 'welding'], [], 'Skilled trades'), welding: T('welding', ['welder', 'welding'], [], 'Skilled trades'),
  plumber: T('plumbing', ['plumber', 'plumbing'], [], 'Skilled trades'), plumbing: T('plumbing', ['plumber', 'plumbing'], [], 'Skilled trades'),
  mechanic: T('mechanic', ['mechanic', 'mechanical', 'technician'], [], 'Skilled trades'), mechanical: T('mechanic', ['mechanic', 'mechanical', 'technician'], [], 'Skilled trades'),
  maintenance: T('maintenance', ['maintenance', 'technician', 'millwright'], [], 'Skilled trades'), technician: T('technician', ['technician'], [], 'Skilled trades'),
  accounting: ACCOUNTING, accountant: ACCOUNTING, accountants: ACCOUNTING, finance: ACCOUNTING, financial: ACCOUNTING, bookkeeping: ACCOUNTING, bookkeeper: ACCOUNTING, cpa: ACCOUNTING, tax: ACCOUNTING,
  payroll: T('payroll', ['payroll'], [], 'Office and administration'),
  kitchen: KITCHEN, cook: KITCHEN, cooks: KITCHEN, cooking: KITCHEN, chef: KITCHEN, chefs: KITCHEN, culinary: KITCHEN, food: KITCHEN, dishwasher: KITCHEN, restaurant: KITCHEN,
  hospitality: HOSPITALITY, events: HOSPITALITY, event: HOSPITALITY, banquet: HOSPITALITY, server: HOSPITALITY, servers: HOSPITALITY, serving: HOSPITALITY,
  waiter: HOSPITALITY, waitress: HOSPITALITY, bartender: HOSPITALITY, catering: HOSPITALITY, hotel: HOSPITALITY,
  management: MANAGEMENT, manager: MANAGEMENT, managers: MANAGEMENT, managerial: MANAGEMENT, supervisor: MANAGEMENT, supervisory: MANAGEMENT, leadership: MANAGEMENT,
  professional: T('professional', [], ['Professional and management']), corporate: T('professional', [], ['Professional and management']),
  engineering: T('engineering', ['engineer'], [], 'Professional and management'), engineer: T('engineering', ['engineer'], [], 'Professional and management'),
  architect: T('architecture', ['architect'], [], 'Professional and management'), architecture: T('architecture', ['architect'], [], 'Professional and management'),
  recruitment: T('HR and recruitment', ['recruitment', 'recruiter', 'human resources'], [], 'Office and administration'), recruiter: T('HR and recruitment', ['recruitment', 'recruiter', 'human resources'], [], 'Office and administration'),
  recruiting: T('HR and recruitment', ['recruitment', 'recruiter', 'human resources'], [], 'Office and administration'), hr: T('HR and recruitment', ['recruitment', 'recruiter', 'human resources'], [], 'Office and administration'),
  farm: FARM, farming: FARM, agriculture: FARM, harvest: FARM, harvesting: FARM, harvester: FARM, cultivation: FARM, greenhouse: FARM,
  landscaping: T('landscaping', ['landscape'], [], 'General labour'), landscaper: T('landscaping', ['landscape'], [], 'General labour'), gardening: T('landscaping', ['landscape'], [], 'General labour'),
  garbage: T('waste and recycling', ['garbage', 'recycling', 'waste'], [], 'General labour'), recycling: T('waste and recycling', ['garbage', 'recycling', 'waste'], [], 'General labour'), waste: T('waste and recycling', ['garbage', 'recycling', 'waste'], [], 'General labour'),
  manufacturing: MANUFACTURING, factory: MANUFACTURING, production: MANUFACTURING, assembly: MANUFACTURING, assembler: MANUFACTURING,
  security: T('security', ['security', 'guard']), guard: T('security', ['security', 'guard']),
  sales: T('sales', ['sales', 'territory']), retail: T('retail', ['retail', 'sales']),
  developer: IT, programmer: IT, software: IT, computer: IT, network: IT, tech: IT,
  healthcare: T('healthcare', ['nurse', 'care', 'health']), nurse: T('healthcare', ['nurse', 'care', 'health']), nursing: T('healthcare', ['nurse', 'care', 'health']),
};
// Phrases, checked before single words.
const PHRASES = [
  [/\bclass ?[1-5][a-z]?\b|\b[ad]z licen[cs]e\b|\bcdl\b/, DRIVING],
  [/\bcustomer (service|support|care)\b|\bcall cent(re|er)\b|\bcontact cent(re|er)\b/, T('customer service', ['customer', 'call centre'], [], 'Office and administration')],
  [/\bgeneral labou?r(er)?s?\b/, LABOUR],
  [/\bline cooks?\b|\bprep cooks?\b/, KITCHEN],
  [/\bhuman resources\b/, SYNONYMS.hr],
  [/\bno (work )?experience\b|\bno exp\b|\bentry[- ]level\b|\bfirst job\b|\bstarter job\b|\bjust starting out\b/, { ...T('entry-level', [], ['General labour', 'Hospitality', 'Warehouse and logistics']), entry: true }],
  [/\b(with|using) my hands\b|\bhands[- ]on\b|\bphysical (work|job)\b/, T('hands-on', [], ['Skilled trades', 'General labour'])],
  [/\bforklift (ticket|licen[cs]e|certifi\w*|operators?|drivers?)\b/, SYNONYMS.forklift],
  [/\b(it|tech) (jobs?|work|support|roles?|positions?)\b|\binformation technology\b/, IT],
  [/\bfront desk\b/, SYNONYMS.reception],
];
// Things about the work itself, found in the posting's text
const ATTRS = {
  night: { re: /\b(night shift|nights|overnight|evening shift|evenings|graveyard)\b/, test: /\b(night|nights|overnight|evening|evenings|graveyard)\b/i, label: 'night-shift' },
  weekend: { re: /\bweekends?( only)?\b/, test: /\bweekends?\b/i, label: 'weekend' },
  part: { re: /\bpart[- ]?time\b/, test: /\bpart[- ]?time\b/i, label: 'part-time' },
  remote: { re: /\b(work from home|remote( work| jobs?)?|wfh|from home|online jobs?|hybrid)\b/, test: /\b(work from home|remote work|work remotely|fully remote|remote position|hybrid)\b/i, label: 'remote' },
};
// "over $25 an hour", "at least 20/hr", "$60,000 a year or more"
function readMinPay(t) {
  const m = t.match(/\b(over|above|more than|at least|minimum( of)?|min|starting at|no less than|paying|pays?)\s*\$?\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\s*(k\b)?\s*(\+)?\s*(an hour|\/ ?hr|\/ ?hour|per hour|hourly|an hr|a year|\/ ?year|per year|annually|yearly)?/)
    || t.match(/\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\s*(k\b)?\s*(\+|or more|and up|plus)\s*(an hour|\/ ?hr|\/ ?hour|per hour|hourly|a year|\/ ?year|per year|annually)?/);
  if (!m) return null;
  const raw = m[3] && /^\d/.test(m[3]) ? m : null;
  const numStr = raw ? m[3] : m[1];
  let v = Number(String(numStr).replace(/,/g, ''));
  if ((raw ? m[4] : m[2])) v *= 1000;
  const unit = /year|annual/.test(m[0]) || v >= 1000 ? 'year' : 'hour';
  if (unit === 'hour' && (v < 10 || v > 200)) return null;
  return { value: v, unit };
}
const hourlyOf = (job) => {
  const r = compensationRates(job.pay || '')[0];
  if (!r) return null;
  return r.unit === 'hour' ? r.max : r.max / 2080;
};

// The vocabulary for this job feed: every useful word in the job titles and categories,
// plus the everyday words above. Built once per feed and remembered.
const vocabCache = new WeakMap();
function vocabularyFor(jobs) {
  let v = vocabCache.get(jobs);
  if (v) return v;
  const placeWords = new Set(TOWN_NAMES.flatMap((n) => n.split(/[\s.-]+/)).concat(['nova', 'scotia', 'brunswick', 'edward', 'island', 'newfoundland', 'labrador', 'pei', 'atlantic', 'canada']));
  const titleWords = new Set();
  for (const j of jobs) {
    for (const w of lower(`${j.title} ${j.category} ${j.subcategory}`).replace(/[^a-z ]+/g, ' ').split(/\s+/)) {
      if (w.length > 2 && !STOP.has(w) && !placeWords.has(w)) titleWords.add(w);
    }
  }
  const stems = new Set([...titleWords].map((w) => stemText(w).trim()));
  const townWords = TOWN_NAMES.filter((n) => !/\s/.test(n)).map((n) => n.replace(/[.']/g, ''));
  const targets = [...new Set([...titleWords, ...Object.keys(SYNONYMS), ...townWords, 'scotia', 'brunswick', 'newfoundland', 'labrador', 'edward'])].filter((w) => w.length >= 5);
  v = { titleWords, stems, placeWords, targets, known: new Set([...targets, ...STOP]) };
  vocabCache.set(jobs, v);
  return v;
}

// What kind of work does this message ask for?
//   -> { labels: ['warehouse'], kw: [...], fam: [...], rel: 'Office and administration', entry, attrs: Set, minPay }
function jobTermsOf(t, original, vocab) {
  const out = { labels: [], named: [], kw: [], fam: [], rel: '', entry: false };
  let rest = ` ${t} `;
  for (const [re, term] of PHRASES) {
    const src = re === PHRASES[8][0] ? original : t; // "IT jobs": only when written as a word, not "it"
    const m = (re === PHRASES[8][0] ? new RegExp(re.source) : re).exec(re === PHRASES[8][0] ? src.replace(/\bIT\b/g, 'it').toLowerCase() : src);
    if (!m) continue;
    if (re === PHRASES[8][0] && !/\bIT\b|\btech\b|information technology/.test(original)) continue;
    add(out, term);
    rest = rest.replace(new RegExp(re.source, 'g'), ' ');
  }
  for (const w of rest.replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/)) {
    if (!w || STOP.has(w) || vocab.placeWords.has(w)) continue;
    if (SYNONYMS[w]) { add(out, SYNONYMS[w]); continue; }
    if (w.length > 2 && vocab.stems.has(stemText(w).trim())) add(out, { ...T(w, [w]), raw: true });
  }
  // Name it with the everyday words when there are any ("forklift", not "forklift and operator")
  if (out.named.length) out.labels = out.labels.filter((l) => out.named.includes(l));
  return out;
}
function add(out, term) {
  if (!out.labels.includes(term.label)) out.labels.push(term.label);
  if (!term.raw && !out.named.includes(term.label)) out.named.push(term.label);
  out.kw.push(...term.kw.filter((k) => !out.kw.includes(k)));
  out.fam.push(...term.fam.filter((f) => !out.fam.includes(f)));
  if (term.rel && !out.rel) out.rel = term.rel;
  if (term.entry) out.entry = true;
}
const hasTerms = (terms) => !!(terms && (terms.kw.length || terms.fam.length));
const termLabel = (terms) => (terms?.labels.length ? terms.labels.slice(0, 2).join(' or ') : '');

// Does this job fit? Title or category words, or the job's family.
const jobStems = new WeakMap();
function fits(job, terms) {
  if (!hasTerms(terms)) return true;
  if (terms.fam.includes(familyOf(job.title))) return true;
  let s = jobStems.get(job);
  if (!s) { s = stemText(`${job.title} ${job.category} ${job.subcategory}`); jobStems.set(job, s); }
  return terms.kw.some((k) => s.includes(stemText(k)));
}

// ---------- Who is talking: employer or job seeker? ----------
const COUNT = String.raw`(?:\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|a few|few|several|a couple(?: of)?|couple(?: of)?|a dozen|some|extra|more)`;
const PEOPLE_WORDS = String.raw`(?:staff|people|help|guys|folks|bodies|(?:worker|employee|temp|hand|labou?rer|driver|operator|cook|cleaner|welder|carpenter|electrician|server|picker|packer|receptionist|assistant|accountant|bookkeeper|technician|mechanic|guard|agent|rep|associate|landscaper|harvester|mover|helper|controller|manager|supervisor|millwright|engineer|cfo|admin|architect|designer|analyst|coordinator|consultant|nurse|inspector|estimator|drafter|planner|officer|specialist|director|executive|administrator|technologist|scientist|advisor|adviser|representative|clerk|buyer|dispatcher|machinist|installer|painter|plumber|roofer|framer|mason|surveyor|paralegal|lawyer|pharmacist|therapist|superintendent|developer|programmer|recruiter|marketer|writer|trainer|instructor|teacher|caregiver|aide|tech|hygienist)s?)(?!\s+(?:job|jobs|work|position|positions|role|roles|opening|openings)\b)`;
const EMPLOYER_RE = new RegExp([
  String.raw`\b(i'?m|we'?re|i am|we are|currently|company is|business is|still) hiring\b`,
  String.raw`\b(looking|want|need|trying|planning) to (hire|fill|staff|recruit)\b`,
  String.raw`\bhire (a|an|some|\d|two|three|four|five|people|staff|workers|someone|for)\b`,
  String.raw`\b(need|needs|looking for|want|require|requires|could use)\s+(${COUNT}\s+)?(\w+\s+){0,2}${PEOPLE_WORDS}\b`,
  String.raw`\b${COUNT}\s+(\w+\s+){0,2}${PEOPLE_WORDS}\b.*\b(in|for|at|by|next|this|starting|asap)\b`,
  String.raw`\b(our|my) (company|business|team|site|warehouse|plant|store|restaurant|office|crew|shop) (needs|is short|is looking)\b`,
  String.raw`\b(fill|filling) (a|an|the|our) (role|position|vacancy|seat)\b`,
  String.raw`\b(staffing|recruit(ing|ment)?) (for|help|partner|agency)\b`,
  String.raw`\bfor my (company|business)\b`,
  String.raw`\bsend (me|us|over) (${COUNT}\s+)?(\w+\s+){0,2}(guys|people|workers|hands|help|staff|temps|bodies)\b`,
  String.raw`\bshort[- ]?(staffed|handed)\b|\bshort (on|of) (staff|people|workers|help|hands)\b`,
  String.raw`\b(going|go|off) on (mat|maternity|parental|sick|medical|stress) leave\b|\bcover (for )?(a |her |his |their |the )?(leave|vacation|absence)\b`,
  String.raw`\bdo you have (any )?(\w+\s+){0,2}${PEOPLE_WORDS}\s+(available|for hire|ready)\b`,
  String.raw`\bexecutive search\b|\bheadhunt`,
  String.raw`\b(contract|temp|temporary|permanent) (\w+\s+)?${PEOPLE_WORDS}\s+(in|for|at|to)\b`,
  String.raw`\bwe('re| are)? (need|needs|require|are looking for|looking for)\b(?!.*\b(job|jobs|work|employment)\b)`,
].join('|'), 'i');
const SEEKER_RE = /\b(i'?m|i am) (looking for|after|seeking) (a |some )?(job|work|position|role|employment)\b|\b(find|get|need|want|looking for) (a |some )?(new )?(job|work)\b|\bjob for me\b|\bmy resume\b|\bare you hiring\b|\bi'?m looking for work\b|\bjobs? (in|near|around|for)\b|\bwork (in|near|around)\b|\b(any|what|which) (jobs|openings|positions|work)\b|\bjobs? (available|open)\b|\bjob hunting\b|\b(laid off|unemployed|out of work|between jobs)\b/i;

// ---------- Employer: which role ----------
const ROLES = [
  [/general labou?r(ers?)?|labou?rers?|labou?r\b/, 'labourer', 'labourers'],
  [/demo(lition)?\b/, 'demolition labourer', 'demolition labourers'],
  [/forklift( operators?| drivers?)?/, 'forklift operator', 'forklift operators'],
  [/warehouse (workers?|staff|associates?|help|people)|warehouse/, 'warehouse worker', 'warehouse workers'],
  [/pick(ers?|ing)|pack(ers?|ing)/, 'picker and packer', 'pickers and packers'],
  [/shippers?|receivers?/, 'shipper and receiver', 'shippers and receivers'],
  [/class [13] drivers?|truck drivers?|delivery drivers?|drivers?/, 'driver', 'drivers'],
  [/welders?/, 'welder', 'welders'], [/carpenters?/, 'carpenter', 'carpenters'], [/electricians?/, 'electrician', 'electricians'],
  [/millwrights?/, 'millwright', 'millwrights'], [/mechanics?|technicians?/, 'technician', 'technicians'],
  [/line cooks?|cooks?|chefs?/, 'cook', 'cooks'], [/dishwashers?/, 'dishwasher', 'dishwashers'],
  [/servers?|banquet staff|event staff/, 'event and banquet staff member', 'event and banquet staff'],
  [/cleaners?|janitors?|custodians?/, 'cleaner', 'cleaners'],
  [/receptionists?|front desk/, 'receptionist', 'receptionists'],
  [/admin(istrative)? (assistants?|staff|support)|office (assistants?|staff|admin)|admin/, 'administrative assistant', 'administrative staff'],
  [/data entry/, 'data entry clerk', 'data entry clerks'],
  [/customer service|call centre|call center|contact centre|csrs?/, 'customer service rep', 'customer service reps'],
  [/bookkeepers?/, 'bookkeeper', 'bookkeepers'], [/payroll/, 'payroll administrator', 'payroll administrators'],
  [/cfos?\b|chief financial officers?|finance directors?|directors? of finance/, 'CFO', 'CFOs'],
  [/controllers?/, 'controller', 'controllers'], [/accountants?|cpas?/, 'accountant', 'accountants'],
  [/engineers?/, 'engineer', 'engineers'], [/project managers?/, 'project manager', 'project managers'],
  [/(plant|operations|general|office|sales|warehouse|store|branch|site|production|shop|restaurant|account|marketing|hr|finance) managers?/, 'KEEP'],
  [/managers?/, 'manager', 'managers'],
  [/((senior|junior|intermediate|lead|chief|head|principal|staff|registered|licensed|certified)\s+)?(?!(?:a|an|the|some|any|our|my|need|needs|hire|hiring|for|of|to|in|we|i)\s)([a-z]+\s+)?(architects?|designers?|analysts?|coordinators?|consultants?|nurses?|inspectors?|estimators?|drafters?|draftspersons?|planners?|officers?|specialists?|directors?|executives?|administrators?|technologists?|scientists?|advisors?|advisers?|representatives?|clerks?|buyers?|dispatchers?|machinists?|installers?|painters?|plumbers?|roofers?|framers?|bricklayers?|masons?|surveyors?|paralegals?|lawyers?|pharmacists?|therapists?|superintendents?|developers?|programmers?|recruiters?|marketers?|writers?|trainers?|instructors?|teachers?|caregivers?|aides?)/, 'KEEP'],
  [/supervisors?|foreman|foremen|leads?\b/, 'supervisor', 'supervisors'],
  [/developers?|it (staff|support|people)|programmers?/, 'IT professional', 'IT professionals'],
  [/sales (reps?|people|staff)|salespeople/, 'sales rep', 'sales reps'],
  [/security( guards?)?/, 'security guard', 'security guards'],
  [/landscapers?|grounds/, 'landscaper', 'landscapers'], [/harvesters?|farm (workers?|hands?)/, 'farm worker', 'farm workers'],
  [/movers?/, 'mover', 'movers'],
  [/(workers|staff|people|employees|help|hands|temps|guys|folks)\b/, 'worker', 'workers'],
];
const COUNT_VALUES = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, dozen: 12 };

function readRole(text) {
  const t = lower(text);
  for (const [re, oneLabel, manyLabel] of ROLES) {
    const m = t.match(new RegExp(String.raw`(?:^|[^a-z])(${re.source})`));
    if (!m) continue;
    // "a plant manager", "a senior architect": keep their exact words
    const words = m[1].trim();
    const one = oneLabel === 'KEEP' ? words.replace(/(ss)?es$/, (e, ss) => (ss ? 'ss' : 'e')).replace(/([^s])s$/, '$1').replace(/persons$/, 'person') : oneLabel;
    const many = oneLabel === 'KEEP' ? (/s$/.test(words) ? words : words + 's') : manyLabel;
    // Look just before the role for a number: "3 labourers", "two class 1 drivers", "a controller"
    const before = t.slice(0, m.index + m[0].indexOf(m[1])).trim().split(/\s+/).slice(-3);
    let count = null;
    for (const w of before.reverse()) {
      if (/^\d{1,3}$/.test(w)) { count = Number(w); break; }
      if (COUNT_VALUES[w]) { count = COUNT_VALUES[w]; break; }
      if (/^(few|several|couple)$/.test(w)) { count = 'several'; break; }
    }
    const generic = one === 'worker';
    const isPlural = /(s|staff|admin|help|people|foremen|guys|folks)$/.test(m[1].trim()) || (m[1].trim() === 'warehouse' && count === null);
    return { one, many: m[1].trim() === 'warehouse' ? 'warehouse staff' : many, count, generic, plural: isPlural };
  }
  return null;
}

// What's left of "we need 2 site supers in Saint John for 6 months, asap" once the place, the
// timing and the filler are taken out: "site supers". Used only when no known role matched.
function roleWords(t, place) {
  let r = ' ' + t + ' ';
  if (place) for (const w of [place.city, place.label, provinceName(place.province)].filter(Boolean)) r = r.replace(new RegExp(lower(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), ' ');
  r = r.replace(/\b(hi|hello|hey|please|thanks|i|we|we'?re|i'?m|our|my|need|needs|needed|want|wants|looking|look|for|hire|hiring|to|a|an|the|some|someone|somebody|who|can|could|you|help|us|me|in|at|on|near|around|by|from|rural|asap|as soon as possible|urgently|urgent|right away|immediately|next|this|week|month|start(ing)?|contract|temp(orary)?|permanent(ly)?|perm|full[- ]time|part[- ]time|direct hire|seasonal|short[- ]term|long[- ]term|days?|weeks?|months?|years?|\d+|one|two|three|four|five|six|seven|eight|nine|ten|few|several|couple|of|and|or|elsewhere|canada|province|area|is|are|be|do|does|have|has|get|find|recruit|fill|role|position|job|it|that|there|with|just|currently|also|more|extra|staff)\b/g, ' ');
  r = r.replace(/[^a-z' -]/g, ' ').replace(/\s+/g, ' ').trim();
  return r && r.split(' ').length <= 4 && /[a-z]{3}/.test(r) ? r : '';
}
function readCount(t) {
  const m = t.match(/\b(\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty)\b/);
  if (!m) return /\b(a few|several|a couple)\b/.test(t) ? 'several' : null;
  return /^\d/.test(m[1]) ? Number(m[1]) : COUNT_VALUES[m[1]] ?? null;
}

// ---------- Employer: contract or permanent, and when ----------
function readService(text, asked) {
  const t = lower(text);
  if (/\bnot sure\b|\bunsure\b|\bdon'?t know\b|\bhelp me decide\b|\beither\b/.test(t) && asked === 'service') return 'unsure';
  if (/\btemp[- ]?to[- ]?perm\b|\btry (them|someone|before)|\bsee (them|someone) work|\bthen hire\b/.test(t)) return 'temp-to-perm';
  if (/\bperm(anent(ly)?)?\b|\bdirect hire\b|\bfull[- ]time (hire|role|position|employee)|\blong[- ]term hire\b|\bkey hire\b|\bon (our|my) payroll\b|\bexecutive search\b|\bheadhunt/.test(t)) return 'direct';
  if (/\btemp(orary)?\b|\bcontract\b|\bseasonal\b|\bshort[- ]term\b|\bset (stretch|time|period)\b|\bcover(age|ing)?\b|\bleave\b|\bfor (the )?(summer|season|holidays|winter|fall)\b|\bfor \w+ (days|weeks|months)\b|\b\d+ (days|weeks|months)\b|\bpeak\b|\bproject\b/.test(t)) return 'contract';
  return null;
}
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
function readStart(text) {
  const t = lower(text);
  if (/\basap\b|as soon as|right away|immediately|urgent|tomorrow|today|tonight|this week|monday|tuesday|wednesday|thursday|friday|yesterday/.test(t)) return 'As soon as possible';
  const month = MONTHS.find((m) => new RegExp(`\\b${m}\\b`).test(t) && !(m === 'may' && /\bmay (i|we|be|have|need)\b/.test(t)));
  if (month) return `In ${cap(month)}`;
  if (/next week|few weeks|couple (of )?weeks|two weeks|\b\d+ weeks\b|next month|in a month/.test(t)) return 'In the next few weeks';
  if (/planning|no rush|not urgent|later|down the road|ahead|in the (spring|summer|fall|winter)|for the (fall|spring|summer|winter)/.test(t)) return 'Planning ahead';
  return null;
}

// ---------- Questions people ask along the way ----------
// Checked in this order; the first that fits wins. They're read from the visitor's own words
// (before spelling correction), so "I moved" never turns into "mover".
const FAQ = [
  // People already working through ISL
  ['w-hurt', /\b(hurt|injur(ed|y|ies)|accident)\b.*\b(work|job|site|shift)\b|\bgot hurt\b|\bi'?m injured\b|\bhurt myself\b/],
  ['w-absent', /\b(i'?m|i am) (sick|ill|unwell)\b|\bcall(ing)? in sick\b|\bcan'?t (make|come|work|do) (it|in|my|the|today|tomorrow)|\bwon'?t (make|be (in|able|there))|\brunning late\b|\b(be|i'?ll be|i'?m) late (for|to)\b|\bmiss(ing)? (my )?shift\b/],
  ['w-pay', /\b(didn'?t|did not|haven'?t|have not|never) (get|been|got|received?) (paid|my pay|my cheque|my check|my money)|\bmissing (pay|hours|money)\b|\bpay ?(stub|cheque|check|slip|statement)s?\b|\bpayslips?\b|\bdirect deposit\b|\bshort on my pay\b|\bwrong (pay|amount)\b|\bwhen is pay ?day\b|\bmy pay\b/],
  ['w-tax', /\bt4a?s?\b|\btax (slip|form)s?\b|\brecord of employment\b|\broe\b/],
  ['w-time', /\b(submit|send|enter|log|report|hand in|fill (in|out)) (my )?(hours|time|timecard|time card|timesheet|time sheet)\b|\btime ?(card|sheet)s?\b/],
  ['w-quit', /\bquit (my|the) (job|assignment|placement)\b|\b(leave|end|finish) my (assignment|placement)\b|\bi want to quit\b|\bresign\b/],
  ['w-portal', /\b(log ?in|sign ?in|password|portal)\b/],
  ['w-general', /\b(i|i'?m|i am) (currently |already |now )?(work|working|placed|on (an )?assignment) (for|with|through|at|by) (isl|you|integrated|your (company|agency))\b|\bmy (assignment|placement)\b|\bi work with isl\b/],
  // Checking a message is really from ISL
  ['scam', /\b(scam|fake|legit|legitimate|fraud|phishing)\b|\bis (this|that|it) (really )?(you|real|from you)\b|\b(text|texted|message|messaged|email|emailed|whatsapp|telegram|called)\b.*\b(real|you guys|from you|from isl|from integrated)\b/],
  // "Who's in charge of marketing?", "who do I talk to about partnerships?"
  ['who', /\bwho (is|are|'s|s) (the |your |isl'?s )?(ceo|president|owners?|boss|founders?|partners?|head|director|leader|leadership|manager|gm)\b|\bwho owns\b|\bwho\b.*\b(in charge|responsible|handles?|runs?|manages?|oversees?|looks after|leads?|deals with|takes care of|is the (head|director|manager|lead)|(do|should|can|would) i (talk|speak|reach out|go|write) to|(do|should|can|would) i (contact|email|call|ask)|to (talk|speak) to)\b|\b(in charge of|responsible for|head of|director of)\b|\b(contact|person|someone|somebody) (for|about|regarding|in charge of)\b/],
  // Reaching a person or an office
  ['human', /\b(real|actual|live) (person|human|people)\b|\b(talk|speak|chat) (to|with) (a |an )?(someone|somebody|person|human|recruiter|agent|rep|representative|manager)\b|\b(call|phone|ring) me\b|\bhuman\b|\brepresentative\b/],
  ['officehours', /\b(office|opening|business|store) hours\b|\bwhen (are|is) (you|the office) open\b|\bwhat time (do|does) (you|the office|it) (open|close)\b|\bare you open\b/],
  ['officewhere', /\bwhere (is|are) (your|the|you)( \w+)? (office|offices|located|location)\b|\bwhere are you( guys)?( located| based)?\b|\b(office )?address(es)?\b|\b(closest|nearest) office\b|\boffice (near|close to|in)\b|\bdrop (by|in)\b|\bvisit (you|your office|the office)\b/],
  ['contact', /\b(phone number|your number|contact (info|information|details|number|you)|call you|email address|your email|reach you|get in touch)\b/],
  // Employers' questions
  ['e-canada', /\b(place|send|provide|supply|staff)\b.*\b(anywhere|across|all over|outside|other parts of)\b.*\b(canada|atlantic|country|provinces?)\b|\bdo you (work|operate|cover) (outside|across|anywhere)/],
  ['e-howcontract', /\bhow (does|do) (contract|temp(orary)?) (staffing|work|workers|placements?|hiring)\b|\bhow does (it|this) work for (employers|businesses|companies|us)\b|\bwhat is contract staffing\b/],
  ['e-diff', /\bdifference between\b|\bcontract (or|vs\.?|versus) (perm|permanent|direct)|\b(perm|permanent|direct hire) (or|vs\.?|versus) (contract|temp)/],
  ['e-guarantee', /\bguarantee|\breplacement (policy|period)\b|\b(doesn'?t|does not|didn'?t) work out\b|\bnot (a good |the right )?fit\b/],
  ['e-speed', /\bhow (fast|quickly|soon) can you\b|\bhow long (does it|will it|would it) take (you )?to (find|fill|get(?! (placed|a job|hired|work|an interview))|hire|send)\b|\bturnaround\b/],
  ['e-payrolling', /\bpayroll(ing)? (for|services?|our)\b|\bhandle (our )?payroll\b|\bpayrolling\b|\bput (them|our staff|people) on your payroll\b/],
  ['e-existing', /\b(existing|current) (client|customer|account)\b|\bmy (rep|account manager|account rep)\b|\bour (rep|account|account manager)\b|\binvoices?\b|\bbilling\b|\bapprove (a |the )?(timesheet|time ?card|hours)\b/],
  // Jobs on ISL's own team
  ['isljobs', /\b(jobs?|work(ing)?|careers?|positions?|openings?|employment) (at|for|with) (isl|integrated staffing|your (company|office|team|agency))( itself)?\b|\bjoin (your|the isl|isl'?s|the) team\b|\bwork for you guys\b|\bwork(ing)? at your (office|company)\b|\binternal (jobs|positions|openings)\b/],
  // Everyone
  ['count', /\bhow many (jobs|openings|positions|postings|roles)\b/],
  ['apply', /\bhow (do|can) i apply\b|\bapply(ing)? (for|to)\b|\bapplication process\b|\bwhere (do|can) i apply\b/],
  ['status', /\b(status|heard back|hear back|update) (of|on|about)? ?(my )?(application|resume)|\bdid you (get|receive) my\b|\bapplied (last|a few|yesterday|on|for)\b|\bhaven'?t heard (back|anything)\b/],
  ['fees', /\b(cost|charge|fee|fees|pay you|free)\b.*\b(me|job seekers?|to apply|candidates?|workers?)\b|\bdo i (have to )?pay\b|\bis it free\b|\bis there a fee\b/],
  ['price', /\b(how much|cost|rates?|pricing|price|fee|fees|markup|mark-up|charge)\b/],
  ['pay', /\b(pay|wage|wages|salary|how much (does|do|will) (it|they|i))\b/],
  // Who ISL can place: Canadian citizens and permanent residents only
  ['eligible-yes', /\b(i'?m|i am|i'?ve become|i became) (a )?(canadian( citizen)?|citizen|permanent resident|pr)\b|\bi (have|got) (my )?(pr|permanent residen(ce|cy)|citizenship|pr card)\b/],
  ['eligible-no', /\b(work|study|student|open work) permit\b|\bvisa\b|\blmia\b|\bsponsor(ship|ing)?\b|\binternational student\b|\btemporary (resident|foreign worker)\b|\b(not|no|am not|i'?m not) (a )?(canadian( citizen)?|citizen|permanent resident)\b|\b(don'?t|do not) have (my )?(pr|permanent residen(ce|cy)|citizenship)\b|\brefugee\b|\basylum\b|\bworking holiday\b|\bpgwp\b/],
  ['eligible-ask', /\b(do|must) i (need|have) to be (a )?(canadian|citizen|permanent resident)\b|\b(citizens?|permanent residents?|citizenship|pr) (only|required|needed)\b|\bwho (can|is able to) (apply|work)\b|\b(am i|are you) eligible\b|\bpr card\b|\bpermanent resident\b|\bcitizenship\b/],
  ['permit', /\bsin number\b/],
  ['recruiter', /\bdrug (test|testing|screen)|\bbackground check|\bcriminal (record|background) check|\bpolice check|\bhow (often|when) (do|will) (you|i|we) (get )?paid\b|\bpay ?day\b|\bhow long (does it|will it) take (to|for)\b|\bhow (old|young)\b|\bminimum age\b|\b(i'?m|i am) 1[3-7]\b/],
  ['interview', /\binterview\b.*\b(tips|advice|prepare|help|ready)\b|\bhow (do|should) i prepare\b/],
  ['newcomer', /\b(just )?(moved|arrived|came|immigrated) (here|to canada|to nova scotia|to new brunswick|to pei|to newfoundland|to halifax|to moncton|from)\b|\bnewcomer\b|\bnew to canada\b|\bimmigrant\b/],
  ['about', /\bwhat (is|does) (isl|integrated staffing)|\bwho are you\b|\bwhat do you do\b|\bhow does (this|it|isl) work\b/],
  ['resumecheck', /\b(check|review|improve|fix|look at|rate|score|feedback on|help with) (my |a )?(resume|cv)\b|\b(resume|cv) (check|review|tips|help|feedback)\b/],
  ['jobad', /\b(check|review|improve|write|fix|feedback on|help with) (my |our |a |this )?(job )?(ad|advert|posting|job description)\b|\bjob (ad|posting) (check|review|help|feedback)\b/],
  ['resume', /\bsend (my|a) resume\b|\bgeneral appli|\b(drop off|bring( in)?|hand in) (my |a )?resume\b|\bresume\b/],
  ['thanks', /^(thanks|thank you|thx|ty|cheers|great,? thanks|perfect,? thanks|awesome,? thanks|that'?s (great|perfect|all)|ok thanks|okay thanks|bye|goodbye)\b/],
  ['ack', /^(ok|okay|k|kk|cool|got it|sounds good|alright|all right|nice|great|good|sure|yep|yes|yeah|ya|no|nope|nah|perfect|awesome|👍|🙂|😊)[.! ]*$/u],
  ['hello', /^(hi|hello|hey|hiya|howdy|good (morning|afternoon|evening)|bonjour|salut)( there)?[!. ]*$/],
  ['howareyou', /\bhow are you\b|\bhow'?s it going\b|\bhow are things\b/],
  ['bot', /\bare you (a |an )?(bot|robot|real|human|ai|person)\b|\bwho am i (talking|speaking) (to|with)\b/],
  ['joke', /\b(tell|know) (me )?(a |any )?jokes?\b|\bmake me laugh\b/],
  ['upset', /\b(useless|stupid|dumb|doesn'?t work|not working|not helpful|unhelpful|waste of (my )?time|terrible|awful|you suck|garbage bot|so annoying)\b/],
  ['more', /^(show )?(me )?(more|next|other ones|any others|more (jobs|results|options))\b|\bshow (me )?more\b/],
  ['restart', /^(start over|restart|reset|new search|start again)\b/],
  ['elsewhere', /^somewhere else\b|\bdifferent (city|area|place|location)\b/],
  ['otherwork', /^other kinds of work\b|^something else\b|^different (work|job)\b/],
  ['otherplace', /^(other|another place|other place|somewhere not listed)$/],
];
const faqOf = (text) => (FAQ.find(([, re]) => re.test(lower(text).trim())) || [])[0] || null;

// ---------- Questions the data can answer ----------
// "What do forklift operators make?", "What would one cost me?", and on a job page,
// "What are the hours?". These are answered from data, not by searching.
const PAY_Q = /\b(what|how much)\b.*\b(pay|pays|paid|make|makes|earn|earns|wages?|salary|salaries|rate)\b|\b(pay|wages?|salary|salaries) (for|of|on)\b|\bwhat (do|does|would|should) (i|we) (offer|pay)\b/;
const COST_Q = /\btrue cost\b|\bcost to (employ|have|keep)\b|\bwhat (would|does|will) (one|they|a worker|an employee|each one|someone|a hire)( really)? cost\b|\bemployer (costs?|contributions?|share)\b|\bpayroll (costs?|burden)\b|\bcpp\b|\bei premium|\bworkers'? comp\b|\bactually cost\b|\breally cost\b/;
const WAGE_RE = /\$\s?(\d{1,3}(?:\.\d{1,2})?)|\b(\d{1,3}(?:\.\d{1,2})?)\s*(?:dollars?\s*)?(?:an|a|per|\/)\s*(?:hour|hr)\b/i;
function readWage(text) {
  const m = String(text).match(WAGE_RE);
  const v = m && Number(m[1] || m[2]);
  return v >= 10 && v <= 200 ? v : null;
}
const JOB_TOPICS = [
  ['apply', /\bhow (do|can) i apply\b|\bapply\b/],
  ['similar', /\bsimilar\b|\bother jobs\b|\blike this\b|\bmore like\b|\balternatives?\b/],
  ['pay', /\b(pay|pays|paid|wage|wages|salary|rate|how much)\b/],
  ['hours', /\b(hours|schedule|shifts?|days|nights|weekends?|overtime|full[- ]time|part[- ]time|what time)\b/],
  ['needs', /\b(need|needs|require|requirements?|qualif\w*|experience|licen[cs]e|ticket|certif\w*|skills?|what does it take|eligible)\b/],
  ['benefits', /\b(benefits?|perks|insurance|dental|pension|rrsp)\b/],
  ['start', /\b(start|starting|how long|duration|last)\b/],
  ['type', /\b(is it|is this|is the job) (a )?(permanent|contract|temporary|temp|full[- ]time)\b/],
  ['location', /\b(where is|location|address|located|how far|bus|transit|parking)\b/],
  ['duties', /\b(duties|responsibilit\w*|what (will|would) i (be )?do(ing)?|day to day|involve|tasks|what('|’)?s the job( like)?|tell me (more )?about)\b/],
];
const jobTopicOf = (text) => (JOB_TOPICS.find(([, re]) => re.test(lower(text))) || [])[0] || null;
const PAYQ_STOP = new Set('pay pays paid paying make makes making earn earns earning wage wages salary salaries rate rates usually typically typical normally average per hour hourly yearly offer offering much they them their people someone does did would should will cost costs'.split(' '));

// What kind of question is this message, if it's one the data answers?
//   { kind: 'job', topic } | { kind: 'cost' } | { kind: 'pay' } | null
function dataQuestion(text, asked, context) {
  const t = lower(text);
  if (/^(start over|restart|reset)\b/.test(t)) return null;
  if (asked === 'cost-wage' && readWage(text)) return { kind: 'cost' };
  if (asked === 'pay-role' && !faqOf(text)) return { kind: 'pay' };
  if (COST_Q.test(t) || (readWage(text) && /\b(cost|employ|hire|hiring|pay(ing)? (someone|them|a worker|staff))\b/.test(t))) return { kind: 'cost' };
  const faq = faqOf(text);
  if (faq && (faq.startsWith('w-') || ['fees', 'status', 'permit', 'recruiter', 'scam', 'e-payrolling', 'e-existing', 'eligible-no', 'eligible-ask', 'eligible-yes'].includes(faq))) return null;
  if (readMinPay(t)) return null; // "jobs that pay over $25" is a search
  if (context?.job) {
    const role = readRole(text);
    const topic = jobTopicOf(text);
    // "What do forklift operators make?" on a job page is about the role, not this posting
    if (topic && !(topic === 'pay' && role && !role.generic && PAY_Q.test(t))) return { kind: 'job', topic };
  }
  // "How much do drivers make?" is about pay; "how much do you charge?" is about ISL's prices
  if (PAY_Q.test(t) && !(faq === 'price' && /\byour (rates?|fees?|prices?)\b|\b(cost|costs|charge|fee|fees|markup|pricing|price)\b/.test(t))) return { kind: 'pay' };
  return null;
}

// ---------- Reading the conversation ----------
// Walks every visitor message in order and builds up what we know.
const freshSeek = () => ({ terms: null, unknownWork: '', attrs: [], minPay: null, place: null, employment: 'any', page: 0 });
function readConversation(messages, context, vocab) {
  const st = {
    mode: null,
    seek: freshSeek(),
    hire: { role: null, place: null, service: null, start: null },
    lastFaq: null,
    lastText: '',
    lastMeta: null,
    french: false,
    frenchNoted: false,
    anyPlace: null,
    understood: true,
    newcomer: false,
    named: [],
  };
  let asked = null; // what the assistant asked just before this message

  for (const m of messages) {
    if (m.role === 'assistant') {
      asked = m.meta?.ask || null; st.lastMeta = m.meta || null;
      if (m.meta?.known) st.prevKnown = m.meta.known;
      if (m.meta?.mode && !st.mode) st.mode = m.meta.mode;
      if (m.meta?.fr) st.frenchNoted = true;
      continue;
    }
    if (m.role !== 'user') continue;
    const original = String(m.content || '');
    const isFrench = FRENCH_RE.test(lower(original));
    if (isFrench) st.french = true;
    // What the rules read: French turned into English, then small typos fixed for job words and places
    const plain = isFrench ? toEnglish(lower(original)) : lower(original);
    const t = correctSpelling(plain, vocab.targets, vocab.known);
    const text = t;
    const faq = faqOf(plain);
    st.lastFaq = faq;
    st.lastText = text;
    st.lastOriginal = original;
    st.understood = true;
    if (faq === 'newcomer') st.newcomer = true;

    const place = /elsewhere in canada/.test(t) ? { province: '', city: '', rural: false, outside: true, label: 'outside Atlantic Canada' } : placeFrom(text);
    if (place) st.anyPlace = place;

    st.dataQ = dataQuestion(text, asked, context);
    if (st.dataQ) { st.dataPlace = place; continue; } // answered from data: doesn't change the search or the request
    if (faq === 'restart') { st.mode = null; st.seek = freshSeek(); st.hire = { role: null, place: null, service: null, start: null }; continue; }
    if (faq && faq.startsWith('w-')) { st.mode = st.mode === 'employer' ? st.mode : 'worker'; continue; }
    st.named = peopleNamed(lower(original));
    if (st.named.length || faq === 'who' || faq === 'isljobs') continue;
    if (faq === 'scam' || faq === 'human' || faq === 'contact' || faq === 'officehours' || faq === 'officewhere' || faq === 'count') continue;
    if (asked === 'worker-office' || asked === 'office-pick') continue; // picking an office, not a search

    // Mode: the newest clear signal wins, so "actually I'm looking for work" switches.
    if (/^(i'?m hiring|i'?m an employer)$/.test(t.trim()) || (EMPLOYER_RE.test(t) && !/\bare you hiring\b/.test(t))) st.mode = 'employer';
    else if (/^(i'?m looking for work|find me a job)$/.test(t.trim()) || SEEKER_RE.test(t)) st.mode = 'seeker';
    else if (/^i work with isl$/.test(t.trim())) st.mode = 'worker';
    else if (faq && faq.startsWith('e-')) st.mode = 'employer';

    if (st.mode === 'employer' || (!st.mode && asked?.startsWith('hire-'))) {
      if (faq && faq.startsWith('e-')) continue; // a question about how it works, not new details
      const role = readRole(text);
      if (role && !(role.generic && st.hire.role && !st.hire.role.generic)) st.hire.role = { ...role, count: role.count ?? st.hire.role?.count ?? null };
      // They answered "who do you need?" in their own words: take those words as the role
      if ((!role || (role.generic && !role.count)) && asked === 'hire-role' && !faq && !place && !readService(text) && t.trim().length > 2) {
        const words = t.replace(/^(not sure|unsure|i don'?t know|maybe|um+|uh+)[,. ]*/, '').replace(/^(some|a few|a couple( of)?|someone( to)?|somebody( to)?|a person( to)?|people( to)?)\s+/, '').replace(/[.!?]+$/, '').trim().slice(0, 50);
        if (words) st.hire.role = { one: words, many: words, count: null, generic: false, plural: true, free: true };
      }
      if (!role && !st.hire.role && !faq) {
        const words = roleWords(t, place);
        if (words) st.hire.role = { one: words, many: words, count: readCount(t), generic: false, plural: /s$/.test(words), free: true };
      }
      if (place) st.hire.place = place;
      else if (/\b(in|is in) atlantic canada\b/.test(t)) st.hire.place = null;
      const service = readService(text, asked === 'hire-service' ? 'service' : null);
      if (service) st.hire.service = service;
      if (/^permanent$/.test(t.trim())) st.hire.service = 'direct';
      if (/^for a set time$/.test(t.trim())) st.hire.service = 'contract';
      const start = readStart(text);
      if (start) st.hire.start = start;
      continue;
    }

    // Job seeker (or not yet known)
    if (faq === 'more') { st.seek.page += 1; continue; }
    if (faq === 'otherwork') { st.seek.terms = null; st.seek.unknownWork = ''; st.seek.page = 0; continue; }
    if (faq === 'otherplace') { st.mode = st.mode || 'seeker'; continue; }
    if (/^show me those$/.test(t.trim()) && st.lastMeta?.ask === 'seek-widen') { st.seek.place = null; st.seek.page = 0; continue; }
    const minPay = readMinPay(t);
    if (faq && !['elsewhere', 'newcomer', 'eligible-yes'].includes(faq) && !(faq === 'pay' && minPay)) continue; // a question, not a new search
    let changed = false;
    if (place) { st.seek.place = place; changed = true; }
    if (/\bonly permanent\b|\bpermanent\b/.test(t)) { st.seek.employment = 'permanent'; changed = true; }
    else if (/\bonly contract\b|\btemp(orary)?\b|\bcontract\b|\bcasual\b/.test(t)) { st.seek.employment = 'temporary'; changed = true; }
    else if (/\bany type\b|\beither\b|\bboth\b/.test(t)) { st.seek.employment = 'any'; changed = true; }
    if (/\bany (type of |kind of )?(work|job)\b|^anything\b|\banything (is fine|works|at all)\b/.test(t)) { st.seek.terms = null; changed = true; }
    for (const [key, a] of Object.entries(ATTRS)) if (a.re.test(t) && !st.seek.attrs.includes(key)) { st.seek.attrs.push(key); changed = true; }
    if (minPay) { st.seek.minPay = minPay; changed = true; }
    const terms = jobTermsOf(t, original, vocab);
    if (hasTerms(terms)) { st.seek.terms = terms; st.seek.unknownWork = ''; changed = true; }
    // "marine biologist jobs": clearly a job search, just not for work we have words for
    else if (!changed && /\b(jobs?|work|positions?|roles?|openings?|careers?|employment)\b/.test(t) && !SEEKER_RE.test(t)) {
      const what = t.replace(/\b(any|some|looking for|i'?m|i am|do you have|are there|jobs?|work|positions?|roles?|openings?|careers?|employment|in|near|around|for|a|an|the)\b/g, ' ').replace(/[^a-z' ]/g, ' ').replace(/\s+/g, ' ').trim();
      if (what) { st.seek.unknownWork = what.slice(0, 40); st.seek.terms = null; st.mode = st.mode || 'seeker'; changed = true; }
    }
    if (changed) st.seek.page = 0;
    const modeSignal = SEEKER_RE.test(t) || /^(i'?m looking for work|find me a job|show me jobs)$/.test(t.trim());
    if (!changed && !modeSignal && !['newcomer', 'eligible-yes', 'elsewhere'].includes(faq)) st.understood = false;
    if (faq === 'eligible-yes') st.mode = st.mode || 'seeker';
  }
  return { st, asked };
}

// What to say to someone already working through ISL, before handing them to their office
const WORKER_REPLIES = {
  'w-hurt': 'I’m sorry you were hurt. If it’s serious, call 911 first. Then tell your supervisor on site and call your ISL office right away, so the injury can be reported.',
  'w-absent': 'Thanks for letting us know. Please call your ISL office as soon as you can, before your shift if possible, so they can let the site know.',
  'w-pay': 'Sorry about that. Your ISL office can look into your pay and sort it out.',
  'w-tax': 'Your ISL office can help you get that.',
  'w-time': 'Your ISL office can walk you through sending in your hours.',
  'w-quit': 'Please talk to your ISL office before you stop, so they can let the site know and help with what’s next.',
  'w-portal': 'Your ISL office can help you sign in.',
  'w-general': 'Your ISL office is the best place for anything about your assignment.',
};

// ---------- Team members by name: "how do I reach Chance?" ----------
const PROVINCE_OFFICE = { NS: 'halifax', NB: 'moncton', PE: 'charlottetown', NL: 'st-johns' };
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function peopleNamed(t) {
  const asks = String.raw`(who is|who's|whos|reach|contact|call|email|e-mail|phone|text|talk to|speak to|speak with|talk with|get a hold of|get hold of|number for|message|is|ask for|looking for|connect me with|connect me to)`;
  const full = DIRECTORY.filter((p) => new RegExp(`\\b${escapeRe(lower(p.name))}\\b`).test(t));
  if (full.length) return full;
  return DIRECTORY.filter((p) => {
    const f = escapeRe(lower(p.first));
    return new RegExp(`\\b${asks} ${f}\\b|\\b${f}'?s (email|phone|number|cell|extension|contact|line)\\b`).test(t);
  });
}
// A team member as a contact card
const personCard = (p) => toContact({ person: { name: p.name, first: p.first, handles: [p.title, p.province === 'PE' ? 'PEI' : provinceName(p.province)].filter(Boolean).join(', '), phone: p.phone, email: p.email, photo: p.photo }, office: OFFICES[PROVINCE_OFFICE[p.province]] || OFFICES.halifax });
const bySlug = (slug) => DIRECTORY.find((p) => p.slug === slug);

// The five offices, one line each
const OFFICE_LINES = Object.values(OFFICES).map((o) => `${o.city === 'Halifax' ? 'Halifax (Dartmouth)' : o.city}: ${o.phone}`).join('\n');
const OFFICE_CHOICES = ['Halifax', 'Moncton', 'Saint John', 'Charlottetown', "St. John's"];

// =====================================================================
// The engine. Give it the conversation; it gives back the next reply:
//   { reply, jobs, choices, contact, summary, meta }
// choices: quick replies (strings are sent as messages; {label, href} are links)
// =====================================================================
export function createEngine({ loadJobs, siteUrl = (path) => SITE.base + path }) {
  const readJobs = loadJobs;
  // Resolve pay once per feed (the same array comes back while the cache is warm)
  const resolved = new WeakMap();
  loadJobs = async () => {
    const raw = await readJobs();
    if (!resolved.has(raw)) resolved.set(raw, raw.map(resolveCompensation));
    return resolved.get(raw);
  };
  const links = {
    generalApply: SITE.base + SITE.generalApplyPath,
    wageGuide: siteUrl('/learn/'),
    learn: siteUrl('/learn/'),
    contract: siteUrl('/contract/'),
    direct: siteUrl('/direct-hire/'),
    findWork: siteUrl('/find-work/'),
    contact: siteUrl('/contact/'),
    team: siteUrl('/team/'),
    payTool: siteUrl('/learn/tools/pay-on-open-jobs/'),
    resumeCheck: siteUrl('/learn/tools/resume-check/'),
    jobsReport: siteUrl('/learn/tools/jobs-report/'),
  };

  return async function respond(messages, context = {}) {
    const jobs = await loadJobs();
    const vocab = vocabularyFor(jobs);
    const { st, asked } = readConversation(messages, context, vocab);
    const seed = messages.filter((m) => m.role === 'user').length;
    const r = await answer(st, asked, context, jobs, seed);
    // The first reply to French says, in French, that replies are in English for now
    if (st.french && !st.frenchNoted) return { ...r, reply: FRENCH_NOTE + r.reply, meta: { ...(r.meta || {}), fr: true } };
    if (st.frenchNoted) return { ...r, meta: { ...(r.meta || {}), fr: true } };
    return r;
  };

  async function answer(st, asked, context, jobs, seed) {
    const faq = st.lastFaq;
    const meta = (extra = {}) => ({ mode: st.mode, ...extra });
    const back = st.mode === 'employer' && st.hire.role ? ['Back to my request'] : [];

    if (faq === 'restart') {
      return { reply: 'Sure, let’s start fresh! Are you looking for work, or hiring?', choices: ["I'm looking for work", "I'm hiring"], meta: { ask: 'mode' } };
    }
    if (faq === 'hello' && !st.mode) {
      return { reply: pick(['Hi there! Are you looking for work, or hiring?', 'Hello! Are you here to find work, or to find people?'], seed), choices: ["I'm looking for work", "I'm hiring", 'I work with ISL'], meta: { ask: 'mode' } };
    }
    if (faq === 'thanks') {
      return { reply: st.mode === 'employer' ? 'You’re very welcome! Good luck with the hire.' : st.mode === 'worker' ? 'You’re welcome! Take care.' : 'You’re very welcome! Good luck with the search, and come back anytime.', choices: ['Start over'], meta: meta() };
    }
    if (faq === 'ack') {
      if (asked === 'mode' || !st.mode) return fallback(st, asked, seed);
      return { reply: pick(['Is there anything else I can help with?', 'Anything else I can do for you?'], seed), choices: st.mode === 'employer' ? [...back, 'Start over'] : st.mode === 'seeker' ? ['Show more', 'Somewhere else', 'Other kinds of work'] : ['Start over'], meta: meta({ ask: asked }) };
    }
    if (faq === 'howareyou') {
      return { reply: st.mode ? 'I’m doing great, thanks for asking! Where were we?' : 'I’m doing great, thanks for asking! Are you looking for work, or hiring?', choices: st.mode ? [] : ["I'm looking for work", "I'm hiring"], meta: { mode: st.mode, ask: st.mode ? asked : 'mode' } };
    }
    if (faq === 'bot') {
      return { reply: 'I’m ISL’s virtual assistant, not a person. I can find open jobs for you, or connect you with the right recruiter if you’re hiring. For anything else, our offices are happy to help. What brings you here today?', choices: ["I'm looking for work", "I'm hiring", 'Contact an office'], meta: { mode: st.mode, ask: 'mode' } };
    }
    if (faq === 'joke') {
      return { reply: 'I’m much better at finding jobs than telling jokes! Are you looking for work, or hiring?', choices: ["I'm looking for work", "I'm hiring"], meta: { mode: st.mode, ask: 'mode' } };
    }
    if (faq === 'upset') {
      return { reply: `Sorry about that. I’m a simple assistant and I don’t understand everything yet. You can browse every opening on Find Work, or call an office and a person will help:\n${OFFICE_LINES}`, choices: [{ label: 'Find Work', href: links.findWork }, 'Start over'], meta: meta() };
    }

    // A team member by name, or "who looks after ...?"
    if (st.named.length) return personTurn(st);
    if (faq === 'who') return whoTurn(st);

    // People already working through ISL
    if ((faq && faq.startsWith('w-')) || asked === 'worker-office' || /^i work with isl$/i.test(st.lastText.trim())) return workerTurn(st, asked);
    if (faq === 'scam') {
      return { reply: `Good on you for checking. ISL never charges job seekers a fee, and never asks for banking details or a payment to apply or to start a job. If a message asks for either, don’t reply. To check whether it’s really us, call an office directly:\n${OFFICE_LINES}`, choices: OFFICE_CHOICES, meta: meta({ ask: 'office-pick' }) };
    }
    // Reaching an office: a named place gets that office's card, otherwise all five lines
    if (['human', 'contact', 'officehours', 'officewhere'].includes(faq) || (asked === 'office-pick' && st.anyPlace) || /^contact an office$/i.test(st.lastText.trim())) return officeTurn(st, faq, asked);

    if (st.dataQ?.kind === 'job') { const job = jobs.find((j) => j.id === context.job); if (job) return jobTurn(job, st.dataQ.topic, st, jobs, seed); }
    if (st.dataQ?.kind === 'cost') return costTurn(st, asked, context);
    if (st.dataQ?.kind === 'pay') return payTurn(st, context, seed);
    if (faq === 'resumecheck') return { reply: 'Our Resume check scores your resume, shows the fixes that matter most and lists the open jobs it fits. It runs in your browser, so your resume never leaves your device.', choices: [{ label: 'Check my resume', href: links.resumeCheck }, 'Show me jobs'], meta: { mode: 'seeker' } };
    // Job ads: we'd rather run the search than coach the ad, so offer that and carry on as an employer
    if (faq === 'jobad') { st.mode = 'employer'; const t = employerTurn(st, asked, seed); return { ...t, reply: `We can take that off your plate: we write the ad, post it, screen everyone who applies and send you the people worth meeting. ${t.reply}` }; }
    if (faq && faq.startsWith('e-')) return employerFaq(faq, st, asked);
    if (faq === 'price' && st.mode !== 'employer' && st.mode !== 'seeker') {
      return { reply: 'It’s always free for job seekers. For employers, contract staffing is one hourly rate per worker, with wages, payroll and workers’ compensation included, and a permanent search is one invoice, a percentage of the hire’s annual salary. The exact rate depends on the role. Are you hiring?', choices: ["I'm hiring", "I'm looking for work"], meta: { ask: 'mode' } };
    }
    if (faq === 'count') return countTurn(jobs, st);
    if (faq === 'isljobs') {
      const erika = bySlug('erika-smeltzer');
      return { reply: `Thanks for your interest in joining our team! ${erika ? `${erika.name}, our ${erika.title}, looks after ISL’s own team, and can tell you about openings:` : 'Our Halifax office can tell you about openings on our own team:'}`, contact: erika ? personCard(erika) : toContact({ person: null, office: OFFICES.halifax }), choices: ['Show me jobs'], meta: { mode: 'seeker' } };
    }
    if (st.mode === 'employer') return employerTurn(st, asked, seed);
    if (faq === 'eligible-yes' && (hasTerms(st.seek.terms) || st.seek.place)) {
      const t = await seekerTurn(st, seed, jobs);
      return { ...t, reply: 'Great, you’re all set on that front! ' + t.reply.replace(/^Good news! /, '') };
    }
    if (faq && !['more', 'elsewhere', 'otherwork', 'otherplace', 'newcomer', 'ack'].includes(faq) && !(faq === 'pay' && st.seek.minPay)) return seekerFaq(faq, st);
    if (faq === 'newcomer' && !hasTerms(st.seek.terms) && !st.seek.place) {
      return { reply: 'Welcome! We’d love to help you find work. One thing to know first: to be placed through ISL, you need to be a Canadian citizen or a permanent resident. What kind of work are you looking for, and where?', choices: topFamilies(jobs), meta: { mode: 'seeker', ask: 'seek-work' } };
    }
    if (faq === 'otherplace') return { reply: 'No problem! Type the town or province you’d like to work in.', meta: { mode: 'seeker', ask: 'seek-place' } };
    if (!st.understood) return fallback(st, asked, seed);
    if (!st.mode && !hasTerms(st.seek.terms) && !st.seek.place && !st.seek.attrs.length && !st.seek.minPay) {
      return { reply: 'Happy to help! Are you looking for work, or hiring?', choices: ["I'm looking for work", "I'm hiring", 'I work with ISL'], meta: { ask: 'mode' } };
    }
    return seekerTurn(st, seed, jobs);
  }

  // ---------------- Didn't understand ----------------
  function fallback(st, asked, seed) {
    if (asked === 'unclear') {
      return { reply: `Sorry, I’m still not following. You can browse every opening on Find Work, or call an office and a person will help:\n${OFFICE_LINES}`, choices: [{ label: 'Find Work', href: links.findWork }, 'Find me a job', "I'm hiring"], meta: { mode: st.mode, ask: 'unclear2' } };
    }
    return {
      reply: pick(['Sorry, I didn’t quite catch that. I can find you a job, help you hire, or point you to the right office.', 'Hmm, I’m not sure I follow. I can help you find work, hire staff, or reach one of our offices.'], seed),
      choices: ['Find me a job', "I'm hiring", 'I work with ISL', 'Contact an office'],
      meta: { mode: st.mode, ask: 'unclear' },
    };
  }

  // ---------------- People already working through ISL ----------------
  function workerTurn(st, asked) {
    const topic = st.lastFaq?.startsWith('w-') ? st.lastFaq : st.lastMeta?.topic || 'w-general';
    const intro = asked === 'worker-office' ? 'Here’s your office:' : WORKER_REPLIES[topic];
    const place = asked === 'worker-office' ? placeFrom(st.lastText) : st.anyPlace;
    if (!place || place.outside) {
      return { reply: `${intro} Which office do you work with?`, choices: OFFICE_CHOICES, meta: { mode: 'worker', ask: 'worker-office', topic } };
    }
    const r = route({ audience: 'seeker', place });
    const office = r.office;
    return { reply: asked === 'worker-office' ? intro : `${intro} Here’s your ${office.city} office:`, contact: toContact({ person: null, office }), choices: ['Start over'], meta: { mode: 'worker', topic } };
  }

  // ---------------- Team members ----------------
  function personTurn(st) {
    const named = st.named;
    if (named.length > 1) {
      return { reply: `We have ${numberWord(named.length)} people by that name: ${list(named.map((p) => `${p.name} (${p.title})`))}. Which one?`, choices: named.map((p) => `How do I reach ${p.name}?`).slice(0, 4), meta: { mode: st.mode } };
    }
    const p = named[0];
    return { reply: `${p.name} is our ${p.title}${p.province ? ` in ${p.province === 'PE' ? 'PEI' : provinceName(p.province)}` : ''}. Here’s how to reach ${p.first}:`, contact: personCard(p), choices: [{ label: 'Our team', href: links.team }], meta: { mode: st.mode } };
  }
  function whoTurn(st) {
    const t = lower(st.lastOriginal || st.lastText);
    const duty = DUTIES.find((d) => d.words.test(t));
    const place = st.anyPlace;
    if (duty?.topic === 'clients' || (duty?.topic === 'the company' && /\bhir(e|ing)\b/.test(t))) {
      if (place) {
        const r = route({ audience: 'employer', service: 'contract', place });
        return { reply: r.person ? `${r.person.first} handles new client requests there.` : `Our ${r.office.city} office handles those.`, contact: toContact(r), choices: ["I'm hiring"], meta: { mode: st.mode } };
      }
      return { reply: 'It depends on where the work is. Meg looks after Nova Scotia, Kelli New Brunswick, Chance PEI and Crystal Newfoundland and Labrador. Zowie leads permanent searches everywhere. Where’s the work?', choices: ['Nova Scotia', 'New Brunswick', 'PEI', 'Newfoundland and Labrador'], meta: { mode: 'employer', ask: 'hire-place' } };
    }
    if (duty?.topic === 'jobs') {
      const r = route({ audience: 'seeker', place });
      return { reply: `${r.person ? r.person.first + ' helps job seekers at our ' + r.office.city + ' office' : 'Our ' + r.office.city + ' office can help with that'}. You can also ask me about any open job.`, contact: toContact(r), choices: ['Show me jobs'], meta: { mode: 'seeker' } };
    }
    const people = (duty?.people || []).map(bySlug).filter(Boolean);
    if (!people.length) {
      return { reply: 'I’m not sure who looks after that. Our team page lists everyone with their role, or our Halifax office can point you to the right person.', contact: toContact({ person: null, office: OFFICES.halifax }), choices: [{ label: 'Our team', href: links.team }], meta: { mode: st.mode } };
    }
    if (people.length > 1) {
      return { reply: `ISL is led by its two Partners, ${people[0].name} and ${people[1].name}. Here’s how to reach ${people[0].first}:`, contact: personCard(people[0]), choices: [`How do I reach ${people[1].first}?`, { label: 'Our team', href: links.team }], meta: { mode: st.mode } };
    }
    const p = people[0];
    return { reply: `${p.name}, our ${p.title}, looks after ${duty.topic}. Here’s how to reach ${p.first}:`, contact: personCard(p), choices: [{ label: 'Our team', href: links.team }], meta: { mode: st.mode } };
  }

  // ---------------- Offices ----------------
  function officeTurn(st, faq, asked) {
    const t = st.lastText.trim();
    const place = st.anyPlace && (faq !== 'human' || placeFrom(t)) ? st.anyPlace : null;
    const hours = faq === 'officehours' ? ' I don’t have the opening hours here, so it’s best to call ahead.' : '';
    if (place && !place.outside) {
      const r = route({ audience: 'seeker', place });
      const office = r.office;
      const near = place.city && !new RegExp(office.city, 'i').test(place.city) ? ` covers ${place.city}` : '';
      return { reply: `Our ${office.city} office${near ? near + '. It’s' : ' is'} at ${office.address}, and the number is ${office.phone}.${hours}`, contact: toContact({ person: null, office }), meta: { mode: st.mode } };
    }
    const intro = faq === 'human' ? 'Of course! I can’t put a call through from here, but our offices are happy to help:'
      : faq === 'officehours' ? 'I don’t have the opening hours here, so it’s best to call ahead. Here are our offices:'
      : 'Here are our five offices:';
    return { reply: `${intro}\n${OFFICE_LINES}\nTap one for its address.`, choices: OFFICE_CHOICES, meta: { mode: st.mode, ask: 'office-pick' } };
  }

  // ---------------- How many jobs ----------------
  function countTurn(jobs, st) {
    const by = {};
    for (const j of jobs) by[j.province] = (by[j.province] || 0) + 1;
    const parts = Object.entries(by).sort((a, b) => b[1] - a[1]).map(([p, n]) => `${n} in ${p === 'PE' ? 'PEI' : provinceName(p)}`);
    return { reply: `We have ${jobs.length} open jobs right now: ${list(parts)}. What kind of work are you looking for?`, choices: topFamilies(jobs), meta: { mode: st.mode === 'employer' ? 'employer' : 'seeker', ask: 'seek-work' } };
  }
  // The provinces with open jobs right now (most first), and "Other" to type any place
  function placeChoices(jobs) {
    const by = {};
    for (const j of jobs) if (j.province) by[j.province] = (by[j.province] || 0) + 1;
    const label = (p) => (p === 'PE' ? 'PEI' : provinceName(p));
    return [...Object.entries(by).sort((a, b) => b[1] - a[1]).map(([p]) => label(p)).slice(0, 5), 'Other'];
  }
  // The biggest job families in the feed, as tap-to-answer buttons
  function topFamilies(jobs) {
    const by = {};
    for (const j of jobs) { const f = familyOf(j.title); if (f !== 'Other') by[f] = (by[f] || 0) + 1; }
    const short = { 'Warehouse and logistics': 'Warehouse', 'Office and administration': 'Office and admin', 'Professional and management': 'Management', 'Skilled trades': 'Trades' };
    return Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([f]) => short[f] || f);
  }

  // ---------------- Employers' questions ----------------
  function employerFaq(faq, st, asked) {
    const h = st.hire;
    const service = h.service === 'direct' ? 'direct' : 'contract';
    const r = route({ audience: 'employer', service: faq === 'e-guarantee' && !h.service ? 'direct' : service, place: h.place });
    const keepGoing = h.role ? ['Back to my request'] : ["I'm hiring"];
    const m = { mode: 'employer', ask: asked?.startsWith('hire-') ? asked : null, known: st.prevKnown };
    switch (faq) {
      case 'e-canada':
        return { reply: 'Yes! We place contract workers and run permanent searches anywhere in Canada. Our five offices cover Atlantic Canada, and our Halifax office takes requests from everywhere else. Who do you need, and where?', choices: ['General labourers', 'Warehouse staff', 'Office and admin', 'A permanent hire'], meta: { mode: 'employer', ask: 'hire-role' } };
      case 'e-howcontract':
        return { reply: 'We find, screen and place the worker, and they stay on our payroll. You pay one hourly rate per worker, with wages, payroll and workers’ compensation included. When the work is done, they move on, or you can hire them if it’s a fit.', choices: [{ label: 'How contract staffing works', href: links.contract }, ...keepGoing], meta: m };
      case 'e-diff':
        return { reply: 'Contract is for a set stretch of time: the worker stays on our payroll and you pay one hourly rate. Direct hire is a permanent search: they join your payroll from day one, and you pay one invoice, a percentage of their annual salary. Contract can also turn into a hire if it’s a fit.', choices: [{ label: 'Contract staffing', href: links.contract }, { label: 'Direct hire', href: links.direct }, ...keepGoing], meta: m };
      case 'e-guarantee':
        return { reply: `For permanent hires, yes: if the hire doesn’t work out within 90 days, we replace them. ${r.person ? r.person.first : `Our ${r.office.city} office`} can walk you through the details:`, contact: toContact(r), choices: keepGoing, meta: m };
      case 'e-speed':
        return { reply: `It depends on the role and how many people you need. For anything urgent, calling is quickest. ${r.person ? r.person.first : `Our ${r.office.city} office`} can tell you how soon:`, contact: toContact(r), choices: keepGoing, meta: m };
      case 'e-payrolling':
        return { reply: `That’s best talked through with our team, so they can see what fits. ${r.person ? r.person.first : `Our ${r.office.city} office`} can help:`, contact: toContact(r), choices: keepGoing, meta: m };
      case 'e-existing':
        return { reply: `Your account rep can help with that. If you’re not sure who that is, call the office that handles your account:\n${OFFICE_LINES}`, choices: OFFICE_CHOICES, meta: { mode: 'employer', ask: 'office-pick' } };
      default:
        return employerTurn(st, asked, 0);
    }
  }

  // ---------------- Job seekers ----------------
  function seekerFaq(faq, st) {
    const meta = { mode: 'seeker' };
    const office = route({ audience: 'seeker', place: st.seek.place || st.anyPlace });
    switch (faq) {
      case 'apply':
        return { reply: 'It’s easy: each job card has an Apply button that opens the application for that role. If nothing fits yet, send your resume and a recruiter will reach out when something does.', choices: [{ label: 'Send my resume', href: links.generalApply }, 'Show me jobs'], meta };
      case 'fees':
        return { reply: 'Not a cent! It’s completely free for job seekers. We never charge a fee, and we’ll never ask for banking details to apply.', choices: ['Show me jobs'], meta };
      case 'pay': case 'price':
        return { reply: 'Pay is listed on each job card when the employer has shared it. To see what our open jobs pay by role, try the pay tool.', choices: [{ label: 'Pay on our open jobs', href: links.payTool }, 'Show me jobs'], meta };
      case 'eligible-no':
        return { reply: 'Thanks for asking before you apply. To be placed through ISL, you need to be a Canadian citizen or a permanent resident, so we can’t place people on a work or study permit, and we can’t sponsor permits. Once you have your permanent residence, we’d love to hear from you!', choices: ['Contact an office', 'Start over'], meta: { ...meta, ask: 'eligible' } };
      case 'eligible-ask':
        return { reply: 'To be placed through ISL, you need to be a Canadian citizen or a permanent resident. If that’s you, you’re all set on that front! What kind of work are you looking for?', choices: ["I'm a citizen or PR", ...['Warehouse work', 'Office and admin', 'Trades']], meta: { ...meta, ask: 'seek-work' } };
      case 'eligible-yes':
        return { reply: 'Great, you’re all set on that front! What kind of work are you looking for, and where?', choices: ['Warehouse work', 'Office and admin', 'Driving', 'Trades'], meta: { ...meta, ask: 'seek-work' } };
      case 'permit':
        return { reply: 'A recruiter is the best person to answer that. Here’s who to ask:', contact: toContact(office), meta };
      case 'recruiter':
        return { reply: 'That depends on the job, so a recruiter is the best person to ask. Here’s who to contact:', contact: toContact(office), choices: ['Show me jobs'], meta };
      case 'status':
        return { reply: 'I can’t see applications from here, but the office can help. Here’s who to contact:', contact: toContact(office), meta };
      case 'interview':
        return { reply: 'Good luck! Read the posting again and match your experience to what it asks for, have a couple of examples ready of work you’re proud of, and bring a question or two about the role. Your recruiter can tell you more about the employer, too.', choices: ['Show me jobs', { label: 'Advice on our Learn page', href: links.learn }], meta };
      case 'about':
        return { reply: 'We’re Integrated Staffing! We place people in contract and permanent jobs, from five local offices across Atlantic Canada. What kind of work are you looking for?', choices: ['Warehouse work', 'Office and admin', 'Driving', 'Trades'], meta: { ...meta, ask: 'seek-work' } };
      case 'resume':
        return { reply: 'Good idea. Send your resume once, and a recruiter will reach out when a role fits.', choices: [{ label: 'Send my resume', href: links.generalApply }, 'Show me jobs'], meta };
      default:
        return { reply: 'Tell me the kind of work you’re after and where, and I’ll show you what’s open!', meta: { ...meta, ask: 'seek-work' } };
    }
  }

  async function seekerTurn(st, seed, jobs) {
    const s = st.seek;
    const meta = { mode: 'seeker' };
    const terms = s.terms;
    const welcome = st.newcomer && st.lastFaq === 'newcomer' ? 'Welcome! ' : '';
    if (st.lastFaq === 'elsewhere') return { reply: 'Sure! Where would you like to work?', choices: placeChoices(jobs), meta: { ...meta, ask: 'seek-place' } };
    if (s.unknownWork && !hasTerms(terms)) {
      return { reply: `${welcome}I couldn’t find any ${s.unknownWork} jobs open right now, sorry! If you send your resume, a recruiter will reach out when something fits.`, choices: [{ label: 'Send my resume', href: links.generalApply }, 'Other kinds of work', { label: 'All open jobs', href: links.findWork }], meta };
    }
    if (st.lastFaq === 'otherwork' || (!hasTerms(terms) && !s.place && !s.attrs.length && !s.minPay)) {
      return { reply: st.lastFaq === 'otherwork' ? 'Sure! What kind of work would you like?' : pick([`Love to help! We have ${jobs.length} open jobs right now. What kind of work are you looking for, and where?`, `Let’s find you something! We have ${jobs.length} open jobs right now. What kind of work, and which area?`], seed), choices: topFamilies(jobs), meta: { ...meta, ask: 'seek-work' } };
    }

    // Filter the feed: the kind of work, the type, the shift, the pay, then the place
    const HALIFAX_AREA = ['halifax', 'dartmouth', 'bedford', 'sackville', 'lower sackville', 'burnside', 'cole harbour', 'timberlea', 'fall river', 'enfield', 'hammonds plains'];
    const city = s.place?.city || '';
    const near = placesFor(HALIFAX_AREA.includes(city.toLowerCase()) ? 'halifax' : city);
    const isNear = (j) => near.length && near.some((p) => lower(j.city).includes(p.replace(/[.']/g, (c) => c)) || lower(j.city).replace(/[.']/g, '').includes(p.replace(/[.']/g, '')));
    const typeOk = (j) => s.employment === 'permanent' ? j.employment !== 'Temporary / contract' : s.employment === 'temporary' ? j.employment !== 'Permanent' : true;
    const attrOk = (j) => s.attrs.every((a) => ATTRS[a].test.test(`${j.title} ${j.jobType || ''} ${j.description}`));
    const payOk = (j) => {
      if (!s.minPay) return true;
      const h = hourlyOf(j);
      if (h == null) return false;
      return s.minPay.unit === 'hour' ? h >= s.minPay.value : h * 2080 >= s.minPay.value;
    };
    const kinds = (j) => fits(j, terms) && typeOk(j) && attrOk(j) && payOk(j);
    const everywhere = jobs.filter(kinds);
    const ATLANTIC = ['NS', 'NB', 'PE', 'NL'];
    const outsideCode = s.place?.outside ? provinceCode(s.place.label) : '';
    const inProv = s.place && !s.place.outside ? everywhere.filter((j) => !s.place.province || j.province === s.place.province)
      : s.place?.outside ? everywhere.filter((j) => !ATLANTIC.includes(j.province) && (!outsideCode || outsideCode.length !== 2 || !PROVINCE_CODES.has(outsideCode) || j.province === outsideCode))
      : everywhere;
    const nearby = city ? inProv.filter(isNear) : inProv;
    const others = city ? inProv.filter((j) => !isNear(j)) : [];
    const newest = (a, b) => String(b.posted).localeCompare(String(a.posted));
    const ranked = [...nearby.sort(newest), ...others.sort(newest)];

    // How to describe it: "night-shift warehouse roles paying $25/hour or more"
    const adj = [...s.attrs.map((a) => ATTRS[a].label), s.employment === 'permanent' ? 'permanent' : s.employment === 'temporary' ? 'contract' : ''].filter(Boolean).join(' ');
    const what = [adj, termLabel(terms)].filter(Boolean).join(' ');
    const payPhrase = s.minPay ? ` paying ${s.minPay.unit === 'hour' ? '$' + s.minPay.value + '/hour' : '$' + s.minPay.value.toLocaleString('en-CA') + ' a year'} or more` : '';
    const rolesWord = (n) => `${what ? what + ' ' : ''}${n === 1 ? 'role' : 'roles'}`;
    const where = s.place ? (s.place.outside ? ` in ${s.place.label}` : city ? ` around ${city}` : ` in ${s.place.label}`) : '';
    const PAGE = 3;

    const choices = [];
    if (ranked.length > (s.page + 1) * PAGE) choices.push('Show more');
    if (s.employment !== 'permanent') choices.push('Only permanent');
    if (s.employment !== 'temporary') choices.push('Only contract');
    choices.push('Somewhere else');

    // Nothing in the place they asked about: say so, and offer what's open elsewhere
    if (!ranked.length) {
      const resume = { label: 'Send my resume', href: links.generalApply };
      if (s.place && everywhere.length) {
        const by = {};
        for (const j of everywhere) by[j.province] = (by[j.province] || 0) + 1;
        const parts = Object.entries(by).sort((a, b) => b[1] - a[1]).map(([p, n]) => `${numberWord(n)} in ${p === 'PE' ? 'PEI' : provinceName(p)}`);
        const outside = s.place.outside && !jobs.some((j) => !ATLANTIC.includes(j.province)) ? ' Our open jobs are in Atlantic Canada right now.' : '';
        const elsewhere = parts.length === 1 ? `We do have ${parts[0]}.` : `We do have ${numberWord(everywhere.length)} elsewhere: ${list(parts)}.`;
        return {
          reply: `${welcome}I couldn’t find any ${rolesWord(2)}${payPhrase}${where} right now, sorry!${outside} ${elsewhere}`,
          choices: ['Show me those', resume, 'Other kinds of work'], meta: { ...meta, ask: 'seek-widen' },
        };
      }
      // Nothing exact: suggest the nearest family ("no receptionist roles, but these office roles")
      const rel = terms?.rel ? jobs.filter((j) => familyOf(j.title) === terms.rel && typeOk(j) && (!s.place?.province || j.province === s.place.province)) : [];
      if (rel.length && !s.attrs.length && !s.minPay) {
        const relLabel = { 'Office and administration': 'office and admin', 'General labour': 'general labour', 'Skilled trades': 'skilled trades', 'Hospitality': 'hospitality', 'Professional and management': 'professional', 'Warehouse and logistics': 'warehouse' }[terms.rel] || terms.rel.toLowerCase();
        return {
          reply: `${welcome}I couldn’t find any ${rolesWord(2)}${where} right now, but these ${relLabel} roles are close:`,
          jobs: rel.slice(0, PAGE).map((j) => toCard(j, '')), choices: [resume, 'Other kinds of work', 'Somewhere else'], meta: { ...meta, ask: 'seek-results' },
        };
      }
      const attrHint = s.attrs.includes('remote') ? ' Our open jobs are all on site right now.' : '';
      return {
        reply: `${welcome}I couldn’t find any ${rolesWord(2)}${payPhrase}${where} right now, sorry!${attrHint} If you send your resume, a recruiter will reach out when something fits.`,
        choices: [resume, 'Other kinds of work', { label: 'All open jobs', href: links.findWork }], meta,
      };
    }

    const shown = ranked.slice(s.page * PAGE, s.page * PAGE + PAGE);
    if (!shown.length) return { reply: 'That’s everything that matches right now. Want to try another area?', choices: ['Somewhere else', 'Other kinds of work', { label: 'Send my resume', href: links.generalApply }], meta };
    const cards = shown.map((j) => toCard(j, ''));
    let reply;
    if (s.page > 0) {
      reply = pick(['Sure, here are a few more.', 'Here you go, a few more that fit.'], seed);
    } else if (city && !nearby.length) {
      reply = `I couldn’t find any ${rolesWord(2)} right around ${city}, but ${others.length === 1 ? 'this one is' : 'these are'} elsewhere in ${provinceName(s.place.province) === 'Prince Edward Island' ? 'PEI' : provinceName(s.place.province)}.`;
    } else if (city && others.length) {
      reply = `Good news! ${cap(numberWord(nearby.length))} ${rolesWord(nearby.length)} ${nearby.length === 1 ? 'is' : 'are'} open around ${city}${nearby.length < PAGE ? `, and ${numberWord(others.length)} more elsewhere in ${s.place.province === 'PE' ? 'PEI' : provinceName(s.place.province)}` : ''}.`;
    } else if (ranked.length > PAGE) {
      reply = pick([
        `Good news! ${cap(numberWord(ranked.length))} ${rolesWord(2)} are open${where}${payPhrase}. Here are the newest ${numberWord(PAGE)}.`,
        `I found ${numberWord(ranked.length)} ${rolesWord(2)} open${where}${payPhrase}. Here are the newest ${numberWord(PAGE)} to start with.`,
      ], seed);
    } else {
      reply = `Good news! ${cap(numberWord(ranked.length))} ${rolesWord(ranked.length)} ${ranked.length === 1 ? 'is' : 'are'} open${where}${payPhrase} right now.`;
    }
    if (terms?.entry && s.page === 0) reply += ' These are often a good start without much experience, but check each posting for what it needs.';
    return { reply: (welcome + reply).replace(/\s+/g, ' '), jobs: cards, choices: choices.slice(0, 4), meta: { ...meta, ask: 'seek-results' } };
  }

  // ---------------- Answers from data ----------------
  // A question about the posting on this page
  async function jobTurn(job, topic, st, jobs, seed) {
    const meta = { mode: 'seeker', ask: 'job-' + topic };
    const prov = provinceName(job.province);
    const MENU = [['hours', 'What are the hours?'], ['pay', 'What’s the pay?'], ['needs', 'What do I need?'], ['duties', 'What’s the job like?'], ['similar', 'Similar jobs']];
    const next = MENU.filter(([k]) => k !== topic).slice(0, 3).map(([, label]) => label);
    const choices = [...next, { label: 'Apply', href: job.applyUrl }];

    if (topic === 'apply') return { reply: 'Tap Apply on this page. It opens the application for this job, and it’s always free.', choices: [{ label: 'Apply now', href: job.applyUrl }, 'What do I need?', 'Similar jobs'], meta };
    if (topic === 'type') return { reply: `It’s a ${job.employment === 'Permanent' ? 'permanent' : job.employment === 'Temp to perm' ? 'temp-to-perm' : 'contract'} job, in ${job.city}.`, choices, meta };
    if (topic === 'location') return { reply: `It’s in ${job.city}, ${prov}. The recruiter shares the exact site when you’re placed.`, choices, meta };
    if (topic === 'similar') {
      // The same kind of work (pay.js families: drivers, warehouse, trades...), this province first
      const fam = familyOf(job.title);
      const alike = fam === 'Other' ? [] : jobs.filter((j) => j.id !== job.id && familyOf(j.title) === fam)
        .sort((a, b) => (b.province === job.province) - (a.province === job.province) || String(b.posted).localeCompare(String(a.posted)));
      const cards = alike.slice(0, 3).map((j) => toCard(j, ''));
      if (!cards.length) return { reply: 'Nothing quite like it is open right now.', choices: [{ label: 'All open jobs', href: links.findWork }], meta };
      const local = alike.slice(0, 3).every((j) => j.province === job.province);
      return { reply: local ? pick(['Here are a few like it.', 'These are the closest to it.'], seed) : `Here are the closest, ${alike[0].province === job.province ? 'in ' + prov + ' and nearby' : 'across Atlantic Canada'}.`, jobs: cards, choices: [{ label: 'All open jobs', href: links.findWork }], meta };
    }
    const { lines } = jobAnswer(job, topic);
    if (topic === 'pay' && job.pay && !lines.length) lines.push(job.pay);
    if (!lines.length) {
      const r = route({ audience: 'seeker', service: job.employment === 'Permanent' ? 'direct' : 'contract', place: placeFrom(`${job.city} ${prov}`) });
      const who = r.person ? r.person.first : `Our ${r.office.city} office`;
      return { reply: `The posting doesn’t say. ${who} can tell you:`, contact: toContact(r), choices: next, meta };
    }
    const intro = { pay: 'Here’s what the posting says about pay:', hours: 'Here’s what the posting says about the hours:', needs: 'Here’s what they’re looking for:', duties: 'Here’s what the job involves:', benefits: 'Here’s what it offers:', start: 'Here’s what the posting says:' }[topic];
    const body = lines.length === 1 && topic === 'pay' ? `It pays ${lines[0].replace(/^[^:]+:\s*/, '')}.`.replace(/\.\.$/, '.') : `${intro}\n${lines.map((l) => '• ' + l).join('\n')}`;
    return { reply: body, choices, meta };
  }

  // "What do forklift operators make in New Brunswick?"
  async function payTurn(st, context, seed) {
    const jobs = await loadJobs();
    const t = lower(st.lastText);
    const place = st.dataPlace;
    // The role: named in this message, or the one already being talked about
    const named = readRole(st.lastText);
    const placeWords = new Set(lower(place?.city || '').split(/\s+/).concat(['nova', 'scotia', 'brunswick', 'prince', 'edward', 'island', 'newfoundland', 'labrador', 'pei', 'atlantic', 'canada']));
    const words = t.replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w) && !PAYQ_STOP.has(w) && !placeWords.has(w));
    const job = context?.job ? jobs.find((j) => j.id === context.job) : null;
    const role = named && !named.generic ? named.many
      : words.length ? words.join(' ')
      : st.mode === 'employer' && st.hire.role && !st.hire.role.generic ? st.hire.role.many
      : st.lastMeta?.role || (st.seek.words.length ? st.seek.words.slice(0, 2).join(' ') : '') || (job ? job.title : '');
    const mode = st.mode || st.lastMeta?.mode || null;
    if (!role) {
      return { reply: 'Which role? Tell me and I’ll show you what our open jobs pay.', choices: ['Forklift operators', 'Drivers', 'General labourers', 'Office and admin'], meta: { mode, ask: 'pay-role' } };
    }
    const province = place?.province || (st.mode === 'employer' ? st.hire.place?.province : st.seek.place?.province) || st.lastMeta?.province || job?.province || '';
    const r = payFor(jobs, { role, province });
    if (!r) {
      return { reply: `I couldn’t find enough open jobs like that to go on, sorry. Our pay tool shows every role we’re hiring for.`, choices: [{ label: 'Pay on our open jobs', href: links.payTool }], meta: { mode } };
    }
    const asked = province ? provinceName(province) : '';
    const caveat = r.basis === 'family'
      ? ` There aren’t enough open ${role} jobs to go on, so this is the wider ${r.family.toLowerCase()} group${r.widened && asked ? ' across Atlantic Canada' : ''}.`
      : r.widened && asked ? ` We don’t have enough open ones in ${asked} right now, so this is across Atlantic Canada.` : '';
    const reply = pick(['Here’s what our open jobs pay.', 'Here’s what we’re offering on our open jobs right now.'], seed) + caveat;
    const choices = mode === 'employer'
      ? ['What would one cost me?', ...(st.hire.role ? ['Back to my request'] : ["I'm hiring"])]
      : [`Show me ${role.split(' ').map((w) => w.replace(/([a-z]{3})s$/, '$1')).join(' ')} jobs`, 'What would one cost me?'];
    return {
      reply, insight: payInsight(r, siteUrl), choices,
      meta: { mode, ask: 'pay', role, province: r.province || province, wage: r.unit === 'hour' ? Math.round(r.hourly * 4) / 4 : null },
    };
  }

  // "What would a $20/hour worker really cost me?"
  function costTurn(st, asked, context) {
    const text = st.lastText;
    const wage = readWage(text) || (st.lastMeta?.wage ?? null);
    const fromPay = !readWage(text) && st.lastMeta?.wage;
    const mode = st.mode || st.lastMeta?.mode || 'employer';
    if (!wage) {
      return { reply: 'Sure! What hourly wage should I work it out for?', choices: ['$18/hour', '$20/hour', '$25/hour'], meta: { mode, ask: 'cost-wage', province: st.lastMeta?.province } };
    }
    const place = st.dataPlace;
    const asked2 = place?.province || st.hire.place?.province || st.lastMeta?.province || '';
    const atlantic = ['NS', 'NB', 'PE', 'NL'].includes(asked2);
    const province = atlantic ? asked2 : 'NS';
    const hoursM = lower(text).match(/\b(\d{1,2})\s*hours? (a|per) week\b/);
    const r = costFor({ wage, hours: hoursM ? Number(hoursM[1]) : 40, province });
    const used = fromPay ? ` I used $${wage.toFixed(2).replace(/\.00$/, '')}/hour, the middle pay on our open jobs.` : '';
    const where = !atlantic && asked2 ? ' Our calculator covers the Atlantic provinces, so this uses Nova Scotia’s rates.' : '';
    return {
      reply: `Here’s what each hour worked really costs, once vacation, paid holidays, CPP, EI and workers’ comp are added.${used}${where}`,
      insight: costInsight(r, siteUrl),
      choices: mode === 'employer' && st.hire.role ? ['Back to my request'] : ["I'm hiring", 'Start over'],
      meta: { mode, ask: 'cost', province, wage },
    };
  }

  // ---------------- Employers ----------------
  function employerTurn(st, asked, seed) {
    const h = st.hire;
    const meta = (ask) => ({ mode: 'employer', ask, known });

    // What we know so far, in a short phrase: "three labourers in rural Nova Scotia"
    const who = !h.role ? ''
      : h.role.count === 'several' ? `a few ${h.role.many}`
      : h.role.count > 1 ? `${numberWord(h.role.count)} ${h.role.many}`
      : !h.role.count && h.role.plural ? h.role.many
      : `${/^[aeiou]/i.test(h.role.one) ? 'an' : 'a'} ${h.role.one}`;
    const where = h.place ? (h.place.outside ? (/^outside/.test(h.place.label) ? h.place.label : `in ${h.place.label}`) : h.place.city ? `in ${h.place.city}` : `in ${h.place.label}`) : '';
    const known = [who, where].filter(Boolean).join(' ');
    const prevKnown = st.prevKnown || '';
    // Say back what's new ("Three labourers in rural Nova Scotia, got it!"), or a short thanks
    // when they've just answered a question. The thanks rotates so it doesn't repeat.
    const shortThanks = pick(['Perfect. ', 'Sounds good. ', 'Thanks! ', 'Great. '], seed);
    const ack = asked === 'hire-service' && h.service === 'unsure' ? 'No problem, we can help you figure that out. '
      : known && known !== prevKnown && !(prevKnown && known.startsWith(prevKnown)) && asked !== 'hire-done' ? `${cap(known)}, got it! `
      : asked && asked.startsWith('hire-') && asked !== 'hire-role' && asked !== 'hire-done' ? shortThanks : '';

    if (['price', 'fees', 'pay'].includes(st.lastFaq)) {
      const r = route({ audience: 'employer', service: h.service === 'direct' ? 'direct' : 'contract', place: h.place });
      return {
        reply: h.service === 'direct'
          ? 'Happy to explain. A permanent search is one invoice, a percentage of the hire’s annual salary, agreed before the search starts. The person below can quote it for your role.'
          : 'Happy to explain. Contract staffing is one hourly rate per worker, with wages, payroll and workers’ compensation included. The rate depends on the role, so the person below can quote it for you.',
        contact: toContact(r), meta: meta(asked),
      };
    }


    // 1. The role
    if (!h.role || (h.role.generic && !h.role.count)) {
      return {
        reply: asked === 'hire-role' ? 'No problem. What’s the job title, or the type of work?' : pick(['Happy to help you find someone! Who do you need, and how many?', 'Great, let’s find you the right people! Who do you need, and how many?'], seed),
        choices: ['General labourers', 'Warehouse staff', 'Office and admin', 'A permanent hire'],
        meta: meta('hire-role'),
      };
    }
    // 2. Where
    if (!h.place) {
      return {
        reply: `${ack}Where’s the work located?`,
        choices: ['Nova Scotia', 'New Brunswick', 'PEI', 'Newfoundland and Labrador', 'Elsewhere in Canada'],
        meta: meta('hire-place'),
      };
    }
    // 3. Contract or permanent
    if (!h.service) {
      return {
        reply: `${ack}Is this for a set stretch of time, or are you looking for a permanent hire?`,
        choices: ['For a set time', 'Permanent', 'Try them first, then hire', 'Not sure yet'],
        meta: meta('hire-service'),
      };
    }
    const service = h.service === 'temp-to-perm' ? 'contract' : h.service;
    // 4. Start date (contract only: it decides how urgent the search is)
    if (service !== 'direct' && !h.start && asked !== 'hire-start') {
      return {
        reply: `${ack}And when would you like them to start?`,
        choices: ['As soon as possible', 'In the next few weeks', 'Planning ahead'],
        meta: meta('hire-start'),
      };
    }

    // 5. Route to the right person
    const r = route({ audience: 'employer', service: service === 'direct' ? 'direct' : h.service === 'unsure' ? 'unsure' : 'contract', place: h.place });
    const serviceLabel = { direct: 'Permanent (direct hire)', contract: 'Contract', 'temp-to-perm': 'Contract, with the option to hire', unsure: 'Not sure yet' }[h.service];
    const summary = [
      ['Role', who ? cap(who.replace(/^(a|an) /, '')) : ''],
      ['Where', h.place.outside ? cap(h.place.label) : h.place.city ? `${h.place.city}, ${provinceName(h.place.province)}` : cap(h.place.label)],
      ['Type', serviceLabel],
      ...(h.start && service !== 'direct' ? [['Start', h.start]] : []),
    ].filter(([, v]) => v);

    const details = `${cap(who)}${where ? ' ' + where : ''}. ${serviceLabel}.${h.start && service !== 'direct' ? ' Start: ' + h.start.toLowerCase() + '.' : ''}`;
    const hireParams = new URLSearchParams({ service: service === 'direct' ? 'direct' : 'contract', details });
    if (h.place.province) hireParams.set('where', provinceName(h.place.province));
    if (h.place.outside) hireParams.set('where', 'Elsewhere in Canada');
    const first = r.person?.first;
    const action = { label: first ? `Send my request to ${first}` : `Send my request to ${r.office.city}`, href: siteUrl('/hire/?' + hireParams.toString()) };

    let reply;
    if (service === 'direct') {
      reply = `${first} leads our direct hire team and will take it from here.`;
    } else if (r.person) {
      const covers = h.place.province === 'NS' ? `Our Halifax office covers all of Nova Scotia, and ${first} handles new client requests there.`
        : h.place.province === 'NB' ? `${first} handles new client requests for our Moncton and Saint John offices.`
        : `${first} handles new client requests at our ${r.office.city} office.`;
      reply = h.service === 'unsure' ? covers.replace(/\.$/, ', and can help you choose between contract and permanent too.') : covers;
    } else if (h.place.outside) {
      reply = `Our ${r.office.city} office takes contract requests from outside Atlantic Canada${h.service === 'unsure' ? ', and can help you choose between contract and permanent too' : ''}.`;
    } else {
      reply = h.place.city
        ? `Our ${r.office.city} office covers ${h.place.city}.`
        : h.place.province === 'NB'
          ? 'Our Moncton office is a good place to start, and they’ll pass it to Saint John if that’s closer.'
          : `Our ${r.office.city} office covers ${provinceName(h.place.province)}.`;
    }
    // A town without an office (Cape Breton, Fredericton, Gander...): say plainly that we cover it
    // The office cities and the towns right around them (these don't need a "we cover it")
    const OFFICE_CITIES = ['halifax', 'dartmouth', 'bedford', 'sackville', 'lower sackville', 'burnside', 'cole harbour', 'timberlea',
      'moncton', 'dieppe', 'riverview', 'saint john', 'quispamsis', 'rothesay', 'charlottetown', 'stratford', 'cornwall',
      "st. john's", 'mount pearl', 'paradise', 'conception bay south', 'torbay'];
    const beyondOffice = h.place.city && !OFFICE_CITIES.includes(h.place.city.toLowerCase());
    const opener = beyondOffice ? `Good news, we cover ${h.place.city}!` : pick(['Thanks, that’s everything I need!', 'Perfect, that’s all I need!'], seed);
    reply = `${opener} ${reply}`;
    return {
      reply,
      summary,
      contact: { ...toContact(r, action), officeUrl: r.office?.key && service !== 'direct' ? siteUrl(`/offices/${r.office.key}/`) : '' },
      choices: [{ label: service === 'direct' ? 'How direct hire works' : 'How contract staffing works', href: service === 'direct' ? links.direct : links.contract }, 'Start over'],
      meta: meta('hire-done'),
    };
  }
}
