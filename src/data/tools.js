// TOOLS: ISL's recruitment intelligence tools, all under Learn.
// One list feeds the Learn menu, the tool cards (homepage and Learn) and /learn/tools/.
// Tools are built into this site (/learn/tools/<key>/). Guides are long-form posts on the live site.
import { url } from '../lib/url.js';
import { posts } from './posts.js';

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
    key: 'resume-check', preview: 'resume',
    title: 'Resume check',
    who: 'For job seekers',
    d: 'A score, the fixes that matter most, and which of our open jobs it fits. It never leaves your browser.',
    cta: 'Check my resume',
  },
].map((t) => ({ ...t, url: url(`/learn/tools/${t.key}/`) }));

export const guides = [
  { ...post('wage-guide-atlantic-canada-2026'), who: 'For employers and job seekers', d: 'Entry-level to top-of-market hourly rates, by industry and role.' },
  { ...post('why-new-brunswick-a-practical-guide-for-canadians-considering-a-move'), who: 'For job seekers', d: 'Jobs, cities and what your salary is worth there.' },
].filter((g) => g.url);
