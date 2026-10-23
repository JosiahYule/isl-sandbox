// FETCH JOBS: refresh the job snapshot from ISL's live Avionte feed before a build.
//
// Runs automatically before every build (see "prebuild" in package.json).
// - On GitHub, the deploy workflow passes in the AVIONTE_FEED_URL secret, so every build
//   (including the scheduled ones) gets the jobs that are open right now.
// - On a laptop without the secret, it does nothing and the build uses the saved snapshot.
//
// It uses the same cleaning code as the job assistant (assistant/.../_shared/jobs.js), so the
// website and the chatbot always see identical jobs.
//
// A configured feed failure stops publication, leaving the last working Pages site intact.
// Local builds without the secret deliberately use the saved snapshot.
import { writeFileSync, renameSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { normalizeFeed } from '../assistant/supabase/functions/_shared/jobs.js';

export async function refreshJobs({ url, out = 'assistant/data/jobs-snapshot.json', meta = 'assistant/data/jobs-meta.json', fetchFeed = fetch }) {
  const res = await fetchFeed(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`feed answered ${res.status}`);
  // Preserve both original pay sources so the build's review report can flag discrepancies.
  const jobs = normalizeFeed(await res.json(), { resolvePay: false });
  if (!jobs.length) throw new Error('feed returned no jobs');
  if (new Set(jobs.map((job) => job.id)).size !== jobs.length) throw new Error('feed contains duplicate job IDs');
  const files = [[out, JSON.stringify(jobs, null, 1)], [meta, JSON.stringify({ fetched: new Date().toISOString() }, null, 1)]];
  try {
    for (const [path, text] of files) writeFileSync(path + '.tmp', text);
    for (const [path] of files) renameSync(path + '.tmp', path);
  } finally { for (const [path] of files) rmSync(path + '.tmp', { force: true }); }
  return jobs.length;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const url = process.env.AVIONTE_FEED_URL;
  if (!url) console.log('fetch-jobs: no AVIONTE_FEED_URL set, using the saved job snapshot.');
  else try {
    console.log(`fetch-jobs: ${await refreshJobs({ url })} jobs from the live feed.`);
  } catch {
    // Feed URLs can contain credentials. Do not echo URLs or network exception messages.
    console.error('fetch-jobs: refresh failed. Publication stopped; the last published site is unchanged.');
    process.exitCode = 1;
  }
}
