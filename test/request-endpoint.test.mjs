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
    crypto: webcrypto, Request, Response, console, fetch: async (url, options) => { sends.push({ url, options }); return response(); } });
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
