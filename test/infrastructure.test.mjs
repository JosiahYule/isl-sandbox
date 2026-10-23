import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { refreshJobs } from '../scripts/fetch-jobs.mjs';
import { sameReport, validateReport } from '../scripts/lib/lfs-report.mjs';
import { rateLimiter, readJson } from '../assistant/supabase/functions/_shared/http.js';

test('feed failures preserve both saved files; a valid feed atomically replaces them', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'isl-jobs-test-'));
  const out = path.join(dir, 'jobs.json'), meta = path.join(dir, 'meta.json');
  try {
    await fs.writeFile(out, 'last working jobs'); await fs.writeFile(meta, 'last refresh');
    for (const response of [new Response('{}', { status: 503 }), new Response('{'), new Response('[]'), new Response('[{"ReqID":"1"},{"ReqID":"1"}]')]) {
      await assert.rejects(refreshJobs({ url: 'https://feed.test', out, meta, fetchFeed: async () => response }));
      assert.equal(await fs.readFile(out, 'utf8'), 'last working jobs');
      assert.equal(await fs.readFile(meta, 'utf8'), 'last refresh');
    }
    const count = await refreshJobs({ url: 'https://feed.test', out, meta, fetchFeed: async (_url, options) => {
      assert(options.signal instanceof AbortSignal);
      return Response.json([{ ReqID: '1', Name: 'Forklift operator', JobCity: 'Dartmouth', JobState: 'NS' }]);
    } });
    assert.equal(count, 1);
    assert.equal(JSON.parse(await fs.readFile(out, 'utf8'))[0].title, 'Forklift operator');
    assert(!Number.isNaN(Date.parse(JSON.parse(await fs.readFile(meta, 'utf8')).fetched)));
    assert.deepEqual((await fs.readdir(dir)).sort(), ['jobs.json', 'meta.json']);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('report updates detect same-month revisions, ignoring a changed fetch timestamp', async () => {
  const current = JSON.parse(await fs.readFile('src/data/lfs/latest.json', 'utf8'));
  validateReport(current);
  const next = structuredClone(current); next.fetched = new Date().toISOString();
  assert(sameReport(current, next));
  next.provinces.NS.unemploymentRate.at(-1).value += 0.1;
  assert(!sameReport(current, next), 'same-month figures must be published');
  const corrected = structuredClone(current); corrected.released = '2026-10-09T08:30:00';
  if (corrected.released === current.released) corrected.released += 'Z';
  assert(!sameReport(current, corrected), 'release-date corrections must be published');
  delete next.provinces.PE.employment;
  assert.throws(() => validateReport(next), /Incomplete/);
});

test('streamed request limits count bytes without trusting Content-Length', async () => {
  const chunks = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{"role":"' + 'é'.repeat(200) + '"}')); controller.close(); } });
  const request = new Request('https://example.test', { method: 'POST', body: chunks, duplex: 'half' });
  await assert.rejects(readJson(request, 100), (error) => error.status === 413);
});

test('rate limiting keeps existing limits when its key capacity is reached', () => {
  const limited = rateLimiter(2, 600000, 2);
  assert.equal(limited('a'), false); assert.equal(limited('b'), false);
  assert.equal(limited('a'), false); assert.equal(limited('a'), true);
  assert.equal(limited('new-key'), true);
  assert.equal(limited('a'), true, 'filling the map cannot reset its limits');
});
