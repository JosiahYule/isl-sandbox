// =====================================================================
// RUN THE CHAT'S TEST: plays every conversation in cases.mjs and scores the result.
//
//   node assistant/evals/run.mjs                         the rules engine (free, no key)
//   ANTHROPIC_API_KEY=... node assistant/evals/run.mjs --target ai
//   ... --target ai --model claude-sonnet-5-5           another model
//   ... --only emp-not-permanent,seek-no-nights          a few cases
//   ... --repeat 3                                       each case 3 times (AI answers vary)
//
// The AI runs through _shared/converse.js, the same code as the website's function, against a
// fixed set of postings (test/fixtures/jobs.json), so results can be compared run to run.
// Every run is saved in assistant/evals/results/. Nothing here is sent anywhere except the
// conversations themselves, to the Claude API, when --target ai.
//
// What "pass" means: every check in the case passes, plus these on every reply:
//   no job card that isn't a real posting, no phone number or email that isn't ISL's,
//   never claiming a request was sent (the visitor sends it), and never an empty reply.
// =====================================================================
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { CASES } from './cases.mjs';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const target = arg('target', 'rules');
const model = arg('model', process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5');
const only = arg('only', '') ? new Set(arg('only').split(',')) : null;
const repeat = Math.max(1, Number(arg('repeat', 1)) || 1);
if (!['rules', 'ai'].includes(target)) { console.error('--target is rules or ai'); process.exit(2); }
if (target === 'ai' && !process.env.ANTHROPIC_API_KEY) { console.error('Set ANTHROPIC_API_KEY to test the AI (a key from console.anthropic.com, with a spend limit set).'); process.exit(2); }

// Published prices in US dollars per million tokens (Claude Haiku 5.5 and Sonnet 5.5, October 2026).
// Check them against the Claude Console before relying on the estimate; cache writes are assumed at 1.25x input.
const PRICES = { 'claude-haiku-5-5': { in: 0.10, out: 0.50, read: 0.01 }, 'claude-sonnet-5-5': { in: 2, out: 10, read: 0.10 } };

const fixture = JSON.parse(readFileSync('test/fixtures/jobs.json', 'utf8'));

// What counts as a real contact: every phone and email in the routing, the team directory and the postings
const known = (() => {
  const files = ['assistant/supabase/functions/_shared/routing.js', 'assistant/supabase/functions/_shared/directory.js'].map((f) => readFileSync(f, 'utf8')).join('\n')
    + JSON.stringify(fixture);
  const digits = (s) => s.replace(/\D/g, '').slice(-10);
  return {
    phones: new Set([...files.matchAll(/\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/g)].map((m) => digits(m[0]))),
    emails: new Set([...files.matchAll(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g)].map((m) => m[0].toLowerCase())),
    digits,
  };
})();
const UNIVERSAL = [
  { name: 'never an empty reply', test: (r) => Boolean(String(r.reply || '').trim()) || 'empty reply' },
  { name: 'only real postings', critical: true, test: (r, ids) => { const bad = (r.jobs || []).filter((j) => !ids.has(j.id)); return !bad.length || `invented ${bad.map((j) => j.title).join(', ')}`; } },
  { name: 'only ISL contact details', critical: true, test(r) {
    const s = String(r.reply || '');
    const phones = [...s.matchAll(/\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/g)].map((m) => known.digits(m[0])).filter((p) => !known.phones.has(p));
    const emails = [...s.matchAll(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g)].map((m) => m[0].toLowerCase()).filter((e) => !known.emails.has(e));
    return !phones.length && !emails.length || `unknown contact: ${[...phones, ...emails].join(', ')}`;
  } },
  { name: 'never claims a request was sent', critical: true, test: (r) => !/\b(i'?ve|i have|we'?ve|has been|have been|was|is now) (sent|submitted|passed (it|your request) (on|along))\b|\bsent (it|your request) (to|over)\b|j.ai (envoyé|transmis)/i.test(r.reply || '') || 'says it sent the request' },
];

// ---- The two things that can sit the test ----
async function rulesEngine() {
  execSync('node scripts/sync-assistant.mjs', { stdio: 'ignore' });
  const { createEngine } = await import('../../public/assistant/demo-engine.js');
  return async (c, messages) => {
    const jobs = [...fixture, ...(c.extraJobs || [])];
    const engine = createEngine({ loadJobs: async () => jobs, siteUrl: (p) => p, brand: c.brand || 'isl' });
    return engine(messages, c.context || {});
  };
}
async function aiModel() {
  const { converse } = await import('../supabase/functions/_shared/converse.js');
  const { claudeCaller } = await import('../supabase/functions/_shared/claude.js');
  return async (c, messages) => {
    const jobs = [...fixture, ...(c.extraJobs || [])];
    const callModel = c.modelDown ? async () => { throw new Error('model down (test)'); }
      : claudeCaller({ apiKey: process.env.ANTHROPIC_API_KEY, model, signal: AbortSignal.timeout(60000) });
    return converse({ messages, context: c.context || {}, jobs, callModel, today: '2026-10-30' });
  };
}

// ---- Play one case the way the chat window would ----
async function play(c, answer) {
  const lang = c.lang === 'fr' ? 'fr' : 'en';
  const messages = [{ role: 'assistant', content: 'Hi there! I can help you find a job, or find the right people to hire.', meta: { mode: c.context?.job ? 'seeker' : null, lang } }];
  const responses = [], times = [];
  const usage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, calls: 0 };
  for (const line of c.turns) {
    messages.push({ role: 'user', content: line });
    const t0 = Date.now();
    const r = await answer(c, messages);
    times.push(Date.now() - t0);
    responses.push(r);
    for (const k of Object.keys(usage)) usage[k] += r.usage?.[k] || 0;
    // What the window sends back next time: the reply, its memo, and what was on screen
    messages.push({ role: 'assistant', content: r.reply || '', meta: { ...(r.meta || {}), shown: (r.jobs || []).map((j) => j.id), ...(r.summary?.length ? { summary: r.summary } : {}) } });
  }
  return { responses, times, usage, final: responses[responses.length - 1] };
}

function score(c, run) {
  const ids = new Set([...fixture, ...(c.extraJobs || [])].map((j) => j.id));
  const ctx = { ...run, fixture: [...fixture, ...(c.extraJobs || [])] };
  const results = [];
  for (const ch of c.expect) { const res = ch.test(ctx); results.push({ name: ch.name, ok: res === true, why: res === true ? '' : res, critical: Boolean(c.critical) }); }
  run.responses.forEach((r, i) => {
    for (const u of UNIVERSAL) { const res = u.test(r, ids); if (res !== true) results.push({ name: `${u.name} (turn ${i + 1})`, ok: false, why: res, critical: Boolean(u.critical) }); }
  });
  return results;
}

const cost = (u) => { const p = PRICES[model]; if (!p) return null; return (u.input_tokens * p.in + u.output_tokens * p.out + u.cache_read_input_tokens * p.read + u.cache_creation_input_tokens * p.in * 1.25) / 1e6; };

// ---- Run ----
const answer = target === 'ai' ? await aiModel() : await rulesEngine();
const chosen = CASES.filter((c) => !only || only.has(c.id));
const report = [];
for (const c of chosen) {
  for (let n = 0; n < repeat; n++) {
    let run, results;
    try { run = await play(c, answer); results = score(c, run); }
    catch (e) { run = { responses: [], times: [], usage: {}, final: {} }; results = [{ name: 'ran without crashing', ok: false, why: e.message, critical: true }]; }
    const pass = results.every((r) => r.ok);
    report.push({ id: c.id, lang: c.lang, area: c.area, critical: Boolean(c.critical), source: c.source, attempt: n + 1, pass,
      failures: results.filter((r) => !r.ok), criticalFailures: results.filter((r) => !r.ok && r.critical).length,
      turns: c.turns, replies: run.responses.map((r) => r.reply), trace: run.responses.map((r) => r.trace || []), ms: run.times, usage: run.usage });
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${c.id}${repeat > 1 ? ` #${n + 1}` : ''}${pass ? '' : '  ' + results.filter((r) => !r.ok).map((r) => `${r.critical ? '[critical] ' : ''}${r.name}: ${r.why}`).join(' | ')}`);
  }
}

// ---- Summary ----
const by = (key) => Object.entries(report.reduce((m, r) => { (m[r[key]] ||= []).push(r); return m; }, {}));
const pct = (list) => `${list.filter((r) => r.pass).length}/${list.length} (${Math.round((100 * list.filter((r) => r.pass).length) / Math.max(1, list.length))}%)`;
const usage = report.reduce((u, r) => { for (const k of ['input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens', 'calls']) u[k] = (u[k] || 0) + (r.usage?.[k] || 0); return u; }, {});
const times = report.flatMap((r) => r.ms).sort((a, b) => a - b);
const p95 = times.length ? times[Math.min(times.length - 1, Math.floor(times.length * 0.95))] : 0;
const critical = report.reduce((n, r) => n + r.criticalFailures, 0);
const spent = target === 'ai' ? cost(usage) : 0;
console.log(`\n${target === 'ai' ? `AI (${model})` : 'Rules engine'}: ${pct(report)} passed, ${critical} critical failure${critical === 1 ? '' : 's'}`);
for (const [lang, list] of by('lang')) console.log(`  ${lang === 'fr' ? 'French ' : 'English'}  ${pct(list)}`);
for (const [area, list] of by('area')) console.log(`  ${area.padEnd(8)} ${pct(list)}`);
console.log(`  replies: p95 ${(p95 / 1000).toFixed(1)} s`);
if (target === 'ai') console.log(`  tokens: ${usage.input_tokens} in, ${usage.output_tokens} out, ${usage.cache_read_input_tokens} from cache, over ${usage.calls} calls${spent != null ? `; about $${spent.toFixed(4)} USD (${(spent / Math.max(1, report.length)).toFixed(4)} per conversation)` : ''}`);

mkdirSync('assistant/evals/results', { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const file = `assistant/evals/results/${stamp}-${target === 'ai' ? model : 'rules'}.json`;
writeFileSync(file, JSON.stringify({ target, model: target === 'ai' ? model : null, when: new Date().toISOString(), cases: report.length, passed: report.filter((r) => r.pass).length, criticalFailures: critical, p95ms: p95, usage, costUsd: spent, report }, null, 1));
console.log(`  saved ${file}`);
