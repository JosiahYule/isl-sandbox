// TOOLS: ISL's recruitment intelligence tools, all under Learn.
// One list feeds the Learn menu, the tool cards (homepage and Learn) and /learn/tools/.
// Tools are built into this site (/learn/tools/<key>/). Guides are long-form posts on the live site.
import { url } from '../lib/url.js';
import { posts } from './posts.js';
import { tools as brandTools, BRAND } from './site.js';

const post = (slug) => posts.find((p) => p.slug === slug);

export const tools = [
  {
    key: 'true-cost-of-an-employee', preview: 'cost',
    title: 'True cost of an employee',
    who: 'For employers',
    d: 'What each hour worked really costs once CPP, EI, workers’ comp, vacation and holidays are added.',
    cta: 'Work it out',
  },
  {
    key: 'pay-on-open-jobs', preview: 'pay',
    title: 'Pay on our open jobs',
    who: 'For employers and job seekers',
    d: 'What employers are offering right now, by role and province, from every job we’re hiring for.',
    cta: 'See the pay',
  },
  {
    key: 'job-ad-check', preview: 'ad',
    title: 'Job ad check',
    who: 'For employers',
    d: 'A score and fixes for your job ad, the pay rules in your province, and your pay against our open jobs.',
    cta: 'Check my ad',
  },
  {
    key: 'resume-check', preview: 'resume',
    title: 'Resume check',
    who: 'For job seekers',
    d: 'A score, the fixes that matter most, and which of our open jobs it fits. It never leaves your browser.',
    cta: 'Check my resume',
  },
]
  // Each brand lists the tools it has (src/brands/): AS and ADS have no pay tool yet
  .filter((t) => brandTools.list.includes(t.key))
  .map((t) => ({ ...t, url: url(`/learn/tools/${t.key}/`) }))
  // Without pay on their open jobs, the job ad check can't compare pay (AS, ADS for now)
  .map((t) => (t.key === 'job-ad-check' && !brandTools.list.includes('pay-on-open-jobs') ? { ...t, d: 'A score and fixes for your job ad, and the pay rules in your province.' } : t));

export const guides = [
  { ...post('wage-guide-atlantic-canada-2026'), who: 'For employers and job seekers', d: 'Entry-level to top-of-market hourly rates, by industry and role.' },
  { ...post('why-new-brunswick-a-practical-guide-for-canadians-considering-a-move'), who: 'For job seekers', d: 'Jobs, cities and what your salary is worth there.' },
].filter((g) => g.url && BRAND === 'isl'); // the guides are ISL's posts
