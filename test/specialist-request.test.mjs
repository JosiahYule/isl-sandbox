import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['assistant/supabase/functions/specialist-request/index.ts'], bundle: true, write: false, platform: 'node', format: 'cjs' });
const TO = { as: { halifax: 'as-hfx@example.test', moncton: 'as-mct@example.test', 'st-johns': 'as-sj@example.test' }, ads: { halifax: 'ads-hfx@example.test' } };
function endpoint(env = {}, response = () => new Response('{"id":"email-test"}', { status: 200 })) {
  let handler; const sends = [];
  const all = { RESEND_API_KEY: 'k', REQUEST_FROM_AS: 'AS <web@as.test>', REQUEST_FROM_ADS: 'ADS <web@ads.test>', REQUEST_TO: JSON.stringify(TO), ...env };
  vm.runInNewContext(bundle.outputFiles[0].text, { Deno: { env: { get: (k) => all[k] }, serve: (fn) => { handler = fn; } },
    crypto: webcrypto, Request, Response, TextDecoder, AbortSignal, console, fetch: async (url, options) => { sends.push({ url, options }); return response(options); } });
  return { handler, sends };
}
const body = { service: 'direct', role: 'A senior accountant', location: 'New Brunswick', name: 'Test Employer', email: 'employer@example.test' };
const req = (b, origin = 'https://www.accountantstaffing.ca') => new Request('https://example.test/functions/v1/specialist-request', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(b) });

test('routes by brand and province to the office that covers the work', async () => {
  const { handler, sends } = endpoint();
  const r = await (await handler(req(body))).json();
  assert.equal(r.accepted, true); assert.equal(r.routedTo, 'Our Moncton office');
  const email = JSON.parse(sends[0].options.body);
  assert.deepEqual(email.to, ['as-mct@example.test']); assert.equal(email.from, 'AS <web@as.test>'); assert.equal(email.reply_to, 'employer@example.test');
  assert(email.subject.startsWith('Accountant Staffing: A permanent hire, New Brunswick'));
  // PEI and anywhere outside Atlantic Canada go to Halifax
  await handler(req({ ...body, location: 'Prince Edward Island' })); await handler(req({ ...body, location: 'Elsewhere in Canada' }));
  assert.deepEqual(sends.slice(1).map((s) => JSON.parse(s.options.body).to[0]), ['as-hfx@example.test', 'as-hfx@example.test']);
});

test('the sandbox names the brand; a live site cannot pose as the other brand', async () => {
  const { handler, sends } = endpoint();
  const r = await (await handler(req({ ...body, location: 'Nova Scotia', brand: 'ads' }, 'https://josiahyule.github.io'))).json();
  assert.equal(r.accepted, true); assert.deepEqual(JSON.parse(sends[0].options.body).to, ['ads-hfx@example.test']);
  await handler(req({ ...body, brand: 'ads' })); // from accountantstaffing.ca: stays AS
  assert.equal(JSON.parse(sends[1].options.body).from, 'AS <web@as.test>');
  assert.equal((await handler(req({ ...body, brand: 'isl' }, 'https://josiahyule.github.io'))).status, 400);
});

test('an office with no address uses the fallback, and nothing is sent until one is set', async () => {
  const noAddress = endpoint();
  assert.equal((await noAddress.handler(req({ ...body, location: 'New Brunswick' }, 'https://www.administrativestaffing.ca'))).status, 500);
  assert.equal(noAddress.sends.length, 0);
  const withFallback = endpoint({ REQUEST_FALLBACK: 'info@example.test' });
  await withFallback.handler(req({ ...body, location: 'New Brunswick' }, 'https://www.administrativestaffing.ca'));
  assert.deepEqual(JSON.parse(withFallback.sends[0].options.body).to, ['info@example.test']);
});

test('bots, bad emails, foreign sites and provider failures never become leads', async () => {
  const { handler, sends } = endpoint();
  assert.equal((await (await handler(req({ ...body, website: 'x' }))).json()).accepted, false);
  assert.equal((await handler(req({ ...body, email: 'bad' }))).status, 400);
  assert.equal((await handler(req(body, 'https://unrelated.test'))).status, 403);
  assert.equal(sends.length, 0);
  assert.equal((await endpoint({}, () => new Response('{}', { status: 500 })).handler(req(body))).status, 502);
});
