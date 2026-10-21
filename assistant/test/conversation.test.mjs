// Scripted conversations through the demo engine. Run after `npm run sync-assistant`:
//   node assistant/test/conversation.test.mjs
// Prints each exchange so the wording can be read, and checks the key outcomes.
import { readFileSync } from 'node:fs';
import { createEngine } from '../../public/assistant/demo-engine.js';

const jobs = JSON.parse(readFileSync(new URL('../data/jobs-snapshot.json', import.meta.url)));
const respond = createEngine({ loadJobs: async () => jobs, siteUrl: (p) => '/isl-sandbox' + p });

let failures = 0;
async function talk(name, lines, check, greetingMode, context = {}) {
  console.log(`\n=== ${name}`);
  const messages = greetingMode ? [{ role: 'assistant', content: '(greeting)', meta: { mode: greetingMode } }] : [];
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
await talk('Employer: outside Atlantic', ["I'm hiring", '10 cleaners', 'Elsewhere in Canada', 'For a set time', 'Make it a permanent search'],
  (r) => expect(r.contact?.name === 'Zowie Tucker', 'outside Atlantic: permanent only'));
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

console.log(failures ? `\n${failures} failed` : '\nall passed');
process.exit(failures ? 1 : 0);
