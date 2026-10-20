// CHECK JOBS: compare each posting's pay in the feed with the pay written in the ad itself.
//
// Recruiters enter pay twice in Avionte: in the pay fields (what the board and the job card
// show) and in the ad's text. When they disagree, a job page can show "$17 to $19/hour" in its
// card and "$18.00-$20.00/hour" in the description. This lists every hourly job where the two
// don't match, so the recruiter can fix whichever is wrong.
//
// Runs before every build (package.json "prebuild"). Prints to the build log, and on GitHub it
// also adds a table to the run's summary page (Actions tab > the run > Summary).
// It never stops the build.
import { readFileSync, appendFileSync } from 'node:fs';

const jobs = JSON.parse(readFileSync('assistant/data/jobs-snapshot.json', 'utf8'));
const num = (s) => Number(String(s).replace(/,/g, ''));

// "$18.00-$20.00/hour", "$18 to $20 per hour", "$19 per hour", "$22.00/hour", "$18/hr"
const RANGE = /\$\s?(\d{1,2}(?:\.\d{1,2})?)\s*(?:-|–|to)\s*\$?\s?(\d{1,2}(?:\.\d{1,2})?)\s*(?:\/|per|an|a)\s*(?:hour|hr)\b/i;
const SINGLE = /\$\s?(\d{1,2}(?:\.\d{1,2})?)\s*(?:\/|per|an|a)\s*(?:hour|hr)\b/i;

function textPay(desc) {
  const r = desc.match(RANGE);
  if (r) return [num(r[1]), num(r[2])];
  const s = desc.match(SINGLE);
  return s ? [num(s[1]), num(s[1])] : null;
}
function feedPay(pay) {
  const m = String(pay).match(/^\$([\d.]+)(?: to \$([\d.]+))?\/hour$/);
  return m ? [num(m[1]), num(m[2] ?? m[1])] : null;
}

const issues = [];
for (const j of jobs) {
  const f = feedPay(j.pay), t = textPay(j.description || '');
  if (!t) continue;
  if (!f) { if (!j.pay) issues.push([j, 'none', t]); continue; }
  if (Math.abs(f[0] - t[0]) > 0.01 || Math.abs(f[1] - t[1]) > 0.01) issues.push([j, j.pay, t]);
}

const money = (n) => `$${n % 1 ? n.toFixed(2) : n}`;
const fmt = ([a, b]) => (a === b ? `${money(a)}/hour` : `${money(a)} to ${money(b)}/hour`);
const where = (j) => [j.city, j.province].filter(Boolean).join(', ');
if (!issues.length) {
  console.log('check-jobs: feed pay matches the ad text on every hourly job.');
} else {
  console.log(`check-jobs: ${issues.length} job(s) where the feed's pay and the ad's text disagree:`);
  for (const [j, p, t] of issues) console.log(`  ${j.id}  ${j.title} (${where(j)}): feed ${p === 'none' ? 'has no pay' : p}, ad says ${fmt(t)}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const rows = issues.map(([j, p, t]) => `| ${j.title} | ${where(j)} | ${p === 'none' ? 'No pay set' : p} | ${fmt(t)} | ${j.id} |`).join('\n');
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Job pay to check\n\nThe feed's pay fields and the ad's own text disagree on these jobs. Fix whichever is wrong in Avionte.\n\n| Job | Where | Feed pay | Ad text | Avionte ID |\n| --- | --- | --- | --- | --- |\n${rows}\n`);
  }
}
