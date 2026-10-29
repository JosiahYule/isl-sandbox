// Scripted conversations through the demo engine. Run after `npm run sync-assistant`:
//   node assistant/test/conversation.test.mjs
// Prints each exchange so the wording can be read, and checks the key outcomes.
import { readFileSync } from 'node:fs';
import { createEngine } from '../../public/assistant/demo-engine.js';

const jobs = JSON.parse(readFileSync(process.argv[2] || new URL('../data/jobs-snapshot.json', import.meta.url)));
let respond = createEngine({ loadJobs: async () => jobs, siteUrl: (p) => '/isl-sandbox' + p });

let failures = 0;
async function talk(name, lines, check, greetingMode, context = {}) {
  console.log(`\n=== ${name}`);
  const messages = greetingMode || name.startsWith('FR: greeting') ? [{ role: 'assistant', content: '(greeting)', meta: { mode: greetingMode || null, lang: name.startsWith('FR: greeting') ? 'fr' : undefined } }] : [];
  let last;
  for (const line of lines) {
    messages.push({ role: 'user', content: line });
    last = await respond(messages, context);
    messages.push({ role: 'assistant', content: last.reply, meta: last.meta });
    console.log(`  > ${line}\n  < ${last.reply}`);
    if (last.jobs?.length) console.log(`    [${last.jobs.map((j) => j.title + ' (' + j.location + ')').join('; ')}]`);
    if (last.insight) console.log(`    insight: ${last.insight.kicker} | ${last.insight.figure} | ${last.insight.sub}${last.insight.rows ? ' | ' + last.insight.rows.map((r) => r.join(' ')).join('; ') : ''}${last.insight.link ? ' -> ' + last.insight.link.href : ''}`);
    if (last.summary) console.log(`    summary: ${last.summary.map(([k, v]) => k + '=' + v).join(' | ')}`);
    if (last.contact) console.log(`    contact: ${last.contact.name} / ${last.contact.handles} / ${last.contact.phone}${last.contact.action ? ' / ' + last.contact.action.label + ' -> ' + last.contact.action.href : ''}`);
    if (last.choices?.length) console.log(`    choices: ${last.choices.map((c) => (typeof c === 'string' ? c : c.label + '↗')).join(' | ')}`);
  }
  try { check(last); console.log('  ok'); } catch (e) { failures++; console.log('  FAIL: ' + e.message); }
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };

await talk('Employer: the example', ['I need 3 labourers in rural Nova Scotia', 'For a set time', 'As soon as possible'],
  (r) => { expect(r.contact?.name === 'Meg Antonick', 'routes to Meg'); expect(r.summary.find(([k]) => k === 'Role')[1] === 'Three labourers', 'summary role'); });
await talk('Employer: all in one line', ['We need 5 warehouse workers in Truro for the summer starting next week'],
  (r) => expect(r.contact?.name === 'Meg Antonick', 'routes to Meg in one turn'));
await talk('Employer: permanent', ["I'm hiring", 'A permanent controller in Moncton'],
  (r) => expect(r.contact?.name === 'Zowie Tucker' && r.contact.email === 'zowie@integratedstaffing.ca', 'permanent goes to Zowie, with email'));
await talk('Employer: step by step', ["I'm hiring", 'Forklift operators', 'New Brunswick', 'Not sure yet', 'In the next few weeks'],
  (r) => expect(r.contact?.name === 'Kelli Wetmore' && r.contact.phone === '506-851-9306', 'NB contract goes to Kelli'));
await talk('Employer: Saint John area', ['need two drivers in Quispamsis on contract asap'],
  (r) => expect(r.contact?.name === 'Kelli Wetmore' && r.contact.phone === '506-851-9306', 'Quispamsis goes to Kelli'));
await talk('Employer: contract outside Atlantic', ["I'm hiring", '10 cleaners', 'Elsewhere in Canada', 'For a set time', 'As soon as possible'],
  (r) => expect(r.contact?.name === 'Chance Skauge' && /outside Atlantic Canada/.test(r.reply), 'contract outside Atlantic Canada goes to Chance'));
await talk('Employer: permanent outside Atlantic', ['we need a permanent controller in Calgary'],
  (r) => expect(r.contact?.name === 'Zowie Tucker', 'permanent anywhere goes to Zowie'));
await talk('Employer: Canada-wide question', ['can you place temp workers anywhere in canada?'],
  (r) => expect(/anywhere in Canada/.test(r.reply) && r.meta.ask === 'hire-role', 'says yes and asks who'));
await talk('Employer: asks price', ['Looking to hire a receptionist in Charlottetown', 'how much does it cost?'],
  (r) => expect(r.contact?.name === 'Chance Skauge', 'Charlottetown goes to Chance'));
await talk("Employer: St. John's", ["We need 4 cleaners in Mount Pearl", 'For a set time', 'Planning ahead'],
  (r) => expect(r.contact?.name === 'Crystal Murphy' && r.contact.phone === '709-689-0847', "St. John's goes to Crystal"));
await talk('Employer mode page greeting', ['A permanent controller in Moncton'],
  (r) => expect(r.contact?.name === 'Zowie Tucker', 'employer page mode'), 'employer');

await talk('Seeker: remembers the job type', ['warehouse work in halifax', 'what about moncton?'],
  (r) => expect(r.meta.mode === 'seeker', 'seeker'));
await talk('Seeker: show more and filter', ['Driving jobs', 'Show more', 'Only permanent'], () => {});
await talk('Seeker: fees and apply', ["I'm looking for work", 'is it free?', 'how do i apply'], (r) => expect(/Apply button/.test(r.reply), 'apply answer'));
await talk('Seeker: nothing matches', ['marine biologist jobs in PEI'], () => {});
await talk('Mode switch', ['hi', "I'm hiring", "actually I'm looking for work", 'office jobs in Dartmouth'], (r) => expect(r.jobs?.length, 'jobs after switch'));

 // ---- Answers from data ----
await talk('Pay: a role and a province', ['How much do drivers make in Nova Scotia?'],
  (r) => { expect(r.insight?.figure?.includes('/hour'), 'pay card'); expect(!r.jobs?.length, 'no job search'); });
await talk('Pay then cost (chained)', ['what do general labourers earn in NS', 'What would one cost me?'],
  (r) => { expect(/^\$\d+\.\d\d$/.test(r.insight?.figure), 'cost card'); expect(/middle pay/.test(r.reply), 'says which wage it used'); expect(r.insight.link.href.includes('province=NS'), 'calculator link keeps the province'); });
await talk('Cost with a wage', ['What does a $22 an hour employee really cost in PEI?'],
  (r) => { expect(r.insight?.kicker.includes('Prince Edward Island'), 'PEI rates'); expect(r.insight.rows.length === 3, 'breakdown rows'); });
await talk('Cost without a wage asks for one', ['true cost of an employee', '$20/hour'],
  (r) => expect(r.insight?.figure === '$23.52', 'NS $20 = $23.52'));
await talk('Employer asks pay mid-request', ['We need 3 forklift operators in Moncton', 'What do they usually earn?'],
  (r) => { expect(r.insight, 'pay card'); expect(r.choices.includes('Back to my request'), 'can go back'); });
await talk('Employer request survives a pay question', ['We need 3 forklift operators in Moncton', 'What do they usually earn?', 'Back to my request', 'For a set time', 'As soon as possible'],
  (r) => expect(r.contact?.name === 'Kelli Wetmore' && r.summary.find(([k]) => k === 'Role')[1] === 'Three forklift operators', 'request intact, routed to Kelli'));
await talk('Pay: unknown role', ['what does a marine biologist make'], (r) => expect(!r.insight && r.choices?.[0]?.href, 'honest miss with link'));
await talk('Resume check pointer', ['can you check my resume?'], (r) => expect(r.choices[0].href.includes('resume-check'), 'resume tool link'));
await talk('Job ad: offer to run the search', ['can you review my job posting?'], (r) => expect(/write the ad/.test(r.reply) && !JSON.stringify(r).includes('job-ad-check'), 'offers the service, no job ad tool'));

// ---- On a job page ----
const dock = jobs.find((j) => /Overnight Dock Worker/.test(j.title));
const ctx = { job: dock.id };
await talk('Job page: hours', ['What are the hours?'], (r) => expect(/Sunday to Thursday/.test(r.reply), 'hours from the posting'), 'seeker', ctx);
await talk('Job page: pay', ["What's the pay?"], (r) => expect(/\$19/.test(r.reply), 'pay from the posting'), 'seeker', ctx);
await talk('Job page: needs', ['What do I need?'], (r) => expect(/forklift/i.test(r.reply), 'requirements'), 'seeker', ctx);
await talk('Job page: not in the posting', ['Are there benefits?'], (r) => expect(r.contact, 'hands to a recruiter'), 'seeker', ctx);
await talk('Job page: similar', ['Similar jobs'], (r) => expect(r.jobs?.length && !r.jobs.some((j) => j.id === dock.id), 'similar, not itself'), 'seeker', ctx);
await talk('Job page: role pay is market pay', ['What do drivers make?'], (r) => expect(r.insight, 'role pay card, not this posting'), 'seeker', ctx);
await talk('Job page: a normal search still works', ['warehouse jobs in Halifax'], (r) => expect(r.jobs?.length, 'search'), 'seeker', ctx);


// ---- Understanding: only search for real work words ----
const noCards = (r) => !r.jobs?.length;
await talk('Unclear: no pretend search', ['asdfgh'], (r) => expect(noCards(r) && r.meta.ask === 'unclear' && r.choices.includes('Contact an office'), 'honest fallback with options'));
await talk('Unclear twice: offices listed', ['asdfgh', 'qwerty'], (r) => expect(noCards(r) && /902-423-1919/.test(r.reply), 'second miss lists the offices'));
await talk('Off topic', ["what's the weather like"], (r) => expect(noCards(r), 'no job cards'));
await talk('Typos fixed', ['warehose jobs in halifx'], (r) => expect(r.jobs?.length && /warehouse/.test(r.reply) && /Halifax/.test(r.reply), 'warehouse in Halifax'));
await talk('Everyday words: chef', ['chef positions'], (r) => expect(r.jobs?.some((j) => /cook/i.test(j.title)), 'chef finds cooks'));
await talk('No match: no random jobs', ['electrician'], (r) => expect(!r.jobs?.length || r.jobs.every((j) => /technician|erector|installation|carpenter|millwright|assembler|foreman|inspector|welder|mechanic|plumb/i.test(j.title)), 'only related trades'));
await talk('Pay filter', ['jobs that pay over $25 an hour'], (r) => expect(r.jobs?.length && /\$25\/hour or more/.test(r.reply), 'filters by pay'));
await talk('Nothing nearby: offer elsewhere', ['warehouse jobs in moncton', 'Show me those'], (r) => expect(r.jobs?.length, 'shows the jobs elsewhere'));
await talk('French employer, answered in French', ["J'ai besoin de 3 journaliers à Dieppe"], (r) => expect(/^Trois journaliers à Dieppe, c’est noté!/.test(r.reply) && r.meta.lang === 'fr' && r.choices.includes('Pour une période déterminée'), 'French reply and French buttons'));

// ---- People already working through ISL ----
await talk('Worker: T4, then office', ['I need my T4', 'Moncton'], (r) => expect(r.contact?.name === 'Moncton office' && noCards(r), 'Moncton office card'));
await talk('Worker: hurt at work', ['I got hurt at work'], (r) => expect(/911/.test(r.reply) && r.meta.ask === 'worker-office' && noCards(r), 'safety first, then the office'));
await talk('Worker: sick, place given', ["I'm sick and can't make my shift tomorrow in Charlottetown"], (r) => expect(r.contact?.name === 'Charlottetown office', 'Charlottetown office'));

// ---- Offices, people, scams ----
await talk('Office: closest to a town', ['what is the closest office to truro'], (r) => expect(r.contact?.name === 'Halifax office' && /Truro/.test(r.reply), 'Halifax covers Truro'));
await talk('Office: talk to a person', ['can i talk to a real person'], (r) => expect(/709-800-2454/.test(r.reply) && noCards(r), 'all five lines'));
await talk('Scam check', ['someone texted me offering a job from integrated staffing is that real?'], (r) => expect(/never charges/.test(r.reply) && /banking/.test(r.reply), 'scam advice'));

// ---- Who ISL can place: citizens and permanent residents ----
await talk('Eligibility: work permit', ["I'm on a work permit, can I apply?"], (r) => expect(/citizen or a permanent resident/.test(r.reply) && noCards(r), 'explains the rule, no jobs'));
await talk('Eligibility: international student', ['I am an international student looking for part time work'], (r) => expect(/citizen or a permanent resident/.test(r.reply) && noCards(r), 'explains the rule'));
await talk('Eligibility: French permit', ["J'ai un permis de travail, est-ce que je peux postuler?"], (r) => expect(/citoyen canadien ou résident permanent/.test(r.reply) && r.meta.lang === 'fr', 'French permit question, answered in French'));
await talk('Eligibility: has PR and a search', ['I have my PR, looking for warehouse work in halifax'], (r) => expect(/all set/.test(r.reply) && r.jobs?.length, 'confirms and searches'));
await talk('Eligibility: question', ['do I need to be a Canadian citizen to work with you?'], (r) => expect(/citizen or a permanent resident/.test(r.reply), 'states the rule'));
await talk('Newcomer', ['I just moved to Canada, can you help me find work?'], (r) => expect(/citizen or a permanent resident/.test(r.reply), 'mentions the rule kindly'));

// ---- Employers in everyday words ----
await talk('Employer: short staffed', ["we're short staffed at our warehouse in dartmouth"], (r) => expect(r.meta.mode === 'employer' && r.meta.ask === 'hire-service', 'employer, asks contract or permanent'));
await talk('Employer: send a couple guys', ['can you send me a couple guys for demo work tomorrow'], (r) => expect(r.meta.mode === 'employer' && /demolition/.test(r.reply), 'demolition labourers'));
await talk('Employer: mat leave cover', ['my receptionist is going on mat leave in january, need someone to cover', 'Moncton'],
  (r) => expect(r.contact?.name === 'Kelli Wetmore' && r.summary.some(([k, v]) => k === 'Start' && v === 'In January'), 'contract cover in Moncton, starting January'));
await talk('Employer: own words for the role', ["I'm hiring", 'not sure, some help around the shop', 'Nova Scotia', 'For a set time', 'As soon as possible'],
  (r) => expect(r.contact?.name === 'Meg Antonick', 'takes their words as the role'));
await talk('Employer: what do you charge', ['what do you charge'], (r) => expect(/free for job seekers/.test(r.reply) && /hourly rate/.test(r.reply), 'answers both sides'));
await talk('Employer: existing client', ['question about an invoice'], (r) => expect(/account rep/.test(r.reply) && noCards(r), 'account rep'));

// ---- Who looks after what, and people by name ----
await talk('Who: marketing', ['who is in charge of marketing'], (r) => expect(r.contact?.name === 'Josiah Yule', 'marketing goes to Josiah'));
await talk('Who: HR', ['who handles HR?'], (r) => expect(r.contact?.name === 'Shelley Lewis', 'HR goes to Shelley'));
await talk('Who: the company', ['who is the CEO'], (r) => expect(r.contact?.name === 'Greg White' && /Ross Argante/.test(r.reply), 'both Partners'));
await talk('Who: client requests by province', ['who handles new client requests in New Brunswick'], (r) => expect(r.contact?.name === 'Kelli Wetmore', 'NB clients go to Kelli'));
await talk('Who: health and safety', ['who is responsible for health and safety'], (r) => expect(r.contact?.name === 'Shelley Lewis', 'safety goes to Shelley'));
await talk('Who: unknown topic', ['who looks after the parking lot'], (r) => expect(/not sure/.test(r.reply) && r.contact?.name === 'Halifax office', 'honest, with the Halifax office'));
await talk('Name: first name', ['how do I reach Chance?'], (r) => expect(r.contact?.name === 'Chance Skauge' && r.contact.email === 'chance@integratedstaffing.ca', 'Chance card'));
await talk('Name: two people', ['I need to talk to Nicole'], (r) => expect(/two people/.test(r.reply) && r.choices.length === 2, 'asks which Nicole'));
await talk('Name: not a name', ['is there any chance of a forklift job in halifax'], (r) => expect(r.jobs?.length && !r.contact, 'a search, not Chance'));

// ---- Places ----
await talk('Somewhere else: provinces with jobs, plus Other', ['warehouse jobs halifax', 'Somewhere else'],
  (r) => expect(r.choices.at(-1) === 'Other' && r.choices.includes('Nova Scotia') && !r.choices.includes('Halifax area'), 'province buttons'));
await talk('Other: type a place', ['warehouse jobs halifax', 'Somewhere else', 'Other', 'Truro'], (r) => expect(r.jobs?.length && /Truro/.test(r.reply), 'searches the typed place'));
await talk('Unknown work, honest miss', ['marine biologist jobs'], (r) => expect(!r.jobs?.length && /marine biologist/.test(r.reply), 'names it, shows nothing random'));

// ---- Employers: any role, in their own words ----
await talk('Role: senior architect (employer page)', ['a senior architect in Alberta'], (r) => expect(/senior architect in Alberta/.test(r.reply) && r.meta.ask === 'hire-service', 'reads the role, asks contract or permanent'), 'employer');
await talk('Role: architect, no page hint', ['we need an architect'], (r) => expect(r.meta.mode === 'employer' && /architect/.test(r.reply), 'employer, not a job search'));
await talk('Role: words it has never seen', ['3 tire techs in Truro'], (r) => expect(/Three tire techs in Truro/.test(r.reply), 'takes their words'), 'employer');
await talk('Role: permanent buyer', ['permanent buyer in Charlottetown'], (r) => expect(r.contact?.name === 'Zowie Tucker', 'permanent goes to Zowie'), 'employer');
await talk('Jobs at ISL itself', ['do you have jobs working at ISL itself'], (r) => expect(r.contact?.name === 'Shelley Lewis' && !r.jobs?.length, 'Shelley, no search'));

// ---- French: understood and answered in French, buttons included ----
const fr = (r) => r.meta?.lang === 'fr';
await talk('FR: job search', ['je cherche du travail en entrepôt à Halifax'], (r) => expect(fr(r) && /postes d’entrepôt/.test(r.reply) && r.choices.includes('Ailleurs'), 'French search, French buttons'));
await talk('FR: elision and nearby', ["emplois d'entrepôt à Moncton", 'Montrez-les-moi'], (r) => expect(fr(r) && r.jobs?.length, 'reads d’entrepôt, widens'));
await talk('FR: no accent words', ['cuisinier à Dartmouth'], (r) => expect(fr(r) && /cuisine/.test(r.reply), 'detected as French'));
await talk('FR: buttons round trip', ['Je cherche du travail', 'Métiers', 'Seulement permanent'], (r) => expect(fr(r) && /permanents/.test(r.reply), 'French buttons are understood'));
await talk('FR: no experience', ["je n'ai pas d'expérience"], (r) => expect(fr(r) && /débutants/.test(r.reply), 'entry-level'));
await talk('FR: citizen question', ['Faut-il être citoyen canadien?'], (r) => expect(fr(r) && /citoyen canadien ou résident permanent/.test(r.reply), 'states the rule in French'));
await talk('FR: worker hurt', ['je me suis blessé au travail'], (r) => expect(fr(r) && /911/.test(r.reply) && /8 h 30/.test(r.reply), 'safety first, hours and urgent line'));
await talk('FR: who', ['qui est responsable du marketing?'], (r) => expect(fr(r) && r.contact?.name === 'Josiah Yule', 'Josiah'));
await talk('FR: employer, full flow', ['nous embauchons', 'des caristes', 'Nouveau-Brunswick', 'Pour une période déterminée', 'Dès que possible'],
  (r) => expect(fr(r) && r.contact?.name === 'Kelli Wetmore' && r.contact.action.label === 'Envoyer ma demande à Kelli' && r.summary.some(([k, v]) => k === 'Poste' && v === 'Caristes'), 'routed, French card and summary'));
await talk('FR: employer own words', ['un architecte principal en Alberta', 'Permanent'], (r) => expect(fr(r) && r.contact?.name === 'Zowie Tucker' && r.summary.some(([k, v]) => k === 'Poste' && v === 'Architecte principal'), 'keeps their words'), 'employer');
await talk('FR: pay card', ['combien gagnent les chauffeurs en Nouvelle-Écosse?'], (r) => expect(fr(r) && /\$\/heure/.test(r.insight?.figure) && /Nouvelle-Écosse/.test(r.insight.kicker), 'French figures'));
await talk('FR: job page', ['Quel est le salaire?'], (r) => expect(fr(r) && /^Le salaire est de 19 \$\/heure/.test(r.reply), 'French pay answer'), 'seeker', ctx);
await talk('FR: switch and back', ['Français', 'English'], (r) => expect(r.meta.lang === 'en' && /^Sure!/.test(r.reply), 'switches back to English'));
await talk('FR: greeting language carries', ['asdfgh'], (r) => expect(fr(r) && /^(Désolé|Hmm, je)/.test(r.reply), 'French from the greeting'), null, {});
await talk('EN: stays English', ['warehouse jobs in halifax'], (r) => expect(r.meta.lang === 'en' && /^Good news/.test(r.reply), 'English unchanged'));

// ---- Accountant Staffing and Administrative Staffing: the same assistant, their own brand ----
// They route to the office that covers the province, name their services "temporary" and
// "permanent", and point work they don't do to the sister company that does.
const sample = (b) => JSON.parse(readFileSync(new URL(`../../src/brands/jobs/${b}.json`, import.meta.url))).jobs;
respond = createEngine({ loadJobs: async () => sample('as'), siteUrl: (p) => '/isl-sandbox/as' + p, brand: 'as' });
await talk('AS: bot says who it is', ['are you a bot?'], (r) => expect(/Accountant Staffing’s virtual assistant/.test(r.reply) && r.choices.includes("I'm looking for work"), 'names the brand'));
await talk('AS: job search', ['bookkeeper jobs in st johns'], (r) => expect(r.jobs?.length && r.jobs.every((j) => /Bookkeeper/.test(j.title)), 'finds the bookkeeper jobs'));
await talk('AS: accounting jobs in Halifax', ['accounting jobs in Halifax'], (r) => expect(r.jobs?.length >= 2 && r.jobs.every((j) => /NS/.test(j.location)), 'accounting roles around Halifax'));
await talk('AS: temporary only', ["I'm looking for work", 'Accountant', 'Only temporary'], (r) => expect(r.jobs?.every((j) => j.employment !== 'Permanent') && /temporary/.test(r.reply), 'temporary, in its own words'));
await talk('AS: warehouse goes to ISL', ['warehouse jobs in halifax'], (r) => expect(/Integrated Staffing, our sister company/.test(r.reply) && r.choices.some((c) => c.href === 'https://www.integratedstaffing.ca/find-work'), 'points to ISL’s job board'));
await talk('AS: reception goes to ADS', ['receptionist jobs in Moncton'], (r) => expect(/Administrative Staffing/.test(r.reply), 'points to ADS'));
await talk('AS: employer, full flow', ["I'm hiring", 'A controller', 'New Brunswick', 'Permanent'],
  (r) => expect(r.contact?.name === 'Moncton office' && r.contact.phone === '506-800-0074' && r.summary.some(([k, v]) => k === 'Type' && v === 'Permanent') && r.choices[0].label === 'How permanent recruitment works', 'Moncton office, permanent'));
await talk('AS: employer, PEI goes to Halifax', ['we need a temporary accountant in Charlottetown asap'],
  (r) => expect(r.contact?.name === 'Halifax office' && /we cover Charlottetown! Our Halifax office covers Prince Edward Island/.test(r.reply) && r.summary.some(([k, v]) => k === 'Type' && v === 'Temporary'), 'Halifax covers PEI'));
await talk('AS: employer, labourers go to ISL', ['I need 3 labourers in Truro'], (r) => expect(/Integrated Staffing, our sister company/.test(r.reply) && r.contact?.name === 'Meg Antonick', 'ISL’s recruiter for Nova Scotia'));
await talk('AS: fees', ['how much do you charge?'], (r) => expect(/no upfront fees/.test(r.reply) && /first-year compensation/.test(r.reply), 'the brand’s own terms'));
await talk('AS: guarantee', ["I'm hiring", 'does it come with a guarantee?'], (r) => expect(/six months/.test(r.reply) && !/90 days/.test(r.reply), 'six months, not ISL’s 90 days'));
await talk('AS: offices', ['where are your offices?'], (r) => expect(/three offices/.test(r.reply) && r.choices.length === 3 && /902-491-1301/.test(r.reply), 'its three offices'));
await talk('AS: worker', ['I work with Accountant Staffing', 'Moncton'], (r) => expect(r.contact?.name === 'Moncton office', 'their office'));
await talk('AS: worker hurt', ['I got hurt at work'], (r) => expect(/your Accountant Staffing office/.test(r.reply) && !/response coordinators/.test(r.reply), 'own office, no ISL numbers'));
await talk('AS: payroll widens to accounting', ['payroll jobs'], (r) => expect(/accounting and finance roles are close/.test(r.reply) && r.jobs?.length, 'accounting roles, not office ones'));
await talk('AS: pay', ['what do accountants make?'], (r) => expect(/don’t list pay yet/.test(r.reply) && !r.insight, 'says honestly there is no pay data'));
await talk('AS: cost', ['what would a $30/hour employee really cost me?'], (r) => expect(r.insight?.figure && /true-cost/.test(r.insight.link.href), 'the cost calculator works'));
await talk('AS: who, marketing', ["who's in charge of marketing?"], (r) => expect(r.contact?.name === 'Josiah Yule' && !r.choices?.length, 'Josiah, no team page link'));
await talk('AS: who, the CEO', ['who is the CEO?'], (r) => expect(r.contact?.name === 'Halifax office' && !/team page/.test(r.reply), 'the Halifax office'));
await talk('AS: about', ['what is accountant staffing?'], (r) => expect(/Since 2002/.test(r.reply) && /accounting and finance professionals/.test(r.reply), 'about the brand'));
await talk('AS: not a citizen', ["I'm on a work permit"], (r) => expect(/placed through Accountant Staffing/.test(r.reply), 'the rule, in its name'));
await talk('AS: apply', ['how do I apply?'], (r) => expect(r.choices.some((c) => /tracker-rms/.test(c.href || '')), 'the shared Tracker RMS portal'));
await talk('AS FR: employer', ['Un comptable temporaire à Moncton', 'Dès que possible'], (r) => expect(fr(r) && r.contact?.name === 'Bureau de Moncton' && r.summary.some(([k, v]) => k === 'Type' && v === 'Temporaire'), 'French, temporary'), 'employer');
await talk('AS FR: job search', ['Je cherche un emploi de teneur de livres'], (r) => expect(fr(r) && r.jobs?.length && r.jobs.every((j) => /Bookkeeper/.test(j.title)), 'French bookkeeper'));

respond = createEngine({ loadJobs: async () => sample('ads'), siteUrl: (p) => '/isl-sandbox/ads' + p, brand: 'ads' });
await talk('ADS: office jobs', ['office admin jobs'], (r) => expect(r.jobs?.length && /Administrative Staffing|open/.test(r.reply), 'finds office roles'));
await talk('ADS: HR', ['HR jobs in Halifax'], (r) => expect(r.jobs?.some((j) => /Human Resources/.test(j.title)), 'HR manager'));
await talk('ADS: accounting goes to AS', ['tax jobs in Moncton'], (r) => expect(/Accountant Staffing, our sister company/.test(r.reply) && r.choices.some((c) => c.href === 'https://www.accountantstaffing.ca/job-opportunities'), 'points to AS'));
await talk('ADS: employer, executive assistant', ['An executive assistant in St. John’s', 'For a set time', 'In the next few weeks'],
  (r) => expect(r.contact?.name === "St. John's office" && r.summary.some(([k, v]) => k === 'Role' && v === 'Executive assistant'), 'St. John’s office'), 'employer');
await talk('ADS: employer, outside Atlantic', ["I'm hiring", 'A receptionist', 'Elsewhere in Canada', 'Permanent'], (r) => expect(r.contact?.name === 'Halifax office' && /head office/.test(r.reply), 'Halifax, the head office'));
await talk('ADS: drivers go to ISL', ['we need 2 delivery drivers in Moncton'], (r) => expect(/Integrated Staffing/.test(r.reply) && r.contact?.name === 'Kelli Wetmore', 'ISL’s NB recruiter'));
await talk('ADS: bookkeeper elsewhere, not a referral', ['bookkeeper jobs in Halifax'], (r) => expect(/Newfoundland and Labrador/.test(r.reply) && !/sister/.test(r.reply), 'offers its own job in NL'));
// Josiah, Oct 29: AS and ADS take what either can do; only work neither does goes to ISL. Same hours, no after-hours line.
await talk('ADS: accountant hire stays with AS/ADS', ['we need a temporary accountant in Halifax asap'], (r) => expect(r.contact?.name === 'Halifax office' && !/Integrated Staffing/.test(r.reply), 'the shared office, not ISL'));
await talk('ADS: hours, no after-hours line', ['what are your office hours?'], (r) => expect(/8:30 to 4:30/.test(r.reply) && !/around the clock|response coordinator/.test(r.reply), 'hours only'));
await talk('ADS: not a citizen', ["I'm an international student"], (r) => expect(/placed through Administrative Staffing, you need to be a Canadian citizen or a permanent resident/.test(r.reply), 'same rule as ISL'));
await talk('ADS: who runs ADS', ['who runs ADS?'], (r) => expect(r.contact?.name === 'Halifax office', 'not mistaken for ads'));
await talk('ADS: scam', ['is this text from administrative staffing real?'], (r) => expect(/Administrative Staffing never charges/.test(r.reply), 'own name'));

console.log(failures ? `\n${failures} failed` : '\nall passed');
if (failures) process.exit(1);
