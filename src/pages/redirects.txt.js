// REDIRECTS for the live site: old Squarespace addresses -> their new pages.
// Built as /redirects.txt, then renamed to /_redirects after the build (astro.config.mjs),
// the file Netlify and Cloudflare Pages read. GitHub Pages ignores it, which is fine for the
// sandbox; it matters once the real domain points at the new site.
//
// Paths are for the live domain (no /isl-sandbox prefix). 301 = moved for good, so Google
// passes each old page's ranking to the new one.
//
// Old job links look like /find-work/job?id=MA8518021108. Netlify can match that ?id= and send
// each one to the job's own page; Cloudflare ignores query strings and uses the last line instead.
import { jobs } from '../data/jobs.js';

const moved = [
  ['/directhire', '/direct-hire/'],   // older duplicate of the direct hire page
  ['/hire-1', '/hire/'],              // the mobile menu's old "Hire" link
  ['/mood-board', '/'],               // test pages that were public on the live site
  ['/new-page-1', '/'],
  ['/mock-team-page', '/team/'],
];

export function GET() {
  const lines = [
    '# Old addresses -> new pages (see src/pages/redirects.txt.js)',
    ...moved.map(([from, to]) => `${from}  ${to}  301`),
    '',
    '# Each open job\'s old link -> its own page (Netlify)',
    ...jobs.map((j) => `/find-work/job  id=${j.id}  /find-work/${j.slug}/  301`),
    '/find-work/job  /find-work/  301',
  ];
  return new Response(lines.join('\n') + '\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
