// REDIRECTS for Accountant Staffing and Administrative Staffing: old Squarespace addresses -> their new pages.
// Built as /redirects.txt, then renamed to /_redirects after the build (astro.config.mjs), the file
// Netlify and Cloudflare Pages read. GitHub Pages ignores it, which is fine for the sandbox.
// Paths are for each brand's own domain. 301 = moved for good, so Google passes each old page's
// ranking to the new one.
//
// Old job links look like /job-details?jobcode=JOB-18557. Netlify can match that ?jobcode= and send
// each one to the job's own page; anything else goes to the job board.
import { jobs } from '../../data/jobs.js';
import { team } from '../../data/team.js';
import { BRAND } from '../../data/site.js';

// Each live site's addresses (read in the browser, October 30, 2026) that differ from the new pages.
// /, /employers, /job-seekers, /permanent-recruitment, /temporary-recruitment and /privacy-policy stay as they are.
const moved = [
  ['/job-opportunities', '/find-work/'], // the live sites' menu labels, kept as the new pages' names
  ['/our-team', '/team/'],
  ...(BRAND === 'ads'
    ? [['/about-us', '/about/'], ['/contact-us', '/contact/'], ['/employers-1', '/employers/']] // ADS: and an unlisted copy of Employers
    : [['/employers1', '/employers/']]), // AS: About and Contact are already /about and /contact; an unlisted copy of Employers
];

export function GET() {
  const lines = [
    '# Old addresses -> new pages (see src/sites/specialist/redirects.txt.js)',
    ...moved.map(([from, to]) => `${from}  ${to}  301`),
    // Each team profile's old address (/team-member/<slug>) -> its page here
    ...team.map((p) => `/team-member/${p.slug}  /team/${p.slug}/  301`),
    '',
    "# Each open job's old link -> its own page (Netlify)",
    ...jobs.map((j) => `/job-details  jobcode=${j.id}  /find-work/${j.slug}/  301`),
    '/job-details  /find-work/  301',
  ];
  return new Response(lines.join('\n') + '\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
