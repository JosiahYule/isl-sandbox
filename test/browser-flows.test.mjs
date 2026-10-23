// DOM integration tests execute the actual page scripts against Astro's built HTML.
// They do not contact Google, Resend, candidates or recruiters.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { webcrypto } from 'node:crypto';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
const pause = () => new Promise((resolve) => setTimeout(resolve, 30));
async function setup(page, source, options = {}) {
  const html = await fs.readFile('dist/' + page + 'index.html', 'utf8');
  const dom = new JSDOM(html, { url: 'https://example.test/isl-sandbox/' + page + (options.query || ''), runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.matchMedia = () => ({ matches: false, addEventListener() {} });
  Object.defineProperty(w, 'crypto', { value: webcrypto });
  w.scrollTo = () => {};
  w.document.querySelector('#request')?.removeAttribute('data-endpoint'); // a configured production endpoint must never be used in tests
  const config = w.document.querySelector('[data-analytics-config]');
  config.dataset.ga4 = options.analytics ? 'G-TEST123' : '';
  if (options.consent) w.localStorage.setItem('isl-consent', options.consent);
  const text = await fs.readFile(source, 'utf8');
  const script = text.match(/<script>([\s\S]*?)<\/script>/)[1];
  const bundle = await build({ stdin: { contents: script, loader: 'ts', resolveDir: path.resolve(path.dirname(source)) }, bundle: true, write: false, format: 'iife', platform: 'browser' });
  return { dom, w, run: () => w.eval(bundle.outputFiles[0].text) };
}

test('job-board role+city matching, shareable filters, reload and clear all', async () => {
  const { dom, w, run } = await setup('find-work/', 'src/pages/find-work/index.astro');
  try {
    const doc = w.document;
    const rows = [...doc.querySelectorAll('[data-list] > [data-job-id]')];
    // Pick an actual currently-open role; scheduled live-feed updates must not break the test.
    const target = doc.querySelector('[data-job-id="NF5909203102"]') || rows.find((row) => row.querySelector('h3').textContent.trim().includes(' ') && row.querySelector('.where').textContent.includes(','));
    assert(target, 'the board contains a role with a location');
    const titleWord = target.querySelector('h3').textContent.trim().split(/\s+/)[0];
    const city = target.querySelector('.where').textContent.split(',')[0].trim();
    const term = titleWord + ' ' + city;
    const params = new URLSearchParams({ utm_source: 'linkedin', q: term, province: target.dataset.province, type: target.dataset.type });
    w.history.replaceState(null, '', '?' + params);
    run();
    assert.equal(doc.querySelector('#q').value, term);
    assert(Number(doc.querySelector('[data-count]').textContent) >= 1);
    assert.equal(target.hidden, false);
    assert.equal(doc.querySelector('[data-reset]').hidden, false, 'clear is available with matching results');
    const posting = new URL(target.querySelector('h3 a').href);
    assert.equal(posting.searchParams.get('q'), term);
    assert.equal(posting.searchParams.get('utm_source'), null, 'only result context is copied');
    const q = doc.querySelector('#q'); q.value = 'nonexistentrole'; q.dispatchEvent(new w.Event('input'));
    assert.equal(new URL(w.location.href).searchParams.get('q'), 'nonexistentrole');
    doc.querySelector('[data-reset]').click();
    for (const key of ['q', 'province', 'industry', 'type', 'area']) assert.equal(new URL(w.location.href).searchParams.has(key), false);
    assert.equal(new URL(w.location.href).searchParams.get('utm_source'), 'linkedin');
    assert.equal(doc.querySelector('[data-count]').textContent, String(rows.length));
    assert.equal(doc.querySelector('[data-reset]').hidden, true);
    assert.equal(rows.filter((row) => !row.hidden).length, Math.min(15, rows.length));
    assert(doc.querySelector('[data-result-summary]').textContent.startsWith(`Showing ${Math.min(15, rows.length)} of ${rows.length}`));
    if (rows.length > 15) {
      doc.querySelector('[data-more]').click();
      assert.equal(rows.filter((row) => !row.hidden).length, rows.length);
      assert.equal(new URL(w.location.href).searchParams.get('view'), 'all');
      assert.equal(new URL(rows[15].querySelector('h3 a').href).searchParams.get('view'), 'all');
    }
  } finally { dom.window.close(); }
});

test('a posting returns to the same filtered results without accepting an external return URL', async () => {
  const board = new JSDOM(await fs.readFile('dist/find-work/index.html', 'utf8'));
  const postingPath = board.window.document.querySelector('[data-list] h3 a').getAttribute('href').replace('/isl-sandbox/', '');
  board.window.close();
  const { dom, w, run } = await setup(postingPath, 'src/pages/find-work/[slug].astro', { query: '?q=warehouse&province=NS&type=contract&view=all&return=https://unrelated.test' });
  try {
    run();
    const back = w.document.querySelector('a.back');
    assert.equal(back.textContent, '← Back to results');
    const destination = new URL(back.href);
    assert.equal(destination.pathname, '/isl-sandbox/find-work/');
    assert.equal(destination.searchParams.get('q'), 'warehouse');
    assert.equal(destination.searchParams.get('province'), 'NS');
    assert.equal(destination.searchParams.get('view'), 'all');
    assert.equal(destination.searchParams.has('return'), false);
  } finally { dom.window.close(); }
});

test('mobile menu starts compact, exposes hiring first and opens one submenu at a time', async () => {
  const { dom, w, run } = await setup('', 'src/components/Header.astro');
  try {
    run();
    const menu = w.document.querySelector('[data-mobile-menu]');
    const toggles = [...menu.querySelectorAll('.sub-toggle')];
    assert(toggles.every((b) => b.getAttribute('aria-expanded') === 'false'));
    assert([...menu.querySelectorAll('.sub')].every((p) => p.hidden));
    assert(menu.querySelector('[data-cta-placement="mobile_menu"]').compareDocumentPosition(menu.querySelector('nav')) & 4);
    menu.open = true; await pause();
    toggles[0].click(); assert.equal(toggles[0].getAttribute('aria-expanded'), 'true');
    toggles[1].click(); assert.equal(toggles[0].getAttribute('aria-expanded'), 'false');
    assert.equal(toggles[1].getAttribute('aria-expanded'), 'true');
    menu.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await pause();
    assert.equal(menu.open, false);
    assert.equal(w.document.documentElement.hasAttribute('data-menu-open'), false);
  } finally { dom.window.close(); }
});

function fillRequest(w) {
  const doc = w.document;
  doc.querySelector('[name="role"]').value = 'Two warehouse workers next week';
  doc.querySelector('[name="location"]').value = 'Nova Scotia';
  doc.querySelector('[name="location"]').dispatchEvent(new w.Event('change', { bubbles: true }));
  doc.querySelector('[name="name"]').value = 'Test Employer';
  doc.querySelector('[name="email"]').value = 'employer@example.test';
}
function events(w, name) { return (w.dataLayer || []).map((args) => [...args]).filter((args) => args[0] === 'event' && (!name || args[1] === name)); }
function fakeMeasurement(w) {
  const original = w.gtag;
  w.gtag = (...args) => args[0] === 'get' ? args[3](args[2] === 'client_id' ? '123.456' : '123') : original(...args);
}

test('a sandbox submission never records a real lead', async () => {
  const { dom, w, run } = await setup('hire/', 'src/pages/hire.astro', { analytics: true, consent: 'granted', query: '?utm_source=linkedin&utm_campaign=october' });
  try {
    run(); fillRequest(w);
    const form = w.document.querySelector('#request');
    form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); await pause();
    assert.equal(events(w, 'generate_lead').length, 0);
    assert.equal(events(w, 'form_preview').length, 1);
    assert.equal(w.document.querySelector('.sent-title').textContent, 'Preview complete.');
  } finally { dom.window.close(); }
});

test('real delivery is counted once, keeps attribution, and keeps contact details out of GA4', async () => {
  const { dom, w, run } = await setup('hire/', 'src/pages/hire.astro', { analytics: true, consent: 'granted', query: '?utm_source=linkedin&utm_medium=paid_social&utm_campaign=october&service=direct' });
  try {
    const form = w.document.querySelector('#request'); form.dataset.endpoint = 'https://request.test';
    const sent = [];
    w.fetch = async (url, opts) => { const body = JSON.parse(opts.body); sent.push(body); return { ok: true, json: async () => ({ ok: true, accepted: true, lead_id: body.lead_id }) }; };
    run(); fakeMeasurement(w); fillRequest(w);
    w.document.querySelector('[name="role"]').focus();
    form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); await pause();
    assert.equal(sent.length, 1);
    assert.equal(sent[0].attribution.first_touch.utm_source, 'linkedin');
    assert.equal(sent[0].measurement.client_id, '123.456');
    assert.equal(events(w, 'form_start').length, 1);
    assert.equal(events(w, 'generate_lead').length, 1);
    assert.equal(events(w, 'generate_lead')[0][2].lead_id, sent[0].lead_id);
    assert.equal(events(w, 'generate_lead')[0][2].province, 'NS');
    assert(!JSON.stringify(events(w)).includes('employer@example.test'));
    assert(!JSON.stringify(events(w)).includes('Test Employer'));
    assert(!JSON.stringify(events(w)).includes('Two warehouse'));
  } finally { dom.window.close(); }
});

test('failed delivery is retryable, reuses the reference and never records a lead', async () => {
  const { dom, w, run } = await setup('hire/', 'src/pages/hire.astro', { analytics: true, consent: 'granted' });
  try {
    const form = w.document.querySelector('#request'); form.dataset.endpoint = 'https://request.test';
    const ids = [];
    w.fetch = async (url, opts) => { ids.push(JSON.parse(opts.body).lead_id); return { ok: false, json: async () => ({ ok: false }) }; };
    run(); fakeMeasurement(w); fillRequest(w);
    form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); await pause();
    form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); await pause();
    assert.equal(ids.length, 2); assert.equal(ids[0], ids[1]);
    assert.equal(events(w, 'generate_lead').length, 0);
    assert.equal(events(w, 'form_error').length, 2);
    assert.equal(w.document.querySelector('.send-err').hidden, false);
    assert.equal(form.querySelector('button[type="submit"]').disabled, false);
  } finally { dom.window.close(); }
});

test('an incomplete or mismatched acknowledgement never becomes a sent request', async () => {
  const { dom, w, run } = await setup('hire/', 'src/pages/hire.astro', { analytics: true, consent: 'granted' });
  try {
    const form = w.document.querySelector('#request'); form.dataset.endpoint = 'https://request.test';
    let response = { ok: true };
    w.fetch = async () => ({ ok: true, json: async () => response });
    run(); fakeMeasurement(w); fillRequest(w);
    form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); await pause();
    assert.equal(events(w, 'generate_lead').length, 0);
    response = { ok: true, accepted: true, lead_id: 'a-different-request' };
    form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); await pause();
    assert.equal(events(w, 'generate_lead').length, 0);
    assert.equal(w.document.querySelector('.send-err').hidden, false);
    assert.equal(form.querySelector('button[type="submit"]').disabled, false);
  } finally { dom.window.close(); }
});

test('declined analytics sends nothing to Google and carries campaign tags without storage', async () => {
  const { dom, w, run } = await setup('hire/', 'src/pages/hire.astro', { analytics: true, consent: 'denied', query: '?utm_source=linkedin' });
  try {
    run();
    assert.equal(w.document.querySelectorAll('script[src*="googletagmanager"]').length, 0);
    assert.equal(w.dataLayer, undefined);
    assert.equal(w.sessionStorage.getItem('isl-enquiry-source-isl'), null);
    const link = w.document.querySelector('header a[href$="/hire/"]');
    link.addEventListener('click', (e) => e.preventDefault()); link.click();
    assert.equal(new URL(link.href).searchParams.get('utm_source'), 'linkedin');
  } finally { dom.window.close(); }
});

test('accepting analytics starts collection; refusing again stops custom event collection', async () => {
  const { dom, w, run } = await setup('hire/', 'src/pages/hire.astro', { analytics: true });
  try {
    // An off-by-default sandbox omits the banner. Supply the same consent controls for this
    // configured-stream test; the application script and actual form remain unchanged.
    if (!w.document.querySelector('[data-consent]')) {
      const banner = w.document.createElement('div'); banner.dataset.consent = '';
      banner.innerHTML = '<button data-consent-choice="granted">Accept</button><button data-consent-choice="denied">No thanks</button>';
      w.document.body.append(banner);
    }
    run();
    assert.equal(w.document.querySelectorAll('script[src*="googletagmanager"]').length, 0);
    w.document.querySelector('[data-consent-choice="granted"]').click();
    assert.equal(w.document.querySelectorAll('script[src*="googletagmanager"]').length, 1);
    assert.equal(w.localStorage.getItem('isl-consent'), 'granted');
    w.document.querySelector('[data-consent-choice="denied"]').click();
    fillRequest(w); w.document.querySelector('[name="role"]').focus();
    assert.equal(events(w).length, 0);
    assert.equal(w.sessionStorage.getItem('isl-enquiry-source-isl'), null);
  } finally { dom.window.close(); }
});
