// ACCOUNTANT STAFFING: the facts and words this brand's site is built from.
// What it shares with Administrative Staffing (offices, terms, process) is in specialist.js.
import { url } from '../lib/url.js';
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
  email: 'info@accountantstaffing.com', // the address the live privacy policy gives (read October 30, 2026)
  resumeEmail: 'apply@accountantstaffing.com',
  mainPhone: '902-491-1301',
  footerAbout: 'Atlantic Canada’s specialist recruitment firm for accounting and finance professionals. Locally owned and operated.', // the live footer, word for word
  loginUrl: '',
  // Colours from accountantstaffing.ca's own stylesheet (its Squarespace palette):
  //   navy   hsl(215 69% 19%) #0f2b52  links, buttons, headings
  //   blue   hsl(201 63% 55%) #44a2d5  borders and highlights
  //   orange hsl(23 65% 54%)  #d6783d  the logo's single dot
  // AS and ADS share one restrained scheme (November 2026): navy and cool neutrals carry the page,
  // the brand's blue is the one accent, and orange appears only as a small mark for temporary work
  // (a card's top edge, the square beside a contract job), the way the logo uses its one orange dot.
  //   navy    buttons, links, text, the dark sections and the closing band
  //   blue    permanent work, the big figures, the maps, the hero's search button; #1d78ae on white (4.8:1)
  //   orange  the temporary marks only, never text or a background
  //   mist    cool grey-blue panels, so blue never sits on a warm cream
  colors: {
    accent: '#0f2b52', 'accent-deep': '#081a33', 'accent-tint': '#e8f2f9', 'accent-on-dark': '#44a2d5',
    direct: '#1d78ae', 'map-land': '#44a2d5', 'photo-btn': '#1d78ae', 'photo-btn-deep': '#16618d',
    contract: '#c96a2e', 'contract-on-dark': '#e8853f',
    dark: '#0f2b52', 'dark-raised': '#173a66', 'line-dark': '#2a4670', 'on-dark-soft': '#b8c4d6', // the hero photo's wash is ISL's near-black (tokens.css), on all three sites
    ink: '#14233a', 'line-strong': '#14233a', 'ink-soft': '#556070',
    mist: '#f2f6fa', 'mist-deep': '#e5edf5',
  },
  assistant: false, // the job assistant chat: PAUSED (see src/brands/isl.js)
  officePages: false,
};

// The field, and the roles placed in it at each level (from the live Employers and Job Seekers pages)
export const field = {
  short: 'accounting and finance',     // "permanent accounting and finance recruitment"
  people: 'accounting and finance professionals',
  levels: copy.levels, // the roles at each level, from the live site (src/brands/copy/as.js)
};

export const images = {
  // The live homepage's own hero photo (accountantstaffing.ca, read November 2, 2026), framed the same way
  hero: { src: 'https://images.squarespace-cdn.com/content/v1/69777a61171eae1f3b4946ce/f04bdf57-5a8e-4344-9ffe-b445f1aacab4/as-banner-home2.jpg', position: '68% 56%' },
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
