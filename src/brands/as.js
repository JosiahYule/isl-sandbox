// ACCOUNTANT STAFFING: the facts and words this brand's site is built from.
// What it shares with Administrative Staffing (offices, terms, process) is in specialist.js.
import { url } from '../lib/url.js';
import { stock } from '../data/photos.js';
import * as shared from './specialist.js';
import { copy } from './copy/as.js';

export const brand = {
  key: 'as',
  name: 'Accountant Staffing',
  short: 'AS',
  wordmark: ['Accountant', 'Staffing'],
  tagline: 'Atlantic Canada’s specialist recruitment firm for accounting and finance professionals.', // the live footer
  since: 2002,
  scope: 'Accounting and finance recruitment across Atlantic Canada.',
  titleTail: 'Accounting and finance recruitment in Atlantic Canada',
  // Made from the logo Josiah sent (a 384px jpg, white made transparent). TODO: replace with an SVG export.
  logo: url('/brands/as-logo.png'),
  logoWhite: url('/brands/as-logo-white.png'), // for the dark footer
  logoSize: [361, 85],
  favicon: '/brands/as-favicon.svg',
  siteUrl: 'https://www.accountantstaffing.ca',
  email: '', // TODO: a general inquiries address, if there is one
  resumeEmail: 'apply@accountantstaffing.com',
  mainPhone: '902-491-1301',
  footerAbout: 'Atlantic Canada’s specialist recruitment firm for accounting and finance professionals. Locally owned and operated.', // the live footer, word for word
  loginUrl: '',
  // Colours from accountantstaffing.ca's own stylesheet (its Squarespace palette):
  //   navy   hsl(215 69% 19%) #0f2b52  links, buttons, headings
  //   blue   hsl(201 63% 55%) #44a2d5  borders and highlights
  //   orange hsl(23 65% 54%)  #d6783d  the logo's single dot
  // Navy does the work ISL's near-black and blue do: buttons, links and the dark sections.
  // Blue marks permanent work and the big figures; on white it's deepened to #1d78ae so text
  // passes contrast (4.8:1), and the site's own blue is used on navy, where it reads (5.0:1).
  colors: {
    accent: '#0f2b52', 'accent-deep': '#081a33', 'accent-tint': '#e6f1f9', 'accent-on-dark': '#44a2d5',
    direct: '#1d78ae', 'map-land': '#44a2d5',
    dark: '#0f2b52', 'dark-raised': '#173a66', 'line-dark': '#2a4670', 'on-dark-soft': '#b8c4d6', wash: 'rgb(9 26 50)',
    ink: '#14233a', 'line-strong': '#14233a', 'ink-soft': '#556070',
    mist: '#f1f6fa', 'mist-deep': '#e4edf5',
  },
  assistant: false,  // the job assistant comes later for AS and ADS
  officePages: false,
};

// The field, and the roles placed in it at each level (from the live Employers and Job Seekers pages)
export const field = {
  short: 'accounting and finance',     // "permanent accounting and finance recruitment"
  people: 'accounting and finance professionals',
  levels: copy.levels, // the roles at each level, from the live site (src/brands/copy/as.js)
};

export const images = {
  hero: { ...stock.interview, position: 'center 40%' }, // TODO: AS's own photography
};

export const links = {
  resume: shared.applyPortal,
  referral: '',
  sister: { name: 'Administrative Staffing', href: 'https://www.administrativestaffing.ca', what: 'office and administrative roles' },
};


export const social = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/accountant-staffing' },
  { label: 'Facebook', href: 'https://www.facebook.com/AccountantStaffing/' },
  { label: 'Instagram', href: 'https://www.instagram.com/accountantstaffing' },
];

export { copy };
export const { offices, provinceOffice, nav, services, terms, sourcing, analytics, forms, stats, testimonials } = shared;
export const hire = { ...shared.hire, lead: 'Accounting and finance roles, temporary or permanent, junior to senior. No fee unless you hire.' };
export const cta = shared.cta;
export const tools = {
  ...shared.toolsBase,
  cost: { ...shared.toolsBase.cost, wage: 30 }, // the calculator's starting wage, and the tool card's example
  ad: { ...shared.toolsBase.ad, sample: `ACCOUNTING ROCKSTAR WANTED!!!

We are a fast-paced, work hard play hard team looking for a young, energetic number cruncher to join our family. Competitive salary.

Must have CPA
Must have 5 years experience
Must have Canadian experience
Must be a team player
Must be detail oriented
Must be available for overtime at year end
Other duties as assigned.

Send your resume to jobs@example.ca` },
};
