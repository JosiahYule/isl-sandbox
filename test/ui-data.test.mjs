import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { CHECKS } from '../src/lib/resume.js';
import { htmlJson } from '../src/lib/html-json.js';

const numbers = CHECKS.find((check) => check.id === 'numbers');
test('quantified resume examples work across sentences, bullets, dates and decimal amounts', () => {
  assert(numbers.test('Moved 40 pallets per shift while following safety procedures. Maintained 99% inventory accuracy.'));
  assert(numbers.test('• In 2023, served 25 customers per day.\n• Reduced costs by $4,500.50 annually.'));
  assert(!numbers.test('Experience 2020–2025\nPhone: 902-555-0100'));
  assert(!numbers.test('Moved 40 pallets per shift.'));
  assert(numbers.fix('Moved 40 pallets per shift.').includes('one quantified example'));
});

test('untrusted feed content cannot break out of an inline JSON script', () => {
  const original = { title: '</script><script>alert("x")</script><!--', description: 'A\u2028B\u2029C' };
  const dom = new JSDOM(`<script type="application/ld+json">${htmlJson(original)}</script><h1>Job</h1>`);
  try {
    assert.equal(dom.window.document.querySelectorAll('script').length, 1);
    assert.deepEqual(JSON.parse(dom.window.document.querySelector('script').textContent), original);
    assert.equal(dom.window.document.querySelector('h1').textContent, 'Job');
  } finally { dom.window.close(); }
});
