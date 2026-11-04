import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { matchesJobQuery } from '../src/lib/jobsearch.js';
import { resolveCompensation, checkCompensation } from '../assistant/supabase/functions/_shared/compensation.js';
import { readPay, payByFamily } from '../assistant/supabase/functions/_shared/pay.js';
const jobs = JSON.parse(fs.readFileSync(new URL('./fixtures/jobs.json', import.meta.url)));
const forklift = jobs.find((job) => job.id === 'NF5909203102');
const text = (j) => [j.title, j.category, j.subcategory, j.city, j.province, j.description].join(' ');

test('a role and city match regardless of order or intervening title words', () => {
  assert(matchesJobQuery(text(forklift), 'forklift Dartmouth'));
  assert(matchesJobQuery(text(forklift), 'Dartmouth forklift'));
  assert(!matchesJobQuery(text(forklift), 'forklift Moncton'));
  assert(matchesJobQuery('Labourer St. John’s NL', 'laborer st johns'));
  assert(matchesJobQuery('Réceptionniste Moncton', 'reception Moncton'));
  assert(!matchesJobQuery('Construction labourer Dartmouth NS', 'ON'));
  assert(matchesJobQuery(text(forklift), ''));
});

test('part time and full time are searched as one term, however they are written', () => {
  for (const q of ['part time', 'part-time', 'parttime', 'Part Time']) assert(matchesJobQuery('Bookkeeper, part-time hours', q), q);
  assert(!matchesJobQuery('Full-time role. Report to the partner.', 'part time'));
  assert(!matchesJobQuery('Full-time role', 'time'), 'a full-time posting no longer matches "time" on its own');
  assert(matchesJobQuery('Full time warehouse', 'full-time'));
});

test('a job row can be found by its office area and its province name', () => {
  const html = fs.readFileSync(new URL('../dist/find-work/index.html', import.meta.url), 'utf8');
  const row = html.match(new RegExp(`data-job-id="${forklift.id}"[^>]*data-search="([^"]*)"`))?.[1] ?? '';
  assert.equal(forklift.city, 'Dartmouth');
  assert(matchesJobQuery(row, 'forklift Halifax'), 'a Dartmouth job turns up when searching Halifax');
  assert(matchesJobQuery(row, 'nova scotia'));
});

test('a conflicting rate is withheld across published copy, salary data and pay tools', () => {
  const before = JSON.stringify(forklift);
  const published = resolveCompensation(forklift);
  assert.equal(published.pay, '');
  assert.equal(published.payLabel, 'Confirm pay with recruiter');
  assert.equal(published.payStatus, 'conflict');
  assert(!published.description.includes('$18.00-$20.00/hour'));
  assert.equal(readPay(published.pay), null);
  assert.equal(payByFamily([published]).length, 0);
  assert.equal(JSON.stringify(forklift), before, 'the original sources are preserved for recruiter review');
  assert.deepEqual(resolveCompensation(published), published, 'safe to consume already-resolved data');
});

test('all work-site pay tiers are considered; a legitimate combined range is retained', () => {
  const job = jobs.find((j) => j.id === 'CM7900181730');
  assert.equal(checkCompensation(job).conflict, false);
  assert.equal(resolveCompensation(job).pay, '$28 to $50/hour');
});

test('description pay fills a missing feed field without dropping vacation benefits', () => {
  const published = resolveCompensation(jobs.find((j) => j.id === 'JL2702485101'));
  assert.equal(published.pay, '$18/hour');
  assert(published.description.includes('4% vacation pay'));
  assert.equal(resolveCompensation({ pay: '$55 to $65,000/year', description: '' }).pay, '$55,000 to $65,000/year');
});

test('annual ranges are checked, but mixed hourly and yearly figures are not guessed', () => {
  assert.equal(checkCompensation({ pay: '$50,000/year', description: 'Salary: $55,000 annually' }).conflict, true);
  assert.equal(checkCompensation({ pay: '$62,400 to $83,200/year', description: '$30-$40 per hour' }).conflict, false);
  assert.equal(checkCompensation({ pay: '$20/hour', description: 'Employee referral bonus: $100 per year' }).conflict, false);
});

test('a range with units at both ends becomes one clear confirmation, keeping vacation pay', () => {
  const job = { pay: '$25/hour', description: 'PAY\n• $20.00/hour to $35.00/hour+ 4% vacation pay depending on experience\nSCHEDULE\nMonday to Friday' };
  const result = resolveCompensation(job);
  assert.equal(result.payStatus, 'conflict');
  assert.equal((result.description.match(/Pay to be confirmed with recruiter/g) || []).length, 1);
  assert(result.description.includes('; plus 4% vacation pay'));
  assert(result.description.includes('Monday to Friday'));
  assert(!result.description.includes('$20') && !result.description.includes('$35'));
});
