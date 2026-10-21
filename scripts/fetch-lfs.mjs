// FETCH THE LABOUR FORCE SURVEY  (node scripts/fetch-lfs.mjs)
// Statistics Canada publishes the Labour Force Survey every month (usually the first Friday,
// 8:30 am Eastern). This reads the latest two years for Canada and the four Atlantic provinces
// and saves them to src/data/lfs/latest.json, which the Atlantic jobs report
// (/learn/tools/jobs-report/) is drawn from.
//
// It runs on GitHub (.github/workflows/update-lfs.yml), because this sandbox's own network
// can't reach Statistics Canada. It downloads each table's full CSV (a zip of every series
// since 1976), reads it line by line, and keeps only the rows below. The CSVs are static files,
// so they're more dependable than Statistics Canada's data API, which goes down at times.
// Rows are matched by column name and member name, not by code, so renumbering doesn't break it.
//
// Tables (all monthly):
//   14-10-0287-01  Labour force characteristics by province, seasonally adjusted
//   14-10-0355-02  Employment by industry, seasonally adjusted
//   14-10-0063-01  Employee wages by industry, unadjusted
import { writeFileSync, readFileSync, existsSync, mkdirSync, createWriteStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const OUT = new URL('../src/data/lfs/latest.json', import.meta.url);
const GEOS = { Canada: 'CA', 'Nova Scotia': 'NS', 'New Brunswick': 'NB', 'Prince Edward Island': 'PE', 'Newfoundland and Labrador': 'NL' };
const MONTHS = 25; // two years and a month: enough for year-over-year changes and a trend line
const UA = { 'User-Agent': 'isl-sandbox jobs report (github.com/JosiahYule/isl-sandbox)' };

// One CSV line into fields (Statistics Canada quotes every field; quotes inside are doubled)
function fields(line) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}
const clean = (s) => s.replace(/^﻿/, '').trim();
const strip = (s) => s.replace(/\s*\[[^\]]*\]\s*$/, '').trim(); // "Construction [23]" -> "Construction"

// Download a table's zip, then stream its CSV, keeping the rows `keep` accepts
// Statistics Canada's site goes down at times (it answers with an "unavailable" page), so each
// download gets three tries, a minute apart
async function download(url, file) {
  for (let i = 1; ; i++) {
    const res = await fetch(url, { headers: UA });
    if (res.ok && /zip|octet/.test(res.headers.get('content-type') || '')) return pipeline(Readable.fromWeb(res.body), createWriteStream(file));
    const why = `${url}: HTTP ${res.status} ${res.headers.get('content-type')}`;
    if (i === 3) throw Object.assign(new Error(why), { unavailable: true });
    console.log(`${why}; trying again in a minute`);
    await new Promise((r) => setTimeout(r, 60000));
  }
}

// The release date, from the metadata file that comes in the same zip
async function releaseTime(pid) {
  const unzip = spawn('unzip', ['-p', join(tmpdir(), `${pid}.zip`), `${pid}_MetaData.csv`]);
  const lines = createInterface({ input: unzip.stdout, crlfDelay: Infinity });
  let head = null, out = null;
  for await (const line of lines) {
    if (out) continue;
    if (!head) { head = fields(line).map(clean); continue; }
    const f = fields(line); const i = head.findIndex((h) => /release time/i.test(h));
    out = i >= 0 ? f[i] : '';
  }
  return out || null;
}

async function readTable(pid, keep) {
  const url = `https://www150.statcan.gc.ca/n1/tbl/csv/${pid}-eng.zip`;
  const zip = join(tmpdir(), `${pid}.zip`);
  await download(url, zip);
  const unzip = spawn('unzip', ['-p', zip, `${pid}.csv`]);
  const lines = createInterface({ input: unzip.stdout, crlfDelay: Infinity });
  let head = null; const rows = [];
  for await (const line of lines) {
    if (!head) { head = fields(line).map(clean); continue; }
    const f = fields(line);
    const row = Object.fromEntries(head.map((h, i) => [h, f[i]]));
    if (keep(row)) rows.push(row);
  }
  if (!head) throw new Error(`${pid}: the zip had no CSV`);
  return { head, rows };
}

// Rows -> { key: [{ month, value }] }, oldest first, the last MONTHS months only
function toSeries(rows, keyOf) {
  const out = {};
  for (const r of rows) {
    const v = r.VALUE === '' ? null : Number(r.VALUE);
    (out[keyOf(r)] ??= []).push({ month: r.REF_DATE.slice(0, 7), value: v });
  }
  for (const k in out) out[k] = out[k].sort((a, b) => a.month.localeCompare(b.month)).slice(-MONTHS);
  return out;
}
const col = (head, re) => { const c = head.find((h) => re.test(h)); if (!c) throw new Error(`No column like ${re} in: ${head.join(', ')}`); return c; };

async function main() {
  const since = new Date(); since.setMonth(since.getMonth() - MONTHS - 3);
  const recent = (r) => r.REF_DATE >= since.toISOString().slice(0, 7);
  const data = { source: 'Statistics Canada, Labour Force Survey (tables 14-10-0287-01, 14-10-0355-02, 14-10-0063-01)', fetched: new Date().toISOString(), provinces: {}, industries: {}, wages: {} };

  // 1. Labour force characteristics, seasonally adjusted
  {
    const WANT = { 'Unemployment rate': 'unemploymentRate', Employment: 'employment', 'Participation rate': 'participationRate', 'Employment rate': 'employmentRate', 'Labour force': 'labourForce' };
    let C;
    const { head, rows } = await readTable('14100287', (r) => {
      C ??= { chr: Object.keys(r).find((k) => /characteristic/i.test(k)), gen: Object.keys(r).find((k) => /gender|sex/i.test(k)), age: Object.keys(r).find((k) => /age group/i.test(k)) };
      return GEOS[r.GEO] && recent(r) && r.Statistics === 'Estimate' && r['Data type'] === 'Seasonally adjusted' && /^Total - (Gender|Sex)/.test(r[C.gen])
        && ((WANT[r[C.chr]] && r[C.age] === '15 years and over') || (r[C.chr] === 'Unemployment rate' && r[C.age] === '15 to 24 years'));
    });
    if (!rows.length) throw new Error(`14-10-0287: no rows matched. Columns: ${head.join(', ')}`);
    const s = toSeries(rows, (r) => `${GEOS[r.GEO]}|${r[C.age] === '15 to 24 years' ? 'youthUnemploymentRate' : WANT[r[C.chr]]}`);
    for (const k in s) { const [g, key] = k.split('|'); (data.provinces[g] ??= {})[key] = s[k]; }
    console.log(`14-10-0287: ${rows.length} rows, ${Object.keys(s).length} series`);
    data.released = await releaseTime('14100287').catch(() => null);
  }

  // 2. Employment by industry, seasonally adjusted (thousands of people)
  {
    let N;
    const { head, rows } = await readTable('14100355', (r) => {
      N ??= Object.keys(r).find((k) => /industry|naics/i.test(k));
      return GEOS[r.GEO] && recent(r) && r.Statistics === 'Estimate' && r['Data type'] === 'Seasonally adjusted' && !/sector$/i.test(strip(r[N]));
    });
    if (!rows.length) throw new Error(`14-10-0355: no rows matched. Columns: ${head.join(', ')}`);
    const s = toSeries(rows, (r) => `${GEOS[r.GEO]}|${/^Total employed/i.test(r[N]) ? 'Total' : strip(r[N])}`);
    for (const k in s) { const [g, key] = k.split('|'); (data.industries[g] ??= {})[key] = s[k]; }
    console.log(`14-10-0355: ${rows.length} rows, ${Object.keys(s).length} series`);
  }

  // 3. Average hourly wage, all employees, all industries (unadjusted: compare year over year)
  {
    let C;
    const { head, rows } = await readTable('14100063', (r) => {
      C ??= { wages: col(Object.keys(r), /^wages/i), work: col(Object.keys(r), /type of work/i), naics: col(Object.keys(r), /industry|naics/i), gen: col(Object.keys(r), /gender|sex/i), age: col(Object.keys(r), /age group/i) };
      return GEOS[r.GEO] && recent(r) && r[C.wages] === 'Average hourly wage rate' && r[C.work] === 'Both full- and part-time employees'
        && /^Total employees, all industries/.test(r[C.naics]) && /^Total - (Gender|Sex)/.test(r[C.gen]) && r[C.age] === '15 years and over';
    });
    if (!rows.length) throw new Error(`14-10-0063: no rows matched. Columns: ${head.join(', ')}`);
    const s = toSeries(rows, (r) => GEOS[r.GEO]);
    for (const g in s) data.wages[g] = { averageHourly: s[g] };
    console.log(`14-10-0063: ${rows.length} rows`);
  }

  // The month the survey covers, from Canada's unemployment rate
  const ca = data.provinces.CA?.unemploymentRate;
  if (!ca?.length) throw new Error('No unemployment rate for Canada; nothing saved.');
  data.month = ca.at(-1).month;

  const before = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : null;
  mkdirSync(new URL('.', OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(data) + '\n');
  return `Saved ${data.month}${before && before.month === data.month ? ' (same month as before)' : ' (new month)'}`;
}

// On GitHub, ::error:: and ::notice:: lines show up as annotations on the run
const gh = !!process.env.GITHUB_ACTIONS;
const note = (kind, msg) => console.log(gh ? `::${kind}::${String(msg).replace(/\n/g, ' ').slice(0, 3000)}` : msg);
// If Statistics Canada is down and we already have figures, keep them and try again next time
// (a warning, not a failed run). With no figures yet, it fails so someone notices.
main().then((m) => note('notice', m)).catch((e) => {
  if (e.unavailable && existsSync(OUT)) { note('warning', `${e.message}. Kept the figures we have; the next run will try again.`); return; }
  note('error', e.message); process.exit(1);
});
