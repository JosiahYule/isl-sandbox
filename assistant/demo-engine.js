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
//
// The job matching is real (jobs.js), and so is the contact routing
// (routing.js). Only the wording is rule-based.
// =====================================================================
import { searchJobs, toCard, SITE } from './jobs.js';
import { placeFrom, route, toContact, provinceName } from './routing.js';

// ---------- Small helpers ----------
const lower = (s) => String(s || '').toLowerCase().replace(/[’]/g, "'");
const pick = (options, seed) => options[seed % options.length];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const NUM_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const numberWord = (n) => (n >= 0 && n < NUM_WORDS.length ? NUM_WORDS[n] : String(n));

// ---------- Who is talking: employer or job seeker? ----------
const COUNT = String.raw`(?:\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|a few|few|several|a couple(?: of)?|a dozen|some|extra|more)`;
const PEOPLE_WORDS = String.raw`(?:staff|people|help|(?:worker|employee|temp|hand|labou?rer|driver|operator|cook|cleaner|welder|carpenter|electrician|server|picker|packer|receptionist|assistant|accountant|bookkeeper|technician|mechanic|guard|agent|rep|associate|landscaper|harvester|mover|helper|controller|manager|supervisor|millwright|engineer)s?)(?!\s+(?:job|jobs|work|position|positions|role|roles|opening|openings)\b)`;
const EMPLOYER_RE = new RegExp([
  String.raw`\b(i'?m|we'?re|i am|we are|currently|company is|business is|still) hiring\b`,
  String.raw`\b(looking|want|need|trying|planning) to (hire|fill|staff|recruit)\b`,
  String.raw`\bhire (a|an|some|\d|two|three|four|five|people|staff|workers|someone|for)\b`,
  String.raw`\b(need|needs|looking for|want|require|requires|could use)\s+(${COUNT}\s+)?(\w+\s+){0,2}${PEOPLE_WORDS}\b`,
  String.raw`\b${COUNT}\s+(\w+\s+){0,2}${PEOPLE_WORDS}\b.*\b(in|for|at|by|next|this|starting|asap)\b`,
  String.raw`\b(our|my) (company|business|team|site|warehouse|plant|store|restaurant|office|crew) (needs|is short|is looking)\b`,
  String.raw`\b(fill|filling) (a|an|the|our) (role|position|vacancy|seat)\b`,
  String.raw`\b(staffing|recruit(ing|ment)?) (for|help|partner|agency)\b`,
  String.raw`\bfor my (company|business)\b`,
].join('|'), 'i');
const SEEKER_RE = /\b(i'?m|i am) (looking for|after|seeking) (a |some )?(job|work|position|role|employment)\b|\b(find|get|need|want|looking for) (a |some )?(job|work)\b|\bjob for me\b|\bmy resume\b|\bare you hiring\b|\bi'?m looking for work\b|\bjobs? (in|near|around|for)\b|\bwork (in|near|around)\b/i;

// ---------- Job seeker: what kind of work ----------
const STOP = new Set(("i im i'm am a an the and or but for to of in on at by with from near around any some looking look want wanting need needs " +
  'job jobs work working position positions role roles something anything find me my have has had experience experienced years year do does can ' +
  "could would like please hi hello hey there is are be what whats what's open opening openings available currently new get got also just really " +
  'very good great kind type sort full part time permanent perm temporary temp contract casual short long term about how else other only show ' +
  'instead area city town rural place places where everywhere nearby close closer us you your yes no okay ok thanks thank sure maybe right now ' +
  'seasonal days weeks months week month somewhere else more next actually instead now then still drive driving-licence').split(/\s+/));
const RELATED = {
  warehouse: ['warehouse', 'forklift', 'shipper', 'receiver', 'labourer', 'material handler'],
  forklift: ['forklift', 'warehouse'],
  office: ['office', 'administrative', 'admin', 'reception'],
  admin: ['administrative', 'office', 'admin', 'assistant', 'payroll'],
  driver: ['driver', 'driving', 'delivery'], driving: ['driver', 'delivery'],
  cleaning: ['cleaner', 'janitor', 'custodian', 'cleaning'], cleaner: ['cleaner', 'janitor', 'custodian'],
  construction: ['construction', 'labourer', 'carpenter'],
  labour: ['labourer', 'general labour'], labor: ['labourer'], labourer: ['labourer'], laborer: ['labourer'],
  trades: ['carpenter', 'electrician', 'millwright', 'welder', 'technician', 'mechanic'],
  accounting: ['accounting', 'accountant', 'payroll', 'bookkeeper', 'tax'],
  kitchen: ['cook', 'kitchen', 'dishwasher', 'food'], cook: ['cook', 'kitchen'],
  mechanic: ['mechanic', 'technician', 'millwright'],
  hospitality: ['server', 'banquet', 'cook', 'event'],
};

// ---------- Employer: which role ----------
const ROLES = [
  [/general labou?r(ers?)?|labou?rers?|labou?r\b/, 'labourer', 'labourers'],
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
  [/controllers?/, 'controller', 'controllers'], [/accountants?|cpas?/, 'accountant', 'accountants'],
  [/engineers?/, 'engineer', 'engineers'], [/project managers?/, 'project manager', 'project managers'],
  [/(plant |operations |general |office |sales )?managers?/, 'manager', 'managers'],
  [/supervisors?|foreman|foremen|leads?\b/, 'supervisor', 'supervisors'],
  [/developers?|it (staff|support|people)|programmers?/, 'IT professional', 'IT professionals'],
  [/sales (reps?|people|staff)|salespeople/, 'sales rep', 'sales reps'],
  [/security( guards?)?/, 'security guard', 'security guards'],
  [/landscapers?|grounds/, 'landscaper', 'landscapers'], [/harvesters?|farm (workers?|hands?)/, 'farm worker', 'farm workers'],
  [/movers?/, 'mover', 'movers'],
  [/(workers|staff|people|employees|help|hands|temps)\b/, 'worker', 'workers'],
];
const COUNT_VALUES = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, dozen: 12 };

function readRole(text) {
  const t = lower(text);
  for (const [re, one, many] of ROLES) {
    const m = t.match(new RegExp(String.raw`(?:^|[^a-z])(${re.source})`));
    if (!m) continue;
    // Look just before the role for a number: "3 labourers", "two class 1 drivers", "a controller"
    const before = t.slice(0, m.index + m[0].indexOf(m[1])).trim().split(/\s+/).slice(-3);
    let count = null;
    for (const w of before.reverse()) {
      if (/^\d{1,3}$/.test(w)) { count = Number(w); break; }
      if (COUNT_VALUES[w]) { count = COUNT_VALUES[w]; break; }
      if (/^(few|several|couple)$/.test(w)) { count = 'several'; break; }
    }
    const generic = one === 'worker';
    const plural = /(s|staff|admin|help|people|foremen)$/.test(m[1].trim());
    return { one, many, count, generic, plural };
  }
  return null;
}

// ---------- Employer: contract or permanent, and when ----------
function readService(text, asked) {
  const t = lower(text);
  if (/\bnot sure\b|\bunsure\b|\bdon'?t know\b|\bhelp me decide\b|\beither\b/.test(t) && asked === 'service') return 'unsure';
  if (/\btemp[- ]?to[- ]?perm\b|\btry (them|someone|before)|\bsee (them|someone) work|\bthen hire\b/.test(t)) return 'temp-to-perm';
  if (/\bperm(anent(ly)?)?\b|\bdirect hire\b|\bfull[- ]time (hire|role|position|employee)|\blong[- ]term hire\b|\bkey hire\b|\bon (our|my) payroll\b/.test(t)) return 'direct';
  if (/\btemp(orary)?\b|\bcontract\b|\bseasonal\b|\bshort[- ]term\b|\bset (stretch|time|period)\b|\bcover(age|ing)?\b|\bleave\b|\bfor (the )?(summer|season|holidays|winter|fall)\b|\bfor \w+ (days|weeks|months)\b|\b\d+ (days|weeks|months)\b|\bpeak\b|\bproject\b/.test(t)) return 'contract';
  return null;
}
function readStart(text) {
  const t = lower(text);
  if (/\basap\b|as soon as|right away|immediately|urgent|tomorrow|today|this week|monday|tuesday|wednesday|thursday|friday|yesterday/.test(t)) return 'As soon as possible';
  if (/next week|few weeks|couple (of )?weeks|two weeks|\b\d+ weeks\b|next month|in a month|january|february|march|april|may\b|june|july|august|september|october|november|december/.test(t)) return 'In the next few weeks';
  if (/planning|no rush|not urgent|later|down the road|ahead/.test(t)) return 'Planning ahead';
  return null;
}

// ---------- Questions people ask along the way ----------
const FAQ = [
  ['apply', /\bhow (do|can) i apply\b|\bapply(ing)? (for|to)\b|\bapplication process\b|\bwhere (do|can) i apply\b/],
  ['status', /\b(status|heard back|hear back|update) (of|on|about)? ?(my )?(application|resume)|\bdid you (get|receive) my\b|\bapplied (last|a few|yesterday)/],
  ['fees', /\b(cost|charge|fee|fees|pay you|free)\b.*\b(me|job seeker|to apply|candidates?)\b|\bdo i (have to )?pay\b|\bis it free\b/],
  ['price', /\b(how much|cost|rates?|pricing|price|fee|fees|markup|charge)\b/],
  ['pay', /\b(pay|wage|wages|salary|how much (does|do|will) (it|they|i))\b/],
  ['permit', /\bwork permit|visa|\blmia\b|\bpermanent resident|\bpr card|\binternational student/],
  ['about', /\bwhat (is|does) (isl|integrated staffing)|\bwho are you\b|\bwhat do you do\b|\bhow does (this|it|isl) work\b/],
  ['resume', /\bsend (my|a) resume\b|\bgeneral appli|\bresume\b/],
  ['thanks', /^(thanks|thank you|thx|cheers|great,? thanks|perfect|awesome|that'?s (great|perfect|all)|ok thanks|bye|goodbye)\b/],
  ['hello', /^(hi|hello|hey|hiya|good (morning|afternoon|evening)|bonjour)( there)?[!. ]*$/],
  ['howareyou', /\bhow are you\b|\bhow'?s it going\b|\bhow are things\b/],
  ['bot', /\bare you (a |an )?(bot|robot|real|human|ai|person)\b|\bwho am i (talking|speaking) (to|with)\b/],
  ['more', /^(show )?(me )?(more|next|other ones|any others|more (jobs|results|options))\b|\bshow (me )?more\b/],
  ['restart', /^(start over|restart|reset|new search|start again)\b/],
  ['elsewhere', /^somewhere else\b|\bdifferent (city|area|place|location)\b/],
];
const faqOf = (text) => (FAQ.find(([, re]) => re.test(lower(text).trim())) || [])[0] || null;

// ---------- Reading the conversation ----------
// Walks every visitor message in order and builds up what we know.
function readConversation(messages) {
  const st = {
    mode: null,
    seek: { keywords: [], words: [], place: null, employment: 'any', page: 0 },
    hire: { role: null, place: null, service: null, start: null },
    lastFaq: null,
    lastText: '',
  };
  let asked = null; // what the assistant asked just before this message

  for (const m of messages) {
    if (m.role === 'assistant') { asked = m.meta?.ask || null; st.prevKnown = m.meta?.known || ''; if (m.meta?.mode && !st.mode) st.mode = m.meta.mode; continue; }
    if (m.role !== 'user') continue;
    const text = String(m.content || '');
    const t = lower(text);
    const faq = faqOf(text);
    st.lastFaq = faq;
    st.lastText = text;

    if (faq === 'restart') { st.mode = null; st.seek = { keywords: [], words: [], place: null, employment: 'any', page: 0 }; st.hire = { role: null, place: null, service: null, start: null }; continue; }

    // Mode: the newest clear signal wins, so "actually I'm looking for work" switches.
    if (/^i'?m hiring$/.test(t.trim()) || (EMPLOYER_RE.test(t) && !/\bare you hiring\b/.test(t))) st.mode = 'employer';
    else if (/^i'?m looking for work$/.test(t.trim()) || SEEKER_RE.test(t)) st.mode = 'seeker';

    const place = /elsewhere in canada/.test(t) ? { province: '', city: '', rural: false, outside: true, label: 'outside Atlantic Canada' } : placeFrom(text);

    if (st.mode === 'employer' || (!st.mode && asked?.startsWith('hire-'))) {
      const role = readRole(text);
      if (role && !(role.generic && st.hire.role && !st.hire.role.generic)) st.hire.role = { ...role, count: role.count ?? st.hire.role?.count ?? null };
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
    if (faq && faq !== 'elsewhere') continue; // a question, not a new search
    let changed = false;
    if (place) { st.seek.place = place; changed = true; }
    if (/\bonly permanent\b|\bpermanent\b|\bfull[- ]time\b/.test(t)) { st.seek.employment = 'permanent'; changed = true; }
    else if (/\bonly contract\b|\btemp(orary)?\b|\bcontract\b|\bcasual\b/.test(t)) { st.seek.employment = 'temporary'; changed = true; }
    else if (/\bany type\b|\beither\b|\bboth\b/.test(t)) { st.seek.employment = 'any'; changed = true; }
    if (/\bany (type of )?(work|job)\b|\banything\b/.test(t)) { st.seek.keywords = []; st.seek.words = []; changed = true; }
    const placeWords = new Set(lower(place?.city || '').split(/\s+/).concat(['nova', 'scotia', 'brunswick', 'prince', 'edward', 'island', 'newfoundland', 'labrador', 'pei', 'atlantic', 'canada']));
    const words = t.replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w) && !placeWords.has(w));
    if (words.length) {
      st.seek.words = words;
      st.seek.keywords = [...new Set(words.flatMap((w) => RELATED[w] || [w]))].slice(0, 10);
      changed = true;
    }
    if (changed) st.seek.page = 0;
  }
  return { st, asked };
}

// =====================================================================
// The engine. Give it the conversation; it gives back the next reply:
//   { reply, jobs, choices, contact, summary, meta }
// choices: quick replies (strings are sent as messages; {label, href} are links)
// =====================================================================
export function createEngine({ loadJobs, siteUrl = (path) => SITE.base + path }) {
  const links = {
    generalApply: SITE.base + SITE.generalApplyPath,
    wageGuide: siteUrl('/learn/'),
    contract: siteUrl('/contract/'),
    direct: siteUrl('/direct-hire/'),
    findWork: siteUrl('/find-work/'),
  };

  return async function respond(messages) {
    const { st, asked } = readConversation(messages);
    const seed = messages.filter((m) => m.role === 'user').length;
    const faq = st.lastFaq;

    if (faq === 'restart') {
      return { reply: 'Sure, let’s start fresh! Are you looking for work, or hiring?', choices: ["I'm looking for work", "I'm hiring"], meta: { ask: 'mode' } };
    }
    if (faq === 'hello' && !st.mode) {
      return { reply: pick(['Hi there! Are you looking for work, or hiring?', 'Hello! Are you here to find work, or to find people?'], seed), choices: ["I'm looking for work", "I'm hiring"], meta: { ask: 'mode' } };
    }
    if (faq === 'thanks') {
      return { reply: st.mode === 'employer' ? 'You’re very welcome! Good luck with the hire.' : 'You’re very welcome! Good luck with the search, and come back anytime.', choices: ['Start over'], meta: { mode: st.mode } };
    }
    if (faq === 'howareyou') {
      return { reply: st.mode ? 'I’m doing great, thanks for asking! Where were we?' : 'I’m doing great, thanks for asking! Are you looking for work, or hiring?', choices: st.mode ? [] : ["I'm looking for work", "I'm hiring"], meta: { mode: st.mode, ask: st.mode ? asked : 'mode' } };
    }
    if (faq === 'bot') {
      return { reply: 'I’m ISL’s virtual assistant. I can find open jobs for you, or connect you with the right recruiter if you’re hiring. What brings you here today?', choices: ["I'm looking for work", "I'm hiring"], meta: { mode: st.mode, ask: 'mode' } };
    }
    if (st.mode === 'employer') return employerTurn(st, asked, seed);
    if (faq && faq !== 'more' && faq !== 'elsewhere') return seekerFaq(faq, st);
    if (!st.mode && !st.seek.keywords.length && !st.seek.place) {
      return { reply: 'Happy to help! Are you looking for work, or hiring?', choices: ["I'm looking for work", "I'm hiring"], meta: { ask: 'mode' } };
    }
    return seekerTurn(st, seed);
  };

  // ---------------- Job seekers ----------------
  function seekerFaq(faq, st) {
    const meta = { mode: 'seeker' };
    const office = route({ audience: 'seeker', place: st.seek.place });
    switch (faq) {
      case 'apply':
        return { reply: 'It’s easy: each job card has an Apply button that opens the application for that role. If nothing fits yet, send your resume and a recruiter will reach out when something does.', choices: [{ label: 'Send my resume', href: links.generalApply }, 'Show me jobs'], meta };
      case 'fees':
        return { reply: 'Not a cent! It’s completely free for job seekers. We never charge a fee, and we’ll never ask for banking details to apply.', choices: ['Show me jobs'], meta };
      case 'pay': case 'price':
        return { reply: 'Pay is listed on each job card when the employer has shared it. For typical rates by role, our wage guide has entry-level to top-of-market ranges.', choices: [{ label: 'Open the wage guide', href: links.wageGuide }, 'Show me jobs'], meta };
      case 'permit':
        return { reply: 'A recruiter is the best person to answer that, since it depends on your situation and the role. Here’s who to ask:', contact: toContact(office), meta };
      case 'status':
        return { reply: 'I can’t see applications from here, but the office can help. Here’s who to contact:', contact: toContact(office), meta };
      case 'about':
        return { reply: 'We’re Integrated Staffing! We place people in contract and permanent jobs across Atlantic Canada, from five local offices. What kind of work are you looking for?', choices: ['Warehouse work', 'Office and admin', 'Driving', 'Trades'], meta: { ...meta, ask: 'seek-work' } };
      case 'resume':
        return { reply: 'Good idea. Send your resume once, and a recruiter will reach out when a role fits.', choices: [{ label: 'Send my resume', href: links.generalApply }, 'Show me jobs'], meta };
      default:
        return { reply: 'Tell me the kind of work you’re after and where, and I’ll show you what’s open!', meta: { ...meta, ask: 'seek-work' } };
    }
  }

  async function seekerTurn(st, seed) {
    const s = st.seek;
    const meta = { mode: 'seeker' };
    if (st.lastFaq === 'elsewhere' || (/^show me jobs$/i.test(st.lastText.trim()) && !s.keywords.length && !s.place)) {
      return { reply: 'Sure! Where would you like to work?', choices: ['Halifax area', 'Moncton', 'Charlottetown', "St. John's"], meta: { ...meta, ask: 'seek-place' } };
    }
    if (!s.keywords.length && !s.place) {
      return { reply: pick(['Love to help with that! What kind of work are you looking for, and where?', 'Let’s find you something! What kind of work, and which area?'], seed), choices: ['Warehouse work', 'Office and admin', 'Driving', 'Trades'], meta: { ...meta, ask: 'seek-work' } };
    }

    const jobs = await loadJobs();
    const HALIFAX_AREA = ['halifax', 'dartmouth', 'bedford', 'sackville', 'lower sackville', 'burnside', 'cole harbour', 'timberlea', 'fall river', 'enfield', 'hammonds plains'];
    const city = s.place?.city || '';
    const filters = { keywords: s.keywords, province: s.place?.province || '', city: HALIFAX_AREA.includes(city.toLowerCase()) ? 'halifax' : city, employment: s.employment };
    const PAGE = 3;
    const found = searchJobs(jobs, { ...filters, limit: 15 });
    // Only count real matches: the job title or category fits, and (if a town was named) it's nearby.
    const real = found.note ? [] : found.results.filter((r) => (!s.keywords.length || r.matched_in === 'title' || r.matched_in === 'category') && (!city || r.near_requested_city));
    const strictTotal = real.length;
    const shown = found.results.slice(s.page * PAGE, s.page * PAGE + PAGE);
    const what = s.words.length ? `${s.words.slice(0, 2).join(' ')} ` : '';
    const where = s.place ? (s.place.city ? ` around ${s.place.city}` : ` in ${s.place.label}`) : '';
    const typeWord = s.employment === 'permanent' ? 'permanent ' : s.employment === 'temporary' ? 'contract ' : '';

    const choices = [];
    if (found.results.length > (s.page + 1) * PAGE) choices.push('Show more');
    if (s.employment !== 'permanent') choices.push('Only permanent');
    if (s.employment !== 'temporary') choices.push('Only contract');
    choices.push('Somewhere else');

    if (!shown.length) {
      if (s.page > 0) return { reply: 'That’s everything that matches right now. Want to try another area?', choices: ['Somewhere else', { label: 'Send my resume', href: links.generalApply }], meta };
      return {
        reply: `I couldn’t find any ${what.trim() ? typeWord + what.trim() + ' work' : 'openings like that'}${where} right now, sorry! If you send your resume, a recruiter will reach out when something fits.`,
        choices: [{ label: 'Send my resume', href: links.generalApply }, 'Somewhere else', 'Any type of work'],
        meta,
      };
    }

    const cards = shown.map((r) => toCard(jobs.find((j) => j.id === r.job_id), ''));
    let reply;
    if (s.page > 0) {
      reply = pick(['Sure, here are a few more.', 'Here you go, a few more that fit.'], seed);
    } else if (found.note || strictTotal === 0) {
      const wider = city && s.place?.province ? ` in ${provinceName(s.place.province)}` : '';
      const thing = what.trim() ? `${typeWord}${what.trim()} work` : `${typeWord}work like that`;
      reply = `I couldn’t find any ${thing}${where} right now, sorry about that. ${cards.length === 1 ? 'Here’s the closest role' : 'Here are the closest roles'}${wider}.`;
    } else if (strictTotal > PAGE) {
      reply = pick([
        `Good news! ${cap(numberWord(strictTotal))} ${typeWord}${what}roles are open${where}. Here are the ${numberWord(PAGE)} closest matches.`,
        `I found ${numberWord(strictTotal)} ${typeWord}${what}roles open${where}. Here are the best ${numberWord(PAGE)} to start with.`,
      ], seed);
    } else {
      reply = `Good news! ${cap(numberWord(strictTotal))} ${typeWord}${what}${strictTotal === 1 ? 'role is' : 'roles are'} open${where} right now.`;
    }
    return { reply: reply.replace(/\s+/g, ' '), jobs: cards, choices: choices.slice(0, 4), meta: { ...meta, ask: 'seek-results' } };
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
    const where = h.place ? (h.place.outside ? h.place.label : h.place.city ? `in ${h.place.city}` : `in ${h.place.label}`) : '';
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
    // Contract can't be staffed outside Atlantic Canada
    const service = h.service === 'temp-to-perm' ? 'contract' : h.service;
    if (service !== 'direct' && h.place.outside) {
      return {
        reply: 'Just so you know, our contract workers come from our five Atlantic offices, so contract staffing stays in Atlantic Canada. Permanent searches can reach anywhere in the country, though. Would that work?',
        choices: ['Make it a permanent search', 'The work is in Atlantic Canada'],
        meta: meta('hire-service'),
      };
    }
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
