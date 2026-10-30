import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { build } from 'esbuild';
const bundle = await build({ entryPoints: ['assistant/supabase/functions/isl-job-chat/index.ts'], bundle: true, write: false, platform: 'node', format: 'cjs' });
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const rawJobs = [{ ReqID: 'test1', Name: 'Warehouse worker', JobCity: 'Dartmouth', JobState: 'NS' }];
const textReply = { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Here are the openings.' }] };
function endpoint(fetchResponse = async (url) => url === 'https://feed.test' ? json(rawJobs) : json(textReply), configuration = {}) {
  let handler; const calls = [];
  const env = { ANTHROPIC_API_KEY: 'test-key', AVIONTE_FEED_URL: 'https://feed.test', ...configuration };
  vm.runInNewContext(bundle.outputFiles[0].text, {
    Deno: { env: { get: (key) => env[key] }, serve: (fn) => { handler = fn; } },
    Request, Response, TextDecoder, AbortSignal, console: { error() {} },
    fetch: async (url, options) => { calls.push({ url, options }); return fetchResponse(url, options); },
  });
  return { handler, calls };
}
const request = (body = { messages: [{ role: 'user', content: 'Warehouse work' }] }, origin = 'https://www.integratedstaffing.ca') => new Request('https://example.test/isl-job-chat', { method: 'POST', headers: { origin }, body: JSON.stringify(body) });

test('chat rejects malformed, cross-site and oversized requests before contacting providers', async () => {
  const { handler, calls } = endpoint();
  assert.equal((await handler(request(null))).status, 400);
  assert.equal((await handler(request({ messages: [] }))).status, 400);
  assert.equal((await handler(request(undefined, 'https://unrelated.test'))).status, 403);
  assert.equal((await handler(request({ messages: [], extra: 'x'.repeat(66000) }))).status, 413);
  assert.equal((await handler(new Request('https://example.test', { method: 'POST', body: '{' }))).status, 400);
  assert.equal(calls.length, 0);
  // Not set up yet: the offices, never an error, and no provider is contacted
  const unconfigured = endpoint(undefined, { ANTHROPIC_API_KEY: '' });
  const offline = await unconfigured.handler(request());
  assert.equal(offline.status, 200);
  const shown = await offline.json();
  assert.equal(shown.meta.fallback, true);
  assert.equal(shown.offices.length, 5);
  assert.equal(unconfigured.calls.length, 0);
});

test('chat shares a concurrent feed refresh and bounds upstream calls', async () => {
  let release;
  const ready = new Promise((resolve) => { release = resolve; });
  const { handler, calls } = endpoint(async (url) => {
    if (url === 'https://feed.test') { await ready; return json(rawJobs); }
    return json(textReply);
  });
  const first = handler(request()), second = handler(request());
  await new Promise((resolve) => setTimeout(resolve, 0)); release();
  const results = await Promise.all([first, second]);
  assert(results.every((response) => response.status === 200));
  assert.equal(calls.filter((call) => call.url === 'https://feed.test').length, 1);
  assert(calls.every((call) => call.options.signal instanceof AbortSignal));
  assert.equal((await (await handler(request())).json()).reply, textReply.content[0].text);
  assert.equal(calls.filter((call) => call.url === 'https://feed.test').length, 1);
});

test('feed errors can recover and repeated tool use stops after five provider calls', async () => {
  let feeds = 0;
  const broken = endpoint(async (url) => url === 'https://feed.test' ? ++feeds === 1 ? json({}, 503) : json(rawJobs) : json(textReply));
  const down = await broken.handler(request());
  assert.equal(down.status, 200);
  assert.equal((await down.json()).meta.fallback, true, 'feed down: the offices instead');
  const back = await (await broken.handler(request())).json();
  assert.equal(back.reply, textReply.content[0].text, 'recovers on the next message');
  const looping = endpoint(async (url) => url === 'https://feed.test' ? json(rawJobs) : json({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'test', name: 'unknown', input: {} }] }));
  const result = await (await looping.handler(request())).json();
  assert(result.reply.length > 0);
  assert.equal(looping.calls.filter((call) => call.url.includes('anthropic')).length, 5);
});

test('when the model is down or over its spend limit, visitors get the offices, and the trace stays server-side', async () => {
  const capped = endpoint(async (url) => url === 'https://feed.test' ? json(rawJobs) : json({ type: 'error' }, 400));
  const out = await (await capped.handler(request())).json();
  assert.equal(out.meta.fallback, true);
  assert.ok(out.offices.some((o) => o.phone === '902-423-1919'));
  assert.equal(out.trace, undefined);
  assert.equal(out.usage, undefined);
});
