// =====================================================================
// demo-mode.js: runs the job assistant WITHOUT the AI backend.
//
// On the live site, every message goes to the Supabase function, Claude
// decides what to search for, and writes the reply. Until that backend is
// deployed, this file stands in for it:
//   1. It reads the visitor's words with simple rules (no AI): the kind of
//      work, the place, and whether they want permanent or contract work.
//   2. It runs the REAL search code (jobs.js, the same file the backend uses)
//      over a snapshot of ISL's postings.
//   3. It writes a short, templated reply and shows the top matches as cards.
//
// So the matching is real; only the conversation is simplified. To switch to
// the live assistant, load widget.js with data-endpoint instead of this file.
// =====================================================================
import { searchJobs, toCard, SITE } from './jobs.js';

const base = new URL('.', import.meta.url).href;

const STOP = new Set(('i im i\'m am a an the and or but for to of in on at by with from near around any some looking look ' +
  'want wanting need needs job jobs work working position positions role roles something anything find me my have has had ' +
  'experience experienced years year do does can could would like please hi hello hey there is are be what whats what\'s ' +
  'open opening openings available currently new get got also just really very good great kind type sort full part time ' +
  'permanent perm temporary temp contract casual short long term').split(/\s+/));

// Plain-language words that should also search for the posting vocabulary.
const RELATED = {
  warehouse: ['warehouse', 'forklift', 'shipper', 'receiver', 'labourer'],
  forklift: ['forklift', 'warehouse'],
  office: ['office', 'administrative', 'admin', 'reception'],
  admin: ['administrative', 'office', 'admin', 'assistant'],
  driver: ['driver', 'driving', 'delivery'],
  driving: ['driver', 'delivery'],
  cleaning: ['cleaner', 'janitor', 'custodian'],
  cleaner: ['cleaner', 'janitor', 'custodian'],
  construction: ['construction', 'labourer', 'carpenter'],
  labour: ['labourer', 'general labour'],
  labor: ['labourer'],
  accounting: ['accounting', 'accountant', 'payroll', 'bookkeeper'],
  kitchen: ['cook', 'kitchen', 'dishwasher', 'food'],
  cook: ['cook', 'kitchen'],
  mechanic: ['mechanic', 'technician', 'millwright'],
};

const PROV = [
  ['NS', /\bnova scotia\b|\bNS\b/], ['NB', /\bnew brunswick\b|\bNB\b/],
  ['PE', /\bprince edward island\b|\bPEI\b|\bP\.E\.I\b/], ['NL', /\bnewfoundland\b|\blabrador\b|\bNL\b/],
];
const CITIES = ['halifax', 'dartmouth', 'bedford', 'sackville', 'burnside', 'truro', 'bridgewater', 'windsor', 'kentville',
  'moncton', 'dieppe', 'riverview', 'saint john', "st. john's", 'st johns', 'mount pearl', 'paradise', 'charlottetown',
  'summerside', 'stratford', 'fredericton'];

let jobsPromise;
const loadJobs = () => (jobsPromise ||= fetch(base + 'jobs-snapshot.json').then((r) => r.json()));

function readRequest(messages) {
  const userText = messages.filter((m) => m.role === 'user').map((m) => m.content).join(' ');
  const latest = messages.filter((m) => m.role === 'user').at(-1)?.content ?? '';
  const lower = userText.toLowerCase();

  const employer = /\b(hire|hiring|recruit|staff (for|up)|my (company|business|team)|we need (workers|people|staff))\b/i.test(latest)
    && !/\b(job|work) for me\b/i.test(latest);

  let employment = 'any';
  if (/\bperm(anent)?\b|\bfull[- ]?time\b|\blong[- ]term\b/.test(lower)) employment = 'permanent';
  if (/\btemp(orary)?\b|\bcontract\b|\bshort[- ]term\b|\bcasual\b/.test(lower)) employment = employment === 'permanent' ? 'any' : 'temporary';

  const province = (PROV.find(([, re]) => re.test(userText)) || [])[0] || '';
  const city = CITIES.find((c) => lower.includes(c)) || '';

  const words = lower.replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w) && !city.split(' ').includes(w) && !/^(nova|scotia|brunswick|prince|edward|island|newfoundland|labrador)$/.test(w));
  const keywords = [...new Set(words.flatMap((w) => RELATED[w] || [w]))].slice(0, 10);

  return { employer, employment, province, city, keywords };
}

async function demoSend(messages) {
  const req = readRequest(messages);
  await new Promise((r) => setTimeout(r, 450)); // a beat, so it doesn't feel instant and robotic

  if (req.employer) {
    return {
      reply: "It sounds like you're hiring. Our team handles contract and permanent hiring across Atlantic Canada: send the details through the Request talent page, or call 902-423-1919 and a recruiter will follow up within one business day.",
      jobs: [],
    };
  }
  if (!req.keywords.length && !req.city && !req.province && req.employment === 'any') {
    return { reply: 'Happy to help. What kind of work are you looking for, and where?', jobs: [] };
  }

  const jobs = await loadJobs();
  const found = searchJobs(jobs, { keywords: req.keywords, province: req.province, city: req.city, employment: req.employment, limit: 3 });
  const where = req.city ? ` around ${req.city.replace(/\b\w/g, (c) => c.toUpperCase())}` : req.province ? ` in ${req.province}` : '';

  if (!found.results.length) {
    return {
      reply: `I couldn't find an open posting that fits${where} right now. You can send a general application at ${SITE.base}${SITE.generalApplyPath} and a recruiter will keep you in mind as roles open.`,
      jobs: [],
    };
  }
  const cards = found.results.map((r) => {
    const job = jobs.find((j) => j.id === r.job_id);
    const why = req.keywords.length && !found.note ? `Matches what you described${where}.` : '';
    return toCard(job, why);
  });
  const reply = found.note
    ? `Nothing matched those exact words${where}, so here are other open roles that might suit you.`
    : `Here ${cards.length === 1 ? 'is 1 open role' : `are ${cards.length} open roles`} that fit${where}. Open one for the full posting, or apply straight from the card.`;
  return { reply, jobs: cards };
}

// Start the widget in demo mode, and let any element with data-open-assistant open it.
function start() {
  const chat = window.ISLJobChat.mount({
    send: demoSend,
    note: 'Demo mode: matches come from ISL’s real job search over a snapshot of postings. Replies are templated until the AI backend is connected.',
  });
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-open-assistant]');
    if (!t) return;
    e.preventDefault();
    chat.open();
  });
}
document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start) : start();
