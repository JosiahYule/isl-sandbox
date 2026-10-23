// RECORD MARKET: once a day, save a one-line summary of ISL's open jobs.
//
// Why: a future "hiring market" tool needs history (is demand for drivers rising in New
// Brunswick? is warehouse pay moving?). History can't be filled in later, so we start
// keeping it now. Each run adds one line to src/data/market/history.jsonl:
//   { date, total, byProvince, byType, byFamily: { "Drivers": { n, median } } }
// (median = middle hourly pay of the jobs in that family that state a pay)
//
// Runs from .github/workflows/record-market.yml with the AVIONTE_FEED_URL secret.
// Without the secret it does nothing. Running twice on one day replaces that day's line.
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs';
import { normalizeFeed } from '../assistant/supabase/functions/_shared/jobs.js';
import { familyOf, readPay } from '../src/lib/jobpay.js';

const FEED = process.env.AVIONTE_FEED_URL;
const FILE = 'src/data/market/history.jsonl';

if (!FEED) {
  console.log('record-market: no AVIONTE_FEED_URL set, nothing recorded.');
  process.exit(0);
}

const res = await fetch(FEED, { signal: AbortSignal.timeout(30000) });
if (!res.ok) throw new Error(`feed answered ${res.status}`);
const jobs = normalizeFeed(await res.json());
if (!jobs.length) { console.warn('record-market: feed returned no jobs, nothing recorded.'); process.exit(0); }

const tally = (key) => jobs.reduce((o, j) => { const k = key(j) || 'Unknown'; o[k] = (o[k] || 0) + 1; return o; }, {});
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const k = Math.floor(s.length / 2); return s.length ? (s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2) : null; };

const byFamily = {};
for (const j of jobs) {
  const f = familyOf(j.title);
  (byFamily[f] ||= { n: 0, pay: [] }).n++;
  const p = readPay(j.pay);
  if (p) byFamily[f].pay.push(p.hourly);
}
for (const f of Object.keys(byFamily)) {
  const m = median(byFamily[f].pay);
  byFamily[f] = { n: byFamily[f].n, median: m === null ? null : Math.round(m * 100) / 100 };
}

const date = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Halifax' }); // YYYY-MM-DD
const entry = {
  date,
  total: jobs.length,
  byProvince: tally((j) => j.province),
  byType: tally((j) => (j.employment === 'Permanent' ? 'permanent' : 'contract')),
  byFamily,
};

mkdirSync('src/data/market', { recursive: true });
const lines = existsSync(FILE) ? readFileSync(FILE, 'utf8').split('\n').filter(Boolean) : [];
const kept = lines.filter((l) => JSON.parse(l).date !== date);
writeFileSync(FILE + '.tmp', [...kept, JSON.stringify(entry)].join('\n') + '\n');
renameSync(FILE + '.tmp', FILE);
console.log(`record-market: ${date}, ${jobs.length} jobs recorded (${kept.length + 1} days on file).`);
