// Blog posts currently on each brand's live site (newest first).
// The sandbox links out to them rather than copying them in.
// `audience` lets the Learn page filter by employer vs job seeker. TODO: check the tags.

// On Squarespace (SITE_MODE=squarespace) the blog moved from /learn to /blog, so the new Learn page could
// have /learn; old /learn/<post> links are forwarded by URL Mappings. The sandbox links to the live site,
// where the posts are still under /learn until launch.
import { BRAND } from '../brands/index.js';
const ON_SQUARESPACE = typeof __SQ__ !== 'undefined' && __SQ__;
const LIVE = { isl: 'https://www.integratedstaffing.ca/learn/', as: 'https://www.accountantstaffing.ca/learn/', ads: 'https://www.administrativestaffing.ca/learn/' };
const base = ON_SQUARESPACE ? '/blog/' : LIVE[BRAND];

const ISL = [
  { title: 'Hiring through an uncertain economy', slug: 'hiring-in-an-uncertain-economy', date: '2026-10-01', audience: 'employers' },
  { title: 'The hiring steps AI has made unreliable, and what still works', slug: 'the-hiring-steps-ai-has-made-unreliable-and-what-still-works', date: '2026-09-17', audience: 'employers' },
  { title: "What August's national jobs slowdown means for Atlantic Canada", slug: 'what-augusts-national-jobs-slowdown-means-and-doesnt-mean-for-atlantic-canada', date: '2026-09-08', audience: 'everyone' },
  { title: 'Optimize your LinkedIn profile', slug: 'optimize-linkedin-profile', date: '2026-08-24', audience: 'job seekers' },
  { title: 'What a recruitment partner saves you', slug: 'what-a-recruitment-partner-saves-you', date: '2026-08-18', audience: 'employers' },
  { title: 'Using AI in your job search', slug: 'using-ai-in-your-job-search-what-helps-and-what-gets-you-rejected', date: '2026-08-05', audience: 'job seekers' },
  { title: 'Temp or direct hire: which recruitment model?', slug: 'temp-direct-hire-which-recruitment-model', date: '2026-07-22', audience: 'employers' },
  { title: "Moncton's job market in 2026", slug: 'monctons-job-market-in-2026-why-unemployment-is-up-and-employers-still-cant-hire', date: '2026-07-16', audience: 'everyone' },
  { title: 'How to stand out in a job interview', slug: 'how-to-stand-out-in-a-job-interview-what-recruiters-see-from-the-other-side-of-the-table', date: '2026-07-02', audience: 'job seekers' },
  { title: 'Landing the entry-level job', slug: 'landing-the-entry-level-job', date: '2026-06-22', audience: 'job seekers' },
  { title: 'The trades shortage in Atlantic Canada, 2026', slug: 'trades-shortage-atlantic-canada-2026', date: '2026-06-15', audience: 'everyone' },
  { title: 'Work and live in Newfoundland', slug: 'work-live-newfoundland', date: '2026-05-25', audience: 'job seekers' },
  { title: 'Resume audit tool', slug: 'resume-audit', date: '2026-05-12', audience: 'job seekers' },
  { title: 'Atlantic Canada wage guide 2026', slug: 'wage-guide-atlantic-canada-2026', date: '2026-05-04', audience: 'everyone' },
  { title: 'Why New Brunswick: a practical guide', slug: 'why-new-brunswick-a-practical-guide-for-canadians-considering-a-move', date: '2026-04-27', audience: 'job seekers' },
  { title: 'Halifax industrial and trades jobs', slug: 'halifax-industrial-trades-jobs', date: '2026-04-27', audience: 'job seekers' },
];

// Accountant Staffing (read from accountantstaffing.ca/learn, October 30, 2026)
const AS = [
  { title: 'Year-end staffing for finance teams: what to book and when', slug: 'year-end-staffing-for-finance-teams-what-to-book-and-when', date: '2026-10-28', audience: 'employers' },
  { title: 'Accounting and finance hiring in Atlantic Canada: the July 2026 numbers', slug: 'accounting-finance-july-2026', date: '2026-08-13', audience: 'everyone' },
];

export const posts = ({ isl: ISL, as: AS }[BRAND] || []).map((p) => ({ ...p, url: base + p.slug }));
