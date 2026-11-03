// FETCH TRACKER JOBS: refresh Accountant Staffing's and Administrative Staffing's job boards from
// their shared Tracker RMS feed before a build.
//
// Runs automatically before every build (see "prebuild" in package.json), right after ISL's Avionte
// fetch. One Tracker feed lists both brands' open jobs; its "sector" field says whose each one is:
//   Accountancy            -> Accountant Staffing      (src/brands/jobs/as.json)
//   Admin and Secretarial  -> Administrative Staffing  (src/brands/jobs/ads.json)
//   (blank)                -> whichever the title fits (accounting words go to AS)
// Only jobs that are open and set to "Publish on My Website?" in Tracker appear in the feed.
//
// The feed is public (it's what Tracker's own job board widget reads), so there's no secret.
// If it can't be reached, the build carries on with the jobs saved last time and says so.
//
// Tracker's field list (academy.tracker-rms.com, lesson 346) also offers description, salaryfrom,
// salaryto, salaryper and joblink. We ask for them; whichever the account returns get used.
import { writeFileSync, renameSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { stripHtml } from '../assistant/supabase/functions/_shared/jobs.js';

const FIELDS = 'reference,title,location,city,state,worktype,sector,publishdate,description,salaryfrom,salaryto,salaryper,joblink';
export const TRACKER_URL = `https://evoportalus.tracker-rms.com/AccountingStaffingAndAdministrativeStaffing/jobs?output=json&limit=500&fields=${FIELDS}`;

const REGISTER = 'https://evoportalus.tracker-rms.com/Resource/Register/?db=AccountingStaffingAndAdministrativeStaffing&jobcode=';

// Tracker sends a description either as text or wrapped as { "#cdata-section": "<p>...</p>" }
export function descriptionOf(d) {
  if (!d) return '';
  if (typeof d === 'string') return d;
  if (typeof d === 'object') return String(d['#cdata-section'] ?? d['#text'] ?? Object.values(d).find((v) => typeof v === 'string') ?? '');
  return '';
}

const SITES = { as: 'https://www.accountantstaffing.ca', ads: 'https://www.administrativestaffing.ca' };
const PROVINCES = { NS: 'Nova Scotia', NB: 'New Brunswick', PE: 'Prince Edward Island', NL: 'Newfoundland and Labrador',
  QC: 'Quebec', ON: 'Ontario', MB: 'Manitoba', SK: 'Saskatchewan', AB: 'Alberta', BC: 'British Columbia', YT: 'Yukon', NT: 'Northwest Territories', NU: 'Nunavut' };
const BY_NAME = Object.fromEntries(Object.entries(PROVINCES).map(([code, name]) => [name.toLowerCase(), code]));
const ACCOUNTING = /\b(account|accountant|accounting|acounting|payroll|tax|financ|finance|financial|bookkeep|bookkeeper|controller|cfo|audit|treasury|accounts? (payable|receivable))/i;

// Which brand a job belongs to
export function brandOf(job) {
  const sector = String(job.sector || '').toLowerCase();
  if (sector.startsWith('account')) return 'as';
  if (sector.startsWith('admin')) return 'ads';
  return ACCOUNTING.test(job.title || '') ? 'as' : 'ads';
}

// "Halifax, NS" / "New Brunswick" / "Dartmouth, NS, Remote" / "Dartmouth/Saint John, NS/NB" / ""
export function placeOf(location, city = '', state = '') {
  const parts = String(location || '').split(',').map((s) => s.trim()).filter(Boolean);
  let province = '';
  const extra = [];
  const places = [];
  for (const p of parts) {
    const code = p.toUpperCase().split('/')[0].trim();
    if (PROVINCES[code]) { province ||= code; continue; }
    if (BY_NAME[p.toLowerCase()]) { province ||= BY_NAME[p.toLowerCase()]; continue; }
    if (/^(remote|hybrid|on-?site)$/i.test(p)) { extra.push(p.replace(/^./, (c) => c.toUpperCase())); continue; }
    places.push(p.replace(/\s*\/\s*/g, ' / '));
  }
  if (!province && state) province = PROVINCES[String(state).toUpperCase()] ? String(state).toUpperCase() : BY_NAME[String(state).toLowerCase()] || '';
  const town = places[0] || String(city || '').trim() || (province ? PROVINCES[province] : 'Atlantic Canada');
  return { city: town, province, note: extra.join(', ') };
}

// "03 Nov 2026" -> "2026-11-03"
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
export function dateOf(s) {
  const m = String(s || '').match(/(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})/);
  if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${String(MONTHS[m[2].toLowerCase()]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const d = new Date(s);
  return isNaN(d) ? '' : d.toISOString().slice(0, 10);
}

// salaryfrom 55000, salaryto 65000, salaryper "Annum" -> "$55,000 to $65,000/year"
export function payOf({ salaryfrom, salaryto, salaryper }) {
  const n = (v) => Number(String(v ?? '').replace(/[^\d.]/g, ''));
  const lo = n(salaryfrom), hi = n(salaryto);
  if (!lo && !hi) return '';
  const per = String(salaryper || '').toLowerCase();
  const unit = /hour/.test(per) ? '/hour' : /day/.test(per) ? '/day' : /week/.test(per) ? '/week' : /month/.test(per) ? '/month' : (Math.max(lo, hi) >= 1000 ? '/year' : '/hour');
  const fmt = (v) => (v >= 1000 ? '$' + Math.round(v).toLocaleString('en-CA') : '$' + v.toFixed(2).replace(/\.00$/, ''));
  if (lo && hi && lo !== hi) return `${fmt(lo)} to ${fmt(hi)}${unit}`;
  return `${fmt(lo || hi)}${unit}`;
}

// worktype -> the site's two kinds of job, with a note for the in-between ones
function kindOf(worktype) {
  const w = String(worktype || '').trim();
  if (/fixed term|contract|temp/i.test(w)) return { employment: 'Temporary / contract', jobType: w, note: /fixed term/i.test(w) ? 'Fixed term' : '' };
  if (/part/i.test(w)) return { employment: 'Permanent', jobType: w, note: 'Part-time' };
  return { employment: 'Permanent', jobType: w || 'Permanent', note: '' };
}

export function toJob(raw) {
  const brand = brandOf(raw);
  const id = String(raw.reference || '').trim();
  const place = placeOf(raw.location, raw.city, raw.state);
  const kind = kindOf(raw.worktype);
  // The brand's own job page (what the live sites link to), and Tracker's application form, which
  // takes the job's number without "JOB-" (the same link the live job pages' Apply button uses)
  const link = `${SITES[brand]}/job-details?jobcode=${encodeURIComponent(id)}`;
  const apply = `${REGISTER}${encodeURIComponent(id.replace(/^JOB-/i, ''))}`;
  return {
    brand,
    job: {
      id,
      title: String(raw.title || '').trim(),
      employment: kind.employment,
      jobType: kind.jobType,
      city: place.city,
      province: place.province,
      category: String(raw.sector || ''),
      subcategory: '',
      office: '',
      pay: payOf(raw),
      posted: dateOf(raw.publishdate),
      description: stripHtml(descriptionOf(raw.description)),
      viewUrl: link,
      applyUrl: apply,
      note: [kind.note, place.note].filter(Boolean).join(', '),
    },
  };
}

// Tracker wraps the list as { Jobs: { Job: [ ... ] } } (converted from its XML), and a single job
// may come as one object, not a list of one. Find the job rows whatever the wrapping.
export function rowsIn(data) {
  if (Array.isArray(data)) return data.filter((x) => x && typeof x === 'object');
  if (!data || typeof data !== 'object') return [];
  if ('reference' in data || 'title' in data) return [data];
  for (const v of Object.values(data)) { const found = rowsIn(v); if (found.length) return found; }
  return [];
}

export async function refreshTracker({ url = TRACKER_URL, out = { as: 'src/brands/jobs/as.json', ads: 'src/brands/jobs/ads.json' }, fetchFeed = fetch } = {}) {
  const res = await fetchFeed(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`feed answered ${res.status}`);
  const data = await res.json();
  const rows = rowsIn(data);
  const jobs = rows.map(toJob).filter(({ job }) => job.id && job.title);
  if (!jobs.length) throw new Error('feed returned no jobs');
  const fields = [...new Set(rows.flatMap((r) => Object.keys(r || {})))];
  const saved = new Date().toISOString();
  const counts = {};
  const files = Object.entries(out).map(([brand, path]) => {
    const mine = jobs.filter((j) => j.brand === brand).map((j) => j.job);
    counts[brand] = mine.length;
    return [path, JSON.stringify({ saved, source: `Live from Tracker RMS (fields: ${fields.join(', ')})`, jobs: mine }, null, 1)];
  });
  try {
    for (const [path, text] of files) writeFileSync(path + '.tmp', text);
    for (const [path] of files) renameSync(path + '.tmp', path);
  } finally { for (const [path] of files) rmSync(path + '.tmp', { force: true }); }
  return { counts, fields };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const notice = (msg) => { console.log(`fetch-tracker: ${msg}`); if (process.env.GITHUB_ACTIONS) console.log(`::notice title=Tracker feed::${msg}`); };
  // Laptops and this sandbox's tests may not reach Tracker; GitHub does. Set TRACKER_OFFLINE=1 to skip.
  if (process.env.TRACKER_OFFLINE) notice('skipped, using the saved AS and ADS jobs.');
  else try {
    const { counts, fields } = await refreshTracker(process.env.TRACKER_FEED_URL ? { url: process.env.TRACKER_FEED_URL } : {});
    notice(`${counts.as} Accountant Staffing and ${counts.ads} Administrative Staffing jobs from the live feed. Fields Tracker sent: ${fields.join(', ')}.`);
  } catch (e) {
    console.warn(`fetch-tracker: couldn't refresh (${e.message}), using the saved AS and ADS jobs.`);
    if (process.env.GITHUB_ACTIONS) console.log(`::warning title=Tracker feed::Couldn't reach Tracker RMS (${e.message}). The AS and ADS boards show the jobs saved last time.`);
  }
}
