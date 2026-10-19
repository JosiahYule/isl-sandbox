// Scripted conversations through the demo engine. Run after `npm run sync-assistant`:
//   node assistant/test/conversation.test.mjs
// Prints each exchange so the wording can be read, and checks the key outcomes.
import { readFileSync } from 'node:fs';
import { createEngine } from '../../public/assistant/demo-engine.js';

const jobs = JSON.parse(readFileSync(new URL('../data/jobs-snapshot.json', import.meta.url)));
const respond = createEngine({ loadJobs: async () => jobs, siteUrl: (p) => '/isl-sandbox' + p });

let failures = 0;
async function talk(name, lines, check, greetingMode) {
  console.log(`\n=== ${name}`);
  const messages = greetingMode ? [{ role: 'assistant', content: '(greeting)', meta: { mode: greetingMode } }] : [];
  let last;
  for (const line of lines) {
    messages.push({ role: 'user', content: line });
    last = await respond(messages);
    messages.push({ role: 'assistant', content: last.reply, meta: last.meta });
    console.log(`  > ${line}\n  < ${last.reply}`);
    if (last.jobs?.length) console.log(`    [${last.jobs.map((j) => j.title + ' (' + j.location + ')').join('; ')}]`);
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
  (r) => expect(r.contact?.name === 'Kelli Wetmore' && r.contact.phone === '506-801-1446', 'NB contract goes to Kelli, Moncton line'));
await talk('Employer: Saint John area', ['need two drivers in Quispamsis on contract asap'],
  (r) => expect(r.contact?.name === 'Kelli Wetmore' && r.contact.phone === '506-717-0607', 'Quispamsis goes to Kelli, Saint John line'));
await talk('Employer: outside Atlantic', ["I'm hiring", '10 cleaners', 'Elsewhere in Canada', 'For a set time', 'Make it a permanent search'],
  (r) => expect(r.contact?.name === 'Zowie Tucker', 'outside Atlantic: permanent only'));
await talk('Employer: asks price', ['Looking to hire a receptionist in Charlottetown', 'how much does it cost?'],
  (r) => expect(r.contact?.name === 'Chance Skauge', 'Charlottetown goes to Chance'));
await talk("Employer: St. John's", ["We need 4 cleaners in Mount Pearl", 'For a set time', 'Planning ahead'],
  (r) => expect(r.contact?.name === 'Crystal Murphy' && r.contact.phone === '709-800-2454', "St. John's goes to Crystal"));
await talk('Employer mode page greeting', ['A permanent controller in Moncton'],
  (r) => expect(r.contact?.name === 'Zowie Tucker', 'employer page mode'), 'employer');

await talk('Seeker: remembers the job type', ['warehouse work in halifax', 'what about moncton?'],
  (r) => expect(r.meta.mode === 'seeker', 'seeker'));
await talk('Seeker: show more and filter', ['Driving jobs', 'Show more', 'Only permanent'], () => {});
await talk('Seeker: fees and apply', ["I'm looking for work", 'is it free?', 'how do i apply'], (r) => expect(/Apply button/.test(r.reply), 'apply answer'));
await talk('Seeker: nothing matches', ['marine biologist jobs in PEI'], () => {});
await talk('Mode switch', ['hi', "I'm hiring", "actually I'm looking for work", 'office jobs in Dartmouth'], (r) => expect(r.jobs?.length, 'jobs after switch'));

console.log(failures ? `\n${failures} failed` : '\nall passed');
process.exit(failures ? 1 : 0);
