// The AI chat's turn (assistant/supabase/functions/_shared/converse.js), with a pretend model
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { converse, cleanConversation } from '../assistant/supabase/functions/_shared/converse.js';
import { searchJobs } from '../assistant/supabase/functions/_shared/jobs.js';

const jobs = JSON.parse(readFileSync('test/fixtures/jobs.json', 'utf8'));
const [a, b] = jobs;

test('the model is told which cards and summary were on screen, using only real postings', () => {
  const turns = cleanConversation([
    { role: 'assistant', content: 'Hi there!', meta: { mode: 'seeker' } },
    { role: 'user', content: 'warehouse jobs' },
    { role: 'assistant', content: 'Here are two.', meta: { shown: [a.id, 'FAKE-1', b.id], summary: [['Role', '3 labourers'], ['Where', 'Halifax']] } },
    { role: 'user', content: 'the first one' },
  ], jobs);
  assert.equal(turns[0].role, 'user', 'starts with the visitor');
  const note = turns[1].content;
  assert.match(note, new RegExp(`1\\. .*\\(job_id ${a.id}\\); 2\\. .*\\(job_id ${b.id}\\)`));
  assert.ok(!note.includes('FAKE-1'), 'ids that are not real postings are dropped');
  assert.match(note, /request summary shown: Role: 3 labourers; Where: Halifax/);
});

test('a corrected request is rebuilt with every detail, including length and notes', async () => {
  const script = [
    { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'find_contact', input: { audience: 'employer', service: 'contract', place: 'Moncton', role: 'labourers', headcount: 5, start: 'next Monday', length: 'two weeks', notes: '3 in Halifax, 2 in Moncton' } }] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Kelli handles new client requests in New Brunswick.' }], usage: { input_tokens: 900, output_tokens: 40 } },
  ];
  let n = 0;
  const out = await converse({ messages: [{ role: 'user', content: 'Actually make that 5, and Moncton' }], jobs, callModel: async () => script[n++] });
  const rows = Object.fromEntries(out.summary);
  assert.equal(rows.Role, '5 labourers');
  assert.equal(rows.Length, 'two weeks');
  assert.equal(rows.Notes, '3 in Halifax, 2 in Moncton');
  assert.equal(out.contact.name, 'Kelli Wetmore');
  assert.match(new URL(out.contact.action.href).searchParams.get('details'), /Length: two weeks\. Notes: 3 in Halifax, 2 in Moncton/);
  assert.deepEqual(out.trace.map((t) => t.tool), ['find_contact']);
  assert.equal(out.usage.calls, 2);
  assert.equal(out.usage.output_tokens, 40);
});

test('when the model cannot be reached, the visitor gets the offices in their language', async () => {
  const down = async () => { throw new Error('Claude API 400'); };
  const en = await converse({ messages: [{ role: 'user', content: 'I got hurt at work' }], jobs, callModel: down });
  assert.equal(en.meta.fallback, true);
  assert.equal(en.offices.length, 5);
  const fr = await converse({ messages: [{ role: 'user', content: 'Je me suis blessé au travail' }], jobs, callModel: down });
  assert.match(fr.reply, /bureaux/);
});

test('search leaves out what the visitor ruled out', () => {
  const all = searchJobs(jobs, { keywords: [], limit: 15 }).matching;
  const noDriving = searchJobs(jobs, { keywords: [], exclude: ['driver', 'driving'], limit: 15 });
  assert.ok(noDriving.matching < all);
  assert.ok(noDriving.results.every((r) => !/driver/i.test(r.title)));
});
