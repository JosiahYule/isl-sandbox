// ACCOUNTANT STAFFING: the facts and words this brand's site is built from.
// What it shares with Administrative Staffing (offices, terms, process) is in specialist.js.
import { url } from '../lib/url.js';
import { stock } from '../data/photos.js';
import * as shared from './specialist.js';

export const brand = {
  key: 'as',
  name: 'Accountant Staffing',
  short: 'AS',
  wordmark: ['Accountant', 'Staffing'],
  tagline: 'Atlantic Canada’s accounting and finance recruitment specialists.',
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
  loginUrl: '',
  // From the logo: its cyan (#009cd8) is too light for text and buttons on white (3.1:1),
  // so the accent is the same hue made deeper (5.2:1, like ISL blue's 5.0:1). The logo cyan
  // itself is used on dark backgrounds, where it reads well.
  colors: { accent: '#0074a8', deep: '#005c87', tint: '#e5f3fa', onDark: '#1fb0e6' },
  assistant: false,  // the job assistant comes later for AS and ADS
  officePages: false,
};

// The field, and the roles placed in it at each level (from the live Employers and Job Seekers pages)
export const field = {
  short: 'accounting and finance',
  people: 'accounting and finance professionals',
  peak: 'Year end, audits, tax season and other busy stretches.', // Temporary staffing: what a peak period means in this field
  heroLines: ['Accounting and finance.', 'Nothing else.'],
  heroLead: 'Atlantic Canada’s only recruitment firm that places accounting and finance professionals, from clerk to CFO. Locally owned since 2002.',
  roll: ['accounting clerks', 'payroll specialists', 'bookkeepers', 'financial analysts', 'controllers', 'CFOs'],
  levels: [
    { name: 'Junior', roles: ['Accounting clerk', 'Junior accountant', 'Accounting technician', 'AP / AR specialist', 'Payroll clerk', 'Tax clerk', 'Data entry clerk'] },
    { name: 'Intermediate', roles: ['General accountant', 'Property accountant', 'Bookkeeper', 'Office manager', 'Financial or budget analyst', 'AR / AP supervisor', 'Payroll specialist', 'Procurement manager'] },
    { name: 'Senior', roles: ['CFO', 'VP Finance', 'Director of Finance', 'Controller', 'Accounting manager', 'Assistant controller', 'Senior accountant', 'Senior financial analyst', 'Internal auditor', 'Financial reporting officer'] },
  ],
  // The test registered candidates take. CPAs have their designation verified instead.
  testShort: 'Every candidate is tested at their level; CPAs have their designation verified.',
  testing: 'An accounting test at the right level for every registered candidate. Fully designated CPAs have their designation verified instead.',
  aboutTitle: 'The only financial recruitment specialists in Atlantic Canada.',
  history: [
    ['2002', 'Founded in Halifax to place accounting and finance professionals.'],
    ['2006', 'Administrative Staffing added, for general office hiring.'],
    ['Today', 'Offices in Halifax, Moncton and St. John’s, placing people across Atlantic Canada.'],
  ],
};

export const images = {
  hero: { ...stock.interview, position: 'center 40%' }, // TODO: AS's own photography
};

export const links = {
  resume: shared.applyPortal,
  referral: '',
  sister: { name: 'Administrative Staffing', href: 'https://www.administrativestaffing.ca', what: 'office and administrative roles' },
};

export const jobsNote = (date) => `Sandbox preview: a sample of Accountant Staffing postings from ${date}. The live board will read Tracker RMS.`;

export const social = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/accountant-staffing' },
  { label: 'Facebook', href: 'https://www.facebook.com/AccountantStaffing/' },
  { label: 'Instagram', href: 'https://www.instagram.com/accountantstaffing' },
];

export const { offices, provinceOffice, nav, services, terms, sourcing, seekerSteps, seekerFaq, analytics, forms, stats, testimonials } = shared;
export const hire = { ...shared.hire, lead: 'Accounting and finance roles, temporary or permanent, junior to senior. No fee unless you hire.' };
export const cta = shared.cta;
