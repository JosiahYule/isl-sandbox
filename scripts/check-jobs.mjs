// Compare all advertised base-pay tiers with the feed. Conflicts publish without a numerical
// claim until corrected in Avionte. The original feed remains available for recruiter review.
import { readFileSync, appendFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { checkCompensation, formatCompensation } from '../assistant/supabase/functions/_shared/compensation.js';

const jobs = JSON.parse(readFileSync('assistant/data/jobs-snapshot.json', 'utf8'));
const issues = jobs.flatMap((job) => {
  const check = checkCompensation(job);
  return check.conflict ? [{ id: job.id, title: job.title, location: [job.city, job.province].filter(Boolean).join(', '),
    feed_pay: job.pay, advertised_pay: formatCompensation(check.envelope), action: 'Confirm the correct rate in Avionte; the website currently asks candidates to confirm pay with a recruiter.' }] : [];
});
mkdirSync('.astro', { recursive: true });
writeFileSync('.astro/pay-review.json', JSON.stringify({ checked: jobs.length, issues }, null, 2) + '\n');
if (!issues.length) console.log('check-jobs: no conflicting pay ranges.');
else {
  console.warn('check-jobs: ' + issues.length + ' pay conflicts need recruiter review. Numerical pay is withheld for these postings:');
  for (const job of issues) console.warn('  ' + job.id + ': ' + job.feed_pay + ' in pay fields; ' + job.advertised_pay + ' in the ad.');
  if (process.env.GITHUB_STEP_SUMMARY) {
    const cell = (s) => String(s).replace(/\|/g, '/').replace(/[\r\n]/g, ' ');
    const rows = issues.map((j) => '| ' + [j.title, j.location, j.feed_pay, j.advertised_pay, j.id].map(cell).join(' | ') + ' |').join('\n');
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, '### Pay ranges requiring confirmation\n\nThe website withholds conflicting numerical rates. Correct the source in Avionte; the next feed refresh restores the rate automatically.\n\n| Job | Where | Feed pay | Ad pay | ID |\n| --- | --- | --- | --- | --- |\n' + rows + '\n');
  }
  if (process.argv.includes('--strict')) process.exitCode = 1;
}
