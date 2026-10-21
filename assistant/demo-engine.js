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
// (routing.js). So are the figures: pay on open jobs and the true cost of an
// employee come from insights.js, the same code the website's tools use.
// On a job page it answers questions about that posting from the posting itself.
// Only the wording is rule-based.
// =====================================================================
import { searchJobs, toCard, SITE } from './jobs.js';
import { placeFrom, route, toContact, provinceName } from './routing.js';
import { payFor, payInsight, costFor, costInsight, jobAnswer } from './insights.js';
import { familyOf } from './pay.js';

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
  ['resumecheck', /\b(check|review|improve|fix|look at|rate|score|feedback on|help with) (my |a )?(resume|cv)\b|\b(resume|cv) (check|review|tips|help|feedback)\b/],
  ['jobad', /\b(check|review|improve|write|fix|feedback on|help with) (my |our |a |this )?(job )?(ad|advert|posting|job description)\b|\bjob (ad|posting) (check|review|help|feedback)\b/],
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

// ---------- Questions the data can answer ----------
// "What do forklift operators make?", "What would one cost me?", and on a job page,
// "What are the hours?". These are answered from data, not by searching.
const PAY_Q = /\b(what|how much)\b.*\b(pay|pays|paid|make|makes|earn|earns|wages?|salary|salaries|rate)\b|\b(pay|wages?|salary|salaries) (for|of|on)\b|\bwhat (do|does|would|should) (i|we) (offer|pay)\b/;
const COST_Q = /\btrue cost\b|\bcost to (employ|have|keep)\b|\bwhat (would|does|will) (one|they|a worker|an employee|each one|someone|a hire)( really)? cost\b|\bemployer (costs?|contributions?|share)\b|\bpayroll (costs?|burden)\b|\bcpp\b|\bei premium|\bworkers'? comp\b/;
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
  if (faq === 'fees' || faq === 'status' || faq === 'permit') return null;
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
function readConversation(messages, context) {
  const st = {
    mode: null,
    seek: { keywords: [], words: [], place: null, employment: 'any', page: 0 },
    hire: { role: null, place: null, service: null, start: null },
    lastFaq: null,
    lastText: '',
    lastMeta: null,
  };
  let asked = null; // what the assistant asked just before this message

  for (const m of messages) {
    if (m.role === 'assistant') { asked = m.meta?.ask || null; st.lastMeta = m.meta || null; if (m.meta?.known) st.prevKnown = m.meta.known; if (m.meta?.mode && !st.mode) st.mode = m.meta.mode; continue; }
    if (m.role !== 'user') continue;
    const text = String(m.content || '');
    const t = lower(text);
    const faq = faqOf(text);
    st.lastFaq = faq;
    st.lastText = text;

    st.dataQ = dataQuestion(text, asked, context);
    if (st.dataQ) { st.dataPlace = placeFrom(text); continue; } // answered from data: doesn't change the search or the request
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
    payTool: siteUrl('/learn/tools/pay-on-open-jobs/'),
    resumeCheck: siteUrl('/learn/tools/resume-check/'),
    jobAdCheck: siteUrl('/learn/tools/job-ad-check/'),
  };

  return async function respond(messages, context = {}) {
    const { st, asked } = readConversation(messages, context);
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
    if (st.dataQ?.kind === 'job') { const jobs = await loadJobs(); const job = jobs.find((j) => j.id === context.job); if (job) return jobTurn(job, st.dataQ.topic, st, jobs, seed); }
    if (st.dataQ?.kind === 'cost') return costTurn(st, asked, context);
    if (st.dataQ?.kind === 'pay') return payTurn(st, context, seed);
    if (faq === 'resumecheck') return { reply: 'Our Resume check scores your resume, shows the fixes that matter most and lists the open jobs it fits. It runs in your browser, so your resume never leaves your device.', choices: [{ label: 'Check my resume', href: links.resumeCheck }, 'Show me jobs'], meta: { mode: 'seeker' } };
    if (faq === 'jobad') return { reply: 'Paste it into our Job ad check. It scores the ad, compares the pay with our open jobs and flags the provinces where pay has to be in the ad.', choices: [{ label: 'Check my job ad', href: links.jobAdCheck }], meta: { mode: 'employer', ask: asked } };
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
