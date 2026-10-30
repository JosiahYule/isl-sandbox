// The chat's measuring, its miss log and job alerts (October 2026)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { JSDOM } from 'jsdom';
import { eventParameters } from '../src/lib/tracking.js';
import { redact } from '../assistant/supabase/functions/_shared/redact.js';
import { digestEmail, confirmEmail, alertPage, searchKey, SENDER } from '../assistant/supabase/functions/_shared/alerts.js';
import { newMatches } from '../scripts/send-job-alerts.mjs';

execSync('node scripts/sync-assistant.mjs', { stdio: 'ignore' });
const { rankJobs, createEngine } = await import('../public/assistant/demo-engine.js');
const jobs = JSON.parse(await fs.readFile('test/fixtures/jobs.json', 'utf8'));
const feed = Array.isArray(jobs) ? jobs : jobs.jobs;
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));

test('chat events reach analytics with labels only, never words', () => {
  const ctx = { brand: 'isl', path: '/find-work/' };
  assert.deepEqual(eventParameters('chat_fallback', { via: 'assistant', miss_kind: 'unclear', text: 'my email is a@b.c' }, ctx),
    { brand: 'isl', audience: 'general', page_path: '/find-work/', via: 'assistant', miss_kind: 'unclear' });
  assert.equal(eventParameters('chat_intent', { intent: 'employer' }, ctx).intent, 'employer');
  assert.equal(eventParameters('chat_intent', { intent: 'hacker' }, ctx).intent, undefined);
  assert.equal(eventParameters('apply_click', { via: 'assistant' }, ctx).via, 'assistant');
  assert.equal(eventParameters('job_alert_signup', { preview: true }, ctx).preview, true);
});

test('contact details are taken out before a miss is saved', () => {
  assert.equal(redact('call me 902-555-0100 or jo.smith+x@mail.ca, SIN 123456789, B3A 4S5'), 'call me [number] or [email], SIN [number], [postal code]');
  assert.equal(redact('x'.repeat(500)).length, 300);
  assert.equal(redact('forklift   jobs\n near me'), 'forklift jobs near me');
});

test('the chat flags what it could not understand and offers alerts on ISL searches', async () => {
  const isl = createEngine({ loadJobs: async () => feed, siteUrl: (p) => p });
  const ask = async (engine, text) => engine([{ role: 'assistant', content: 'g', meta: {} }, { role: 'user', content: text }], {});
  assert.equal((await ask(isl, 'asdfgh')).meta.miss, 'unclear');
  assert.equal((await ask(isl, 'marine biologist jobs')).meta.miss, 'no-match');
  const found = await ask(isl, 'warehouse jobs in dartmouth');
  assert.ok(found.meta.search && found.meta.searchLabel);
  assert.ok(found.choices.some((c) => c.action === 'alerts'));
  const as = createEngine({ loadJobs: async () => feed, siteUrl: (p) => p, brand: 'as' });
  assert.ok(!(await ask(as, 'accountant jobs in halifax')).choices?.some((c) => c.action === 'alerts'), 'AS has no live feed yet');
});

test('an alert only hears about new jobs it has not been sent', () => {
  const search = { terms: null, place: null, employment: 'any', attrs: [], minPay: null };
  const sorted = [...feed].sort((a, b) => String(b.posted).localeCompare(String(a.posted)));
  const newest = sorted[0];
  const alert = { search, confirmed_at: `${newest.posted}T09:00:00Z`, sent_ids: [] };
  const first = newMatches(alert, feed, rankJobs);
  assert.ok(first.length && first.every((j) => j.posted >= newest.posted), 'only jobs posted since confirming');
  assert.deepEqual(newMatches({ ...alert, sent_ids: first.map((j) => j.id) }, feed, rankJobs), [], 'never the same job twice');
});

test('alert emails say who they are from and how to stop them (CASL)', async () => {
  const d = digestEmail({ label: 'warehouse roles around Dartmouth', lang: 'en', jobs: feed.slice(0, 2), unsubscribeUrl: 'https://x.test/u?unsubscribe=t', site: 'https://www.integratedstaffing.ca' });
  for (const part of [d.html, d.text]) { assert.match(part, /unsubscribe=t/); assert.ok(part.includes(SENDER.address)); }
  const c = confirmEmail({ label: '<b>x</b>', lang: 'fr', confirmUrl: 'https://x.test/c', site: 'https://www.integratedstaffing.ca' });
  assert.ok(!c.html.includes('<b>x</b>'), 'escaped');
  assert.match(c.subject, /Confirmez/);
  assert.match(alertPage('unsubscribe', { lang: 'en', site: 'https://x.test', action: 'https://x.test/u' }), /<form method="post"/);
  assert.equal(await searchKey({ a: 1, b: [2] }), await searchKey({ b: [2], a: 1 }), 'same search, same key');
});

test('the chat window runs job alerts as a preview until switched on, and reports misses', async () => {
  const dom = new JSDOM('', { url: 'https://example.test/find-work/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  const posted = [];
  w.fetch = async (url, init) => { posted.push({ url, body: JSON.parse(init.body) }); return { ok: true, json: async () => ({ ok: true }) }; };
  const events = [];
  w.document.addEventListener('isl:track', (e) => events.push(e.detail.name));
  try {
    w.eval(await fs.readFile('assistant/widget/widget.js', 'utf8'));
    let n = 0;
    const replies = [
      { reply: 'Hmm, I’m not sure I follow.', meta: { ask: 'unclear', miss: 'unclear' } },
      { reply: 'Two warehouse roles.', jobs: [{ id: 'a', title: 'Shipper', employment: 'Permanent', location: 'Dartmouth, NS', viewUrl: '/a', applyUrl: '/a/apply' }],
        choices: [{ label: 'Email me jobs like these', action: 'alerts' }], meta: { mode: 'seeker', search: { terms: null }, searchLabel: 'warehouse roles around Dartmouth' } },
    ];
    const chat = w.ISLJobChat.mount({ send: async () => replies[n++], alerts: true, missEndpoint: 'https://misses.test/', alertsEndpoint: '' });
    chat.open();
    const $ = (s) => w.document.querySelector('#isl-job-chat').shadowRoot.querySelector(s);
    const send = (t) => { $('textarea').value = t; $('form').dispatchEvent(new w.Event('submit', { cancelable: true })); };
    send('call me on 902 555 0100 asdf');
    await wait(700);
    assert.equal(posted[0].url, 'https://misses.test/');
    assert.equal(posted[0].body.text, 'call me on [number] asdf');
    send('warehouse dartmouth');
    await wait(700);
    [...w.document.querySelector('#isl-job-chat').shadowRoot.querySelectorAll('.choices button')].find((b) => /Email me/.test(b.textContent)).click();
    $('.alertform input[type=email]').value = 'jo@example.test';
    $('.alertform form, .alertform').dispatchEvent(new w.Event('submit', { cancelable: true }));
    await wait(20);
    assert.match($('.alertform .bad').textContent, /tick the box/, 'consent is required');
    $('.alertform input[type=checkbox]').checked = true;
    $('.alertform').dispatchEvent(new w.Event('submit', { cancelable: true }));
    await wait(50);
    assert.equal(posted.length, 1, 'nothing sent without an alerts address');
    assert.match([...w.document.querySelector('#isl-job-chat').shadowRoot.querySelectorAll('.msg.bot')].at(-1).textContent, /Preview only/);
    assert.deepEqual(events.filter((e) => e !== 'chat_open'), ['chat_fallback', 'chat_intent', 'job_alert_signup']);
  } finally { w.close(); }
});
