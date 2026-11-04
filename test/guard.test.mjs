// _shared/guard.js: rate limits shared through the database, the visitor's address, and Turnstile
import test from 'node:test';
import assert from 'node:assert/strict';
import { clientIp, createGuard, limitFor, verifyTurnstile } from '../assistant/supabase/functions/_shared/guard.js';

const req = (headers = {}) => new Request('https://example.test/', { method: 'POST', headers });

test('the visitor address comes from the configured header, and never a caller-written one when told', () => {
  const r = req({ 'x-forwarded-for': '6.6.6.6, 1.2.3.4' });
  assert.equal(clientIp(r), '6.6.6.6', 'unconfigured: the old behaviour, so no one is wrongly blocked');
  assert.equal(clientIp(r, { CLIENT_IP_HEADER: 'X-Forwarded-For' }), '1.2.3.4', 'x-forwarded-for means its last address');
  assert.equal(clientIp(req({ 'cf-connecting-ip': '9.9.9.9', 'x-forwarded-for': '6.6.6.6' })), '9.9.9.9');
});

// A fake rate_limit_hit: counts per key, answers true once over the limit
function fakeDb() {
  const counts = new Map(); const keys = [];
  const fetchImpl = async (url, init) => {
    const { p_key, p_max } = JSON.parse(init.body);
    keys.push(p_key);
    const n = (counts.get(p_key) || 0) + 1; counts.set(p_key, n);
    return { ok: true, json: async () => n > p_max };
  };
  return { fetchImpl, keys };
}
const env = { SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'service-key' };

test('the combined limit holds whatever address each request claims', async () => {
  const { fetchImpl, keys } = fakeDb();
  const check = createGuard({ name: 't', visitor: [100, 600], everyone: [3, 86400], env, fetchImpl });
  const results = [];
  for (let i = 0; i < 5; i++) results.push(await check(req({ 'x-forwarded-for': `10.0.0.${i}` })));
  assert.deepEqual(results, [null, null, null, 'busy', 'busy']);
  assert(keys.every((k) => !/10\.0\.0/.test(k)), 'addresses are never stored, only a keyed hash');
});

test('a database outage lets visitors through (memory limits still apply)', async () => {
  const check = createGuard({ name: 't', visitor: [2, 600], everyone: [100, 86400], env, fetchImpl: async () => { throw new Error('down'); } });
  const r = req({ 'x-forwarded-for': '1.1.1.1' });
  assert.deepEqual([await check(r), await check(r), await check(r)], [null, null, 'rate']);
});

test('one email address gets at most a few confirmation emails a day', async () => {
  const { fetchImpl } = fakeDb();
  const over = limitFor({ name: 'e', max: 3, windowSeconds: 86400, env, fetchImpl });
  const results = [];
  for (const e of ['a@x.test', 'A@x.test', 'a@x.test', 'a@x.test']) results.push(await over(e));
  assert.deepEqual(results, [false, false, false, true], 'case does not make a new address');
});

test('Turnstile is off until its secret is set, then a token Cloudflare accepts is required', async () => {
  assert.equal(await verifyTurnstile(undefined, '1.1.1.1', {}), true);
  const cf = (success) => async (url, init) => { assert.match(url, /siteverify/); assert.match(String(init.body), /secret=s/); return { json: async () => ({ success }) }; };
  assert.equal(await verifyTurnstile('', '1.1.1.1', { TURNSTILE_SECRET: 's' }, cf(true)), false);
  assert.equal(await verifyTurnstile('tok', '1.1.1.1', { TURNSTILE_SECRET: 's' }, cf(true)), true);
  assert.equal(await verifyTurnstile('tok', '1.1.1.1', { TURNSTILE_SECRET: 's' }, cf(false)), false);
  assert.equal(await verifyTurnstile('tok', '1.1.1.1', { TURNSTILE_SECRET: 's' }, async () => { throw new Error('offline'); }), false);
});
