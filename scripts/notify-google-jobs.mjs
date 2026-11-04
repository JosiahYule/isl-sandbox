// TELL GOOGLE ABOUT NEW AND CLOSED JOBS  (Google's Indexing API, made for job postings)
//
// Why: on Squarespace every job lives at one address that the page fills in from the job feed
// (/find-work/job?id=..., /job-details?jobcode=...). Google finds such pages slowly on its own, and
// Google for Jobs is where many job seekers start. The Indexing API lets a site say "this job page is
// new" or "this one has closed" the moment it happens. Google accepts it only for pages with job
// posting (or livestream) data, which is exactly what these are.
//
// Two steps, both in .github/workflows/deploy.yml:
//   node scripts/notify-google-jobs.mjs diff   during the build, before the new site is published:
//       compares each brand's open jobs (dist-sq/<brand>/live/jobs.json, written by
//       scripts/export-squarespace.mjs) with the copy that's live right now, and saves the
//       difference in .astro/google-jobs.json
//   node scripts/notify-google-jobs.mjs send   after the new site is published: sends that difference
//
// It does nothing until the GOOGLE_INDEXING_KEY secret is set. To switch it on, at launch:
//   1. Google Cloud: create a project, enable the "Web Search Indexing API", create a service account
//      and download its JSON key.
//   2. Search Console: add the service account's email address as an Owner of each brand's site.
//   3. GitHub: paste the whole JSON key as the repo secret GOOGLE_INDEXING_KEY.
// Google allows 200 notifications a day per project; a normal day is a handful.
//
// Safety: if the live copy can't be read (GitHub Pages down, a network error), nothing is sent, so a
// glitch can never announce every job as closed. On the very first run (no live copy yet) every
// open job is announced once.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BRANDS = ['isl', 'as', 'ads'];
const FILE = '.astro/google-jobs.json';
const DAILY_LIMIT = 200;
// Where the Squarespace files are published (the same address as SQ_ASSETS in astro.config.mjs; move both at launch)
const PUBLISHED = process.env.SQ_PUBLISHED_BASE || 'https://josiahyule.github.io/isl-sandbox/sq';

// What changed between the live list and the new one: new jobs to announce, closed ones to withdraw
export function diffJobs(previous, next) {
  const before = new Set(previous.map((j) => j.url));
  const after = new Set(next.map((j) => j.url));
  return {
    updated: [...after].filter((u) => !before.has(u)),
    deleted: [...before].filter((u) => !after.has(u)),
  };
}

// The live list: an array of jobs, [] when there isn't one yet (404), or null when it can't be read
export async function readLive(brand, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(`${PUBLISHED}/${brand}/live/jobs.json`, { signal: AbortSignal.timeout(15000), cache: 'no-store' });
    if (res.status === 404) return [];
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data?.jobs) ? data.jobs : null;
  } catch { return null; }
}

export async function diff({ fetchImpl = fetch, root = 'dist-sq' } = {}) {
  const out = { updated: [], deleted: [], skipped: [] };
  for (const brand of BRANDS) {
    const path = `${root}/${brand}/live/jobs.json`;
    if (!existsSync(path)) { out.skipped.push(`${brand}: no new job list`); continue; }
    const next = JSON.parse(readFileSync(path, 'utf8')).jobs;
    const live = await readLive(brand, fetchImpl);
    if (live === null) { out.skipped.push(`${brand}: couldn't read the live job list, so nothing is sent`); continue; }
    const d = diffJobs(live, next);
    out.updated.push(...d.updated);
    out.deleted.push(...d.deleted);
  }
  return out;
}

// A Google access token from the service account's key (a signed JWT, no extra packages)
async function accessToken(key, fetchImpl) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: key.client_email, scope: 'https://www.googleapis.com/auth/indexing', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(key.private_key, 'base64url');
  const res = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Google sign-in answered ${res.status}`);
  return (await res.json()).access_token;
}

export async function send({ changes, key, fetchImpl = fetch }) {
  const list = [...changes.updated.map((url) => ({ url, type: 'URL_UPDATED' })), ...changes.deleted.map((url) => ({ url, type: 'URL_DELETED' }))].slice(0, DAILY_LIMIT);
  if (!list.length) return { sent: 0, failed: 0 };
  const token = await accessToken(key, fetchImpl);
  let sent = 0, failed = 0;
  for (const item of list) {
    const res = await fetchImpl('https://indexing.googleapis.com/v3/urlNotifications:publish', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(item),
      signal: AbortSignal.timeout(15000),
    }).catch(() => null);
    if (res?.ok) sent++; else failed++;
    if (res?.status === 429) break; // the day's allowance is used up: the rest waits for tomorrow's changes
  }
  return { sent, failed };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const notice = (msg) => { console.log(`notify-google-jobs: ${msg}`); if (process.env.GITHUB_ACTIONS) console.log(`::notice title=Google for Jobs::${msg}`); };
  const step = process.argv[2];
  const raw = process.env.GOOGLE_INDEXING_KEY || '';
  if (!raw) notice('GOOGLE_INDEXING_KEY not set, so Google is not notified (see the top of this script to switch it on).');
  else if (step === 'diff') {
    const changes = await diff();
    writeFileSync(FILE, JSON.stringify(changes, null, 1));
    notice(`${changes.updated.length} new, ${changes.deleted.length} closed${changes.skipped.length ? `. ${changes.skipped.join('; ')}` : ''}`);
  } else if (step === 'send') {
    if (!existsSync(FILE)) notice('no list of changes from the build, nothing to send.');
    else try {
      const r = await send({ changes: JSON.parse(readFileSync(FILE, 'utf8')), key: JSON.parse(raw) });
      notice(`${r.sent} sent${r.failed ? `, ${r.failed} failed` : ''}`);
      if (r.failed && !r.sent) process.exitCode = 1;
    } catch (e) {
      // Never print the key; the message is Google's status, not a secret
      console.error(`notify-google-jobs: ${e.message}`);
      process.exitCode = 1;
    }
  } else { console.error('Use: node scripts/notify-google-jobs.mjs diff | send'); process.exitCode = 1; }
}
