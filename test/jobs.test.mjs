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
