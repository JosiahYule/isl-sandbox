// ADMINISTRATIVE STAFFING: the facts and words this brand's site is built from.
// What it shares with Accountant Staffing (offices, terms, process) is in specialist.js.
import { url } from '../lib/url.js';
import { stock } from '../data/photos.js';
import * as shared from './specialist.js';

export const brand = {
  key: 'ads',
  name: 'Administrative Staffing',
  short: 'ADS',
  wordmark: ['Administrative', 'Staffing'],
  tagline: 'Atlantic Canada’s specialist recruiter for administrative professionals.',
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
  email: '',
  resumeEmail: '',
  mainPhone: '902-491-1301',
  loginUrl: '',
  // From the logo: its orange (#f08418) reads well on dark backgrounds but is too light for
  // text and buttons on white (2.6:1), so the accent is the same orange made deeper (5.1:1).
  // The map uses the logo's navy: a whole map in orange is too loud.
  colors: { accent: '#b84f00', deep: '#933f00', tint: '#fbeee4', onDark: '#f08418', map: '#1b3169' },
  logoHeight: 46, // the wordmark is small inside this logo, so it's shown a little taller than ISL's
  assistant: false,
  officePages: false,
};

// The roles placed at each level (from the live Job Seekers page; the live homepage lists
// accounting roles by mistake, so it isn't used here)
export const field = {
  short: 'administrative',
  people: 'administrative professionals',
  peak: 'Busy seasons, office moves and other short stretches of extra work.', // Temporary staffing: what a peak period means in this field
  heroLines: ['Office and administrative.', 'Nothing else.'],
  heroLead: 'Specialist recruitment for office and administrative roles across Atlantic Canada, from reception to executive assistant. Part of Accountant Staffing since 2006.',
  roll: ['receptionists', 'administrative coordinators', 'HR assistants', 'paralegals', 'executive assistants', 'office managers'],
  levels: [
    { name: 'Junior', roles: ['Reception', 'Administrative support', 'Data entry', 'File clerk', 'Records clerk'] },
    { name: 'Intermediate', roles: ['Administrative coordinator', 'Human resources assistant', 'Marketing assistant', 'Project administrator', 'Legal administrator', 'Paralegal'] },
    { name: 'Senior', roles: ['Executive assistant', 'Office manager', 'Donor relations officer', 'Project coordinator'] },
  ],
  testShort: 'Every candidate has already been skills-tested.',
  testing: 'Skills testing for every registered candidate, plus their software experience.',
  aboutTitle: 'Administrative recruitment, from specialists.',
  history: [
    ['2002', 'Accountant Staffing founded in Halifax.'],
    ['2006', 'Administrative Staffing added, so clients have one place for all their office hiring.'],
    ['Today', 'Offices in Halifax, Moncton and St. John’s, placing people across Atlantic Canada.'],
  ],
};

export const images = {
  hero: { ...stock.halifax, position: 'center 55%' }, // TODO: ADS's own photography
};

export const links = {
  resume: shared.applyPortal,
  referral: '',
  sister: { name: 'Accountant Staffing', href: 'https://www.accountantstaffing.ca', what: 'accounting and finance roles' },
};

export const jobsNote = (date) => `Sandbox preview: a sample of Administrative Staffing postings from ${date}. The live board will read Tracker RMS.`;

export const social = []; // TODO: ADS's social profiles

export const { offices, provinceOffice, nav, services, terms, sourcing, seekerSteps, seekerFaq, analytics, forms, stats, testimonials } = shared;
export const hire = { ...shared.hire, lead: 'Office and administrative roles, temporary or permanent, junior to senior. No fee unless you hire.' };
export const cta = shared.cta;
