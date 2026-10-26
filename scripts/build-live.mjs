// BUILD FOR THE LIVE DOMAINS  (npm run build:live, or npm run build:live -- isl)
// Builds each brand for the root of its own domain (SITE_MODE=live in astro.config.mjs) into
// dist-live/<brand>/, one folder per site, so each domain's host publishes just its own folder:
//   dist-live/isl/  -> www.integratedstaffing.ca
//   dist-live/as/   -> www.accountantstaffing.ca
//   dist-live/ads/  -> www.administrativestaffing.ca
// On a host like Netlify: build command "npm run build:live -- isl", publish directory "dist-live/isl".
// The sandbox build (npm run build:all) is unchanged and still deploys the previews.
import { spawnSync } from 'node:child_process';

const all = ['isl', 'as', 'ads'];
const asked = process.argv.slice(2).filter(Boolean);
const brands = asked.length ? asked : all;
for (const b of brands) if (!all.includes(b)) { console.error(`Unknown brand "${b}". Use isl, as or ads.`); process.exit(1); }

const run = (cmd, args, env = {}) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit', env: { ...process.env, ...env } });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

// The same steps the sandbox build runs first: fresh jobs, the pay check, the assistant files
run('node', ['scripts/fetch-jobs.mjs']);
run('node', ['scripts/check-jobs.mjs']);
run('node', ['scripts/sync-assistant.mjs']);
for (const b of brands) run('npx', ['astro', 'build'], { BRAND: b, SITE_MODE: 'live' });
console.log(`Built for the live domains: ${brands.map((b) => `dist-live/${b}/`).join(', ')}`);
