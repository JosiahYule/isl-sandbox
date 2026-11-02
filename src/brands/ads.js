// ADMINISTRATIVE STAFFING: the facts and words this brand's site is built from.
// What it shares with Accountant Staffing (offices, terms, process) is in specialist.js.
import { url } from '../lib/url.js';
import * as shared from './specialist.js';
import { copy } from './copy/ads.js';

export const brand = {
  key: 'ads',
  name: 'Administrative Staffing',
  short: 'ADS',
  wordmark: ['Administrative', 'Staffing'],
  tagline: 'Atlantic Canada’s specialist recruitment firm for administrative professionals.',
  since: 2006,
  scope: 'Office and administrative recruitment across Atlantic Canada.',
  titleTail: 'Office and administrative recruitment in Atlantic Canada',
  // Stand-in: the small preview inside the .ai file (the file itself arrived damaged).
  // TODO: replace with an SVG or large PNG export of the logo.
  logo: url('/brands/ads-logo.png'),
  logoWhite: url('/brands/ads-logo-white.png'), // for the dark footer
  logoSize: [256, 86],
  favicon: '/brands/ads-favicon.svg',
  siteUrl: 'https://www.administrativestaffing.ca',
  email: 'info@accountantstaffing.com', // the address the live privacy policy gives (read October 30, 2026)
  resumeEmail: '',
  mainPhone: '902-491-1301',
  footerAbout: 'Atlantic Canada’s specialist recruitment firm for administrative professionals. Locally owned and operated.',
  loginUrl: '',
  // Colours from administrativestaffing.ca's own stylesheet (its Squarespace palette):
  //   orange     hsl(29 87% 54%)  #f08624  section backgrounds, button text
  //   navy       hsl(224 54% 28%) #21356e  links, buttons, headings
  //   dark navy  hsl(224 53% 14%) #111b37
  // The same restrained scheme as AS (see src/brands/as.js): navy and cool neutrals, ADS's own blue
  // (a lighter royal blue from its navy, 6.2:1 on white) as the one accent, and orange only as the
  // small temporary marks. The closing band is navy, as on ISL.
  colors: {
    accent: '#21356e', 'accent-deep': '#152452', 'accent-tint': '#eaeff8', 'accent-on-dark': '#8fb0e8',
    direct: '#2f5fb3', 'map-land': '#2f5fb3', 'photo-btn': '#2f5fb3', 'photo-btn-deep': '#244b92',
    contract: '#d06a1f', 'contract-on-dark': '#f08624',
    dark: '#111b37', 'dark-raised': '#1b2950', 'line-dark': '#2a3866', 'on-dark-soft': '#b9c0d4', // the hero photo's wash is ISL's near-black (tokens.css), on all three sites
    ink: '#111b37', 'line-strong': '#111b37', 'ink-soft': '#585e6e',
    mist: '#f3f5f9', 'mist-deep': '#e7ebf3',
  },
  logoHeight: 55, // the wordmark is small inside this logo, so it's shown a little taller than ISL's
  assistant: false, // the job assistant chat: PAUSED (see src/brands/isl.js)
  officePages: false,
};

// The roles placed at each level (from the live Job Seekers page; the live homepage lists
// accounting roles by mistake, so it isn't used here)
export const field = {
  short: 'administrative',     // "permanent administrative recruitment"
  people: 'administrative professionals',
  levels: copy.levels, // the roles at each level, from the live site (src/brands/copy/ads.js)
};

export const images = {
  // The live homepage's own hero photo (administrativestaffing.ca, read November 2, 2026), framed the same way
  hero: { src: 'https://images.squarespace-cdn.com/content/v1/698340e14c39497eab947c09/a4137e47-6b79-47d0-b899-a4a4fe05a98e/ADS-banner-home.jpg', position: '68% 26%' },
};

export const links = {
  resume: shared.applyPortal,
  referral: '',
  sister: { name: 'Accountant Staffing', href: 'https://www.accountantstaffing.ca', what: 'accounting and finance roles' },
};


export const social = []; // TODO: ADS's social profiles

export { copy };
export const { offices, provinceOffice, nav, services, terms, sourcing, analytics, forms, stats, testimonials } = shared;
export const hire = { ...shared.hire, lead: 'Office and administrative roles, temporary or permanent, junior to senior. No fee unless you hire.' };
export const cta = shared.cta;
export const tools = {
  ...shared.toolsBase,
  cost: { ...shared.toolsBase.cost, wage: 22 }, // the calculator's starting wage, and the tool card's example
  ad: { ...shared.toolsBase.ad, sample: `OFFICE SUPERSTAR WANTED!!!

Busy office looking for a young, energetic self-starter to be the face of our company. Competitive pay.

Must have 3 years experience
Must type 60 wpm
Must know Microsoft Office
Must have Canadian experience
Must be bubbly and outgoing
Must have own vehicle
Other duties as assigned.

Send your resume to jobs@example.ca` },
};
