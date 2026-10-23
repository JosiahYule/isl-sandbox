import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { build } from 'esbuild';
const leadId = 'lead_12345678-1234-4234-8234-123456789abc';
const bundle = await build({ entryPoints: ['assistant/supabase/functions/isl-request/index.ts'], bundle: true, write: false, platform: 'node', format: 'cjs' });
function endpoint(response = () => new Response('{"id":"email-test"}', { status: 200 })) {
  let handler; const sends = [];
  const env = { RESEND_API_KEY: 'test-key', REQUEST_FROM: 'website@example.test' };
  vm.runInNewContext(bundle.outputFiles[0].text, { Deno: { env: { get: (key) => env[key] }, serve: (fn) => { handler = fn; } },
    crypto: webcrypto, Request, Response, TextDecoder, AbortSignal, console, fetch: async (url, options) => { sends.push({ url, options }); return response(options); } });
  return { handler, sends };
}
const body = { service: 'contract', role: 'Two warehouse workers', location: 'Nova Scotia', name: 'Test Employer', email: 'employer@example.test', lead_id: leadId,
  attribution: { first_touch: { utm_source: 'linkedin', utm_medium: 'paid_social', utm_campaign: 'october', landing_path: '/', email: 'must-not-persist@example.test' } } };
const req = (b) => new Request('https://example.test/functions/v1/isl-request', { method: 'POST', headers: { origin: 'https://www.integratedstaffing.ca', 'content-type': 'application/json' }, body: JSON.stringify(b) });

test('acknowledged delivery includes source and reference in the recruiter email', async () => {
  const { handler, sends } = endpoint();
  const response = await handler(req(body)); const result = await response.json();
  assert.equal(result.accepted, true); assert.equal(result.lead_id, leadId);
  assert.equal(result.routedTo, 'Meg Antonick');
  const email = JSON.parse(sends[0].options.body);
  assert(email.text.includes('Lead reference: ' + leadId));
  assert(email.text.includes('First source: linkedin'));
  assert(!email.text.includes('must-not-persist'));
  assert.equal(sends[0].options.headers['Idempotency-Key'], 'isl-request/' + leadId);
  assert(sends[0].options.signal instanceof AbortSignal);
});

test('rejects cross-site, oversized and structurally invalid submissions before sending', async () => {
  const { handler, sends } = endpoint();
  const foreign = req(body); foreign.headers.set('origin', 'https://unrelated.test');
  assert.equal((await handler(foreign)).status, 403);
  assert.equal((await handler(req({ ...body, role: 'x'.repeat(17000) }))).status, 413);
  assert.equal((await handler(req({ ...body, role: {} }))).status, 400);
  assert.equal((await handler(new Request('https://example.test', { method: 'POST', body: '{' }))).status, 400);
  assert.equal(sends.length, 0);
  const malformed = endpoint(() => new Response('{}', { status: 200 }));
  assert.equal((await malformed.handler(req(body))).status, 502);
  for (let i = 0; i < 7; i++) await handler(req(body));
  assert.equal((await handler(req(body))).status, 429);
});

test('bots, invalid requests and email-provider failures cannot become accepted leads', async () => {
  const { handler, sends } = endpoint();
  assert.equal((await (await handler(req({ ...body, website: 'bot.test' }))).json()).accepted, false);
  assert.equal((await handler(req({ ...body, email: 'bad' }))).status, 400);
  assert.equal((await handler(req(null))).status, 400);
  assert.equal(sends.length, 0);
  const broken = endpoint(() => new Response('{}', { status: 500 }));
  assert.equal((await broken.handler(req(body))).status, 502);
  const offline = endpoint(() => { throw new Error('offline'); });
  assert.equal((await offline.handler(req(body))).status, 502);
});
