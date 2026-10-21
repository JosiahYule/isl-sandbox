// FETCH THE LABOUR FORCE SURVEY  (node scripts/fetch-lfs.mjs)
// Statistics Canada publishes the Labour Force Survey every month (usually the first Friday,
// 8:30 am Eastern). This reads the latest figures for Canada and the four Atlantic provinces
// from its Web Data Service and saves them to src/data/lfs/latest.json, which the
// "Atlantic job market" tool (/learn/tools/job-market/) is drawn from.
//
// It runs on GitHub (.github/workflows/update-lfs.yml), because this sandbox's own network
// can't reach Statistics Canada. It asks for each table's dimensions by name rather than by
// code, so it keeps working if Statistics Canada renumbers members.
//
// Tables (all monthly):
//   14-10-0287-01  Labour force characteristics by province, seasonally adjusted
//   14-10-0355-02  Employment by industry, seasonally adjusted
//   14-10-0063-01  Employee wages by industry, unadjusted
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';

const API = 'https://www150.statcan.gc.ca/t1/wds/rest/';
const OUT = new URL('../src/data/lfs/latest.json', import.meta.url);
const GEOS = ['Canada', 'Nova Scotia', 'New Brunswick', 'Prince Edward Island', 'Newfoundland and Labrador'];
const CODE = { Canada: 'CA', 'Nova Scotia': 'NS', 'New Brunswick': 'NB', 'Prince Edward Island': 'PE', 'Newfoundland and Labrador': 'NL' };

async function post(method, body) {
  const res = await fetch(API + method, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${method}: HTTP ${res.status}`);
  return res.json();
}

// A table's dimensions, with a lookup from member name to member ID
async function metadata(pid) {
  const [r] = await post('getCubeMetadata', [{ productId: pid }]);
  if (r.status !== 'SUCCESS') throw new Error(`getCubeMetadata ${pid}: ${JSON.stringify(r).slice(0, 300)}`);
  return r.object.dimension.map((d) => ({
    name: d.dimensionNameEn,
    position: d.dimensionPositionId,
    members: d.member.map((m) => ({ id: m.memberId, name: m.memberNameEn, parent: m.parentMemberId })),
  }));
}
const norm = (s) => s.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
function member(dim, name) {
  const m = dim.members.find((x) => norm(x.name) === norm(name)) || dim.members.find((x) => norm(x.name).startsWith(norm(name)));
  if (!m) throw new Error(`"${name}" not in "${dim.name}". Members: ${dim.members.map((x) => x.name).join(' | ')}`);
  return m.id;
}
const dimOf = (dims, re) => { const d = dims.find((x) => re.test(x.name)); if (!d) throw new Error(`No dimension like ${re}: ${dims.map((x) => x.name).join(', ')}`); return d; };

// One coordinate: a member ID for each dimension in order, padded to ten positions
function coordinate(dims, picks) {
  const ids = dims.map((d) => { const v = picks.find(([re]) => re.test(d.name)); if (!v) throw new Error(`No pick for dimension "${d.name}"`); return v[1]; });
  while (ids.length < 10) ids.push(0);
  return ids.join('.');
}

async function series(pid, requests, latestN) {
  const out = [];
  for (let i = 0; i < requests.length; i += 100) {
    const chunk = requests.slice(i, i + 100);
    const res = await post('getDataFromCubePidCoordAndLatestNPeriods', chunk.map((r) => ({ productId: pid, coordinate: r.coordinate, latestN })));
    res.forEach((r, k) => {
      const req = chunk[k];
      if (r.status !== 'SUCCESS') { console.warn(`  no data for ${req.key}: ${JSON.stringify(r.object).slice(0, 160)}`); return; }
      const points = (r.object.vectorDataPoint || []).map((p) => ({ month: p.refPer.slice(0, 7), value: p.value === null ? null : Number(p.value), released: p.releaseTime }));
      out.push({ ...req, points });
    });
  }
  return out;
}

async function main() {
  const data = { source: 'Statistics Canada, Labour Force Survey', fetched: new Date().toISOString(), provinces: {}, industries: {}, wages: {} };

  // 1. Labour force characteristics, seasonally adjusted
  {
    const pid = 14100287;
    const dims = await metadata(pid);
    const geo = dimOf(dims, /geograph/i), chr = dimOf(dims, /characteristic/i), gen = dimOf(dims, /gender|sex/i), age = dimOf(dims, /age/i), stat = dimOf(dims, /statistic/i), type = dimOf(dims, /data type/i);
    const want = [['unemploymentRate', 'Unemployment rate'], ['employment', 'Employment'], ['participationRate', 'Participation rate'], ['employmentRate', 'Employment rate'], ['labourForce', 'Labour force']];
    const reqs = [];
    for (const g of GEOS) for (const [key, name] of want) for (const [ageKey, ageName] of [['all', '15 years and over'], ['youth', '15 to 24 years']]) {
      if (ageKey === 'youth' && key !== 'unemploymentRate') continue;
      reqs.push({ geo: CODE[g], key: ageKey === 'youth' ? 'youthUnemploymentRate' : key, coordinate: coordinate(dims, [
        [/geograph/i, member(geo, g)], [/characteristic/i, member(chr, name)], [/gender|sex/i, member(gen, 'Total - Gender')],
        [/age/i, member(age, ageName)], [/statistic/i, member(stat, 'Estimate')], [/data type/i, member(type, 'Seasonally adjusted')],
      ]) });
    }
    for (const s of await series(pid, reqs, 25)) (data.provinces[s.geo] ??= {})[s.key] = s.points;
    console.log(`14-10-0287: ${reqs.length} series`);
  }

  // 2. Employment by industry, seasonally adjusted (every industry under the two sectors)
  {
    const pid = 14100355;
    const dims = await metadata(pid);
    const geo = dimOf(dims, /geograph/i), naics = dimOf(dims, /industry|naics/i), stat = dimOf(dims, /statistic/i), type = dimOf(dims, /data type/i);
    const total = naics.members.find((m) => /^total employed/i.test(m.name));
    const sectors = naics.members.filter((m) => /sector/i.test(m.name));
    // The industries: members whose parent is one of the two sectors
    const inds = naics.members.filter((m) => sectors.some((s) => s.id === m.parent));
    const reqs = [];
    for (const g of GEOS) for (const m of [total, ...inds]) {
      reqs.push({ geo: CODE[g], key: m === total ? 'Total' : m.name, coordinate: coordinate(dims, [
        [/geograph/i, member(geo, g)], [/industry|naics/i, m.id], [/statistic/i, member(stat, 'Estimate')], [/data type/i, member(type, 'Seasonally adjusted')],
      ]) });
    }
    for (const s of await series(pid, reqs, 13)) (data.industries[s.geo] ??= {})[s.key] = s.points;
    console.log(`14-10-0355: ${inds.length} industries, ${reqs.length} series`);
  }

  // 3. Average hourly wage, all employees, all industries (unadjusted, so compared year over year)
  {
    const pid = 14100063;
    const dims = await metadata(pid);
    const pick = (re, name) => { const d = dimOf(dims, re); return [re, member(d, name)]; };
    const reqs = GEOS.map((g) => ({ geo: CODE[g], key: 'averageHourly', coordinate: coordinate(dims, [
      pick(/geograph/i, g), pick(/^wages/i, 'Average hourly wage rate'), pick(/type of work/i, 'Both full- and part-time employees'),
      pick(/industry|naics/i, 'Total employees, all industries'), pick(/gender|sex/i, 'Total - Gender'), pick(/age/i, '15 years and over'),
    ]) }));
    for (const s of await series(pid, reqs, 25)) (data.wages[s.geo] ??= {})[s.key] = s.points;
    console.log(`14-10-0063: ${reqs.length} series`);
  }

  // The month the survey covers, from Canada's unemployment rate
  const ca = data.provinces.CA?.unemploymentRate;
  if (!ca?.length) throw new Error('No data came back for Canada; nothing saved.');
  data.month = ca.at(-1).month;
  data.released = ca.at(-1).released;

  const before = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : null;
  mkdirSync(new URL('.', OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(data, null, 1) + '\n');
  console.log(`Saved ${data.month} (released ${data.released})${before && before.month === data.month ? ', same month as before' : ', new month'}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
