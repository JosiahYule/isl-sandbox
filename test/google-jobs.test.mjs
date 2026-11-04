// Google for Jobs: the job pages' structured data, and the Indexing API notifier (scripts/notify-google-jobs.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { generateKeyPairSync } from 'node:crypto';
import { diffJobs, readLive, diff, send } from '../scripts/notify-google-jobs.mjs';

const schemaOf = (path) => JSON.parse(fs.readFileSync(new URL(`../dist/${path}/index.html`, import.meta.url), 'utf8').match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);

test('the description Google reads is the cleaned one the page shows', () => {
  const page = fs.readdirSync(new URL('../dist/find-work/', import.meta.url)).find((d) => d.endsWith('ma9456753923'));
  const s = schemaOf(`find-work/${page}`);
  assert.doesNotMatch(s.description, /INT00\d/, 'no tracking code');
  assert.doesNotMatch(s.description, /Referral Bonus/i, 'no standard closing');
  assert.doesNotMatch(s.description, /<p>\W*<\/p>/, 'no empty or punctuation-only paragraphs');
  assert.match(s.hiringOrganization.logo, /^https:\/\/.+\.(webp|png)$/);
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
