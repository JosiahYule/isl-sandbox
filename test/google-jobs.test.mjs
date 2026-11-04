// Google for Jobs: the job pages' structured data, and the Indexing API notifier (scripts/notify-google-jobs.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { generateKeyPairSync } from 'node:crypto';
import { diffJobs, readLive, diff, send } from '../scripts/notify-google-jobs.mjs';

// Every job page in the build, with its JobPosting data. The deploy builds from the live job feed, so these
// tests look at whatever jobs are open at build time, never one particular posting, and check only what
// the code guarantees (how recruiters word an ad, such as where the referral-bonus closing starts, can vary).
const jobPages = () => {
  const dir = new URL('../dist/find-work/', import.meta.url);
  return fs.readdirSync(dir).filter((d) => fs.existsSync(new URL(`${d}/index.html`, dir))).map((d) => {
    const html = fs.readFileSync(new URL(`${d}/index.html`, dir), 'utf8');
    const data = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
    return { page: d, schema: data ? JSON.parse(data) : null };
  }).filter((p) => p.schema?.['@type'] === 'JobPosting');
};

test('the description Google reads is the cleaned one the page shows, on every job', () => {
  const pages = jobPages();
  assert(pages.length > 0, 'the build has job pages with JobPosting data');
  for (const { page, schema } of pages) {
    assert.doesNotMatch(schema.description, /(^|>)\s*INT\d{3}\s*</i, `${page}: no tracking code`);
    assert.doesNotMatch(schema.description, /<p>[^a-z0-9<]*<\/p>/i, `${page}: no empty or punctuation-only paragraphs`);
    assert.match(schema.hiringOrganization.logo, /^https:\/\/.+\.(webp|png)$/, `${page}: logo`);
  }
});

test('new jobs are announced and closed ones withdrawn', () => {
  const a = { id: 'A', url: 'https://x/job?id=A' }, b = { id: 'B', url: 'https://x/job?id=B' }, c = { id: 'C', url: 'https://x/job?id=C' };
  assert.deepEqual(diffJobs([a, b], [b, c]), { updated: [c.url], deleted: [a.url] });
});

test('a live list that cannot be read sends nothing; a missing one means first run', async () => {
  assert.equal(await readLive('isl', async () => ({ ok: false, status: 503 })), null);
  assert.equal(await readLive('isl', async () => { throw new Error('offline'); }), null);
  assert.deepEqual(await readLive('isl', async () => ({ ok: false, status: 404 })), []);
  fs.mkdirSync('.astro/test-sq/isl/live', { recursive: true });
  fs.writeFileSync('.astro/test-sq/isl/live/jobs.json', JSON.stringify({ jobs: [{ id: 'A', url: 'https://x/job?id=A' }] }));
  const out = await diff({ root: '.astro/test-sq', fetchImpl: async () => ({ ok: false, status: 500 }) });
  assert.deepEqual([out.updated, out.deleted], [[], []]);
  assert.match(out.skipped.join(), /isl: couldn't read/);
  fs.rmSync('.astro/test-sq', { recursive: true, force: true });
});

test('send signs in once, posts each change, and stops at the daily limit', async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const key = { client_email: 'bot@example.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, body: String(init.body) });
    if (url.includes('oauth2')) return { ok: true, json: async () => ({ access_token: 't' }) };
    return { ok: calls.length < 4, status: calls.length < 4 ? 200 : 429 };
  };
  const r = await send({ changes: { updated: ['https://x/1', 'https://x/2'], deleted: ['https://x/3', 'https://x/4'] }, key, fetchImpl });
  assert.equal(calls.filter((c) => c.url.includes('oauth2')).length, 1);
  assert.match(calls[0].body, /assertion=[\w-]+\.[\w-]+\.[\w-]+/);
  assert.deepEqual(JSON.parse(calls[3].body), { url: 'https://x/3', type: 'URL_DELETED' });
  assert.deepEqual(r, { sent: 2, failed: 1 }); // the 429 stops the run
  assert.deepEqual(await send({ changes: { updated: [], deleted: [] }, key, fetchImpl: () => assert.fail('no calls') }), { sent: 0, failed: 0 });
});
