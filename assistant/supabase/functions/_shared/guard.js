// =====================================================================
// guard.js: who is asking, how often, and are they a person. Shared by every edge function that
// a visitor's browser can call (the chat, the request forms, job alerts, the chat's miss log).
//
// THREE CHECKS, cheapest first:
//   1. A count per visitor, and a count for everyone combined, kept in memory (http.js rateLimiter).
//      Free and instant, but each copy of a function has its own memory, wiped on restart.
//   2. The same counts in the database (rate_limits, migration 20261104120000), shared by every copy
//      and every restart. The combined count is the one that can't be dodged: it doesn't depend on
//      knowing who anyone is, so it caps the Claude bill and the emails sent, whatever an attacker does.
//   3. Cloudflare Turnstile, a free check that the sender is a person, on the request forms.
//      On when TURNSTILE_SECRET is set (and the site has the matching PUBLIC_TURNSTILE_SITE_KEY).
//
// WHO IS ASKING: a function only sees the visitor's address in a header that the network in front
// of it adds, and Supabase doesn't document which one to trust. The first address in X-Forwarded-For
// can be written by the caller; the last one is the nearest proxy's view, which is the visitor only
// when exactly one proxy sits in front. Guess wrong the strict way and every visitor shares one
// address, so the per-visitor limit turns away real employers. So, until it's confirmed:
//   - the per-visitor count is a courtesy (it slows ordinary repeats), and the combined count, which
//     doesn't depend on addresses at all, is the real protection;
//   - clientIp() reads CLIENT_IP_HEADER when set, else cf-connecting-ip, else x-real-ip, else the
//     first address in X-Forwarded-For (what the functions always used).
// To confirm: set LOG_IP_HEADERS=1, send a few requests, and read the function's logs. They show which
// headers arrived and how many addresses X-Forwarded-For held, never the addresses themselves.
// Then set CLIENT_IP_HEADER (x-forwarded-for means its last address) and remove LOG_IP_HEADERS.
//
// Nothing stored is personal: counters are keyed by an HMAC (a keyed hash) of the address or email,
// using the service role key as the secret, so the table can't be read back into addresses.
// If the database can't be reached, the visitor is let through (the memory limits still apply):
// a database hiccup should never turn away an employer.
// =====================================================================
import { rateLimiter } from './http.js';

export function clientIp(req, env = {}) {
  const h = (name) => (req.headers.get(name) || '').trim();
  if (env.LOG_IP_HEADERS === '1') {
    const xff = h('x-forwarded-for');
    console.log(`guard: ip headers ${['cf-connecting-ip', 'x-real-ip', 'x-forwarded-for', 'fly-client-ip', 'true-client-ip'].filter(h).join(', ') || 'none'}; x-forwarded-for holds ${xff ? xff.split(',').length : 0}`);
  }
  if (env.CLIENT_IP_HEADER) {
    const v = h(env.CLIENT_IP_HEADER.toLowerCase());
    if (v) return env.CLIENT_IP_HEADER.toLowerCase() === 'x-forwarded-for' ? v.split(',').at(-1).trim() : v;
  }
  return h('cf-connecting-ip') || h('x-real-ip') || h('x-forwarded-for').split(',')[0].trim() || 'unknown';
}

async function hmac(secret, text) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret || 'no-secret'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(text)));
  return [...sig.slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// The database counter (rate_limit_hit). true = over the limit, false = fine, null = couldn't ask.
function dbCounter(env, fetchImpl) {
  const url = (env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) return null;
  return async (counterKey, max, windowSeconds) => {
    try {
      const res = await fetchImpl(`${url}/rest/v1/rpc/rate_limit_hit`, {
        method: 'POST',
        signal: AbortSignal.timeout(3000),
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_key: counterKey, p_max: max, p_window_seconds: windowSeconds }),
      });
      if (!res.ok) return null;
      return (await res.json()) === true;
    } catch { return null; }
  };
}

// createGuard({ name: 'chat', visitor: [30, 600], everyone: [1500, 86400] })
//   visitor:  at most 30 per visitor in 600 seconds
//   everyone: at most 1500 for all visitors combined in 86400 seconds (a day)
// The returned check(req) answers null (go ahead), 'rate' (this visitor: slow down) or 'busy' (everyone).
export function createGuard({ name, visitor, everyone, env = {}, fetchImpl = fetch }) {
  const mine = visitor && rateLimiter(visitor[0], visitor[1] * 1000);
  const all = everyone && rateLimiter(everyone[0], everyone[1] * 1000);
  const db = dbCounter(env, fetchImpl);
  const secret = env.SUPABASE_SERVICE_ROLE_KEY || '';
  return async function check(req) {
    const ip = clientIp(req, env);
    if (mine && mine(ip)) return 'rate';
    if (all && all('all')) return 'busy';
    if (!db) return null;
    const [visitorOver, everyoneOver] = await Promise.all([
      visitor ? db(`${name}:v:${await hmac(secret, ip)}`, visitor[0], visitor[1]) : null,
      everyone ? db(`${name}:all`, everyone[0], everyone[1]) : null,
    ]);
    if (visitorOver) return 'rate';
    if (everyoneOver) return 'busy';
    return null;
  };
}

// A limit on one thing rather than one visitor, e.g. confirmation emails to one address:
// limitFor({ name: 'alert-email', max: 3, windowSeconds: 86400, env })(email) -> true when over
export function limitFor({ name, max, windowSeconds, env = {}, fetchImpl = fetch }) {
  const local = rateLimiter(max, windowSeconds * 1000);
  const db = dbCounter(env, fetchImpl);
  const secret = env.SUPABASE_SERVICE_ROLE_KEY || '';
  return async (value) => {
    const k = await hmac(secret, String(value).toLowerCase());
    if (local(k)) return true;
    return db ? (await db(`${name}:${k}`, max, windowSeconds)) === true : false;
  };
}

// Cloudflare Turnstile: is the sender a person? true when TURNSTILE_SECRET isn't set (switched off).
export async function verifyTurnstile(token, ip, env = {}, fetchImpl = fetch) {
  if (!env.TURNSTILE_SECRET) return true;
  if (typeof token !== 'string' || !token || token.length > 2048) return false;
  try {
    const res = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, ...(ip && ip !== 'unknown' ? { remoteip: ip } : {}) }),
    });
    const data = await res.json();
    return data?.success === true;
  } catch { return false; } // Cloudflare unreachable: the form says it couldn't send, and the visitor can call
}

// Read the settings these checks use from Deno's environment (edge functions) or an object (tests)
export const guardEnv = (get) => Object.fromEntries(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'CLIENT_IP_HEADER', 'LOG_IP_HEADERS', 'TURNSTILE_SECRET'].map((k) => [k, get(k) ?? '']));
