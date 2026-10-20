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
// Safety: if the feed can't be reached, or comes back empty, the saved snapshot is kept.
// A hiccup at Avionte should never publish an empty job board.
import { writeFileSync } from 'node:fs';
import { normalizeFeed } from '../assistant/supabase/functions/_shared/jobs.js';

const FEED = process.env.AVIONTE_FEED_URL;
const OUT = 'assistant/data/jobs-snapshot.json';
const META = 'assistant/data/jobs-meta.json';

if (!FEED) {
  console.log('fetch-jobs: no AVIONTE_FEED_URL set, using the saved job snapshot.');
  process.exit(0);
}

try {
  const res = await fetch(FEED, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`feed answered ${res.status}`);
  const jobs = normalizeFeed(await res.json());
  if (!jobs.length) throw new Error('feed returned no jobs');
  writeFileSync(OUT, JSON.stringify(jobs, null, 1));
  writeFileSync(META, JSON.stringify({ fetched: new Date().toISOString() }, null, 1));
  console.log(`fetch-jobs: ${jobs.length} jobs from the live feed.`);
} catch (err) {
  console.warn(`fetch-jobs: couldn't refresh (${err.message}); keeping the saved snapshot.`);
}
