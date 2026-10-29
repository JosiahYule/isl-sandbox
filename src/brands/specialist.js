// WHAT ACCOUNTANT STAFFING AND ADMINISTRATIVE STAFFING SHARE
// The two specialist brands run from the same three offices, on the same terms (contingency
// fees, a six-month guarantee, contractors on their payroll), so those facts live here once.
// as.js and ads.js add what's different: the name, colours, logo, the field and its roles.
//
// Source: accountantstaffing.ca and administrativestaffing.ca (About, Employers, Job Seekers,
// Permanent and Temporary Recruitment FAQ pages), read October 21, 2026.

// TODO: confirm the Moncton address. The specialist sites show both 814 Main St, Suite 200
// (most pages) and 33 Weldon St, Suite 360 (the job details page).
export const offices = [
  { city: 'Halifax', province: 'NS', phone: '902-491-1301', address: '99 Wyse Road, Suite 1320, Dartmouth, NS B3A 4S5' },
  { city: 'Moncton', province: 'NB', phone: '506-800-0074', address: '814 Main St, Suite 200, Moncton, NB E1C 1E6' },
  { city: "St. John's", province: 'NL', phone: '709-800-8818', address: "E115-120 Torbay Rd, St. John's, NL A1A 2G8" },
];

// Which office answers for each province (PEI has no office of its own; Halifax covers it)
export const provinceOffice = { NS: 'Halifax', PE: 'Halifax', NB: 'Moncton', NL: "St. John's" };

// The menu, as the live sites label it. Employers opens the two FAQ pages (Header.astro).
// The live pages' addresses are kept where the page exists here (/employers/, /job-seekers/,
// /permanent-recruitment/, /temporary-recruitment/), so old links keep working at launch.
// Old addresses (/job-opportunities, /our-team, /about-us, /contact-us) redirect to these: src/sites/specialist/redirects.txt.js
export const nav = [
  { label: 'Employers', href: '/employers/' },
  { label: 'Job seekers', href: '/job-seekers/' },
  { label: 'Job opportunities', href: '/find-work/' },
  { label: 'About us', href: '/about/' },
  { label: 'Our team', href: '/team/' },
  { label: 'Learn', href: '/learn/' },
  { label: 'Contact us', href: '/contact/' },
];

export const services = {
  contract: { name: 'Temporary recruitment', href: '/temporary-recruitment/', jobLabel: 'Temporary', ask: 'A temporary contractor', askMeta: 'Pre-screened, ready at a moment’s notice' },
  direct: { name: 'Permanent recruitment', href: '/permanent-recruitment/', jobLabel: 'Permanent', ask: 'A permanent hire', askMeta: 'A full search with a six-month guarantee' },
};

// The terms, as the live FAQ pages state them
export const terms = {
  guarantee: 'six-month',
  permanentFee: 'A one-time fee based on the hire’s first-year compensation.',
  temporaryRate: 'One hourly rate covers the contractor’s pay, employer EI and CPP, payroll and our fee.',
  tempToPerm: '1 in 4', // of contract assignments lead to a permanent hire (Job Seekers FAQ: "about 25%")
};

// Where candidates come from (Employers page)
export const sourcing = [
  ['Registered candidates', 'People we have already met, tested and checked.'],
  ['Professional networks', 'Industry contacts, associations and referrals from candidates we’ve placed.'],
  ['People coming home', 'Candidates moving to, or back to, Atlantic Canada.'],
  ['Targeted ads', 'Our sites, job boards, professional networks and social media.'],
];

export const hire = {
  locations: ['Nova Scotia', 'New Brunswick', 'Prince Edward Island', 'Newfoundland and Labrador', 'Elsewhere'],
  routing: 'office', // the card names the office that covers the province
};

export const cta = {
  title: 'We’d love to hear from you.', // the live sites' closing line
  text: 'Looking for your next opportunity or need staff support?',
  faces: false,
  candidateLink: true,
};

// The Learn tools both brands have (no pay tool: the sample jobs carry no pay yet)
export const toolsBase = {
  list: ['true-cost-of-an-employee', 'job-ad-check', 'resume-check'],
  cost: {
    title: 'One rate covers it.',
    text: 'With temporary staffing, the contractor is on our payroll. Their pay, employer EI and CPP, payroll and our fee are in one hourly rate.',
    details: 'Temporary contractor',
  },
  ad: {
    text: 'We run the search, test and interview the candidates, and send you a short list worth meeting.',
    label: 'Start a search',
  },
};

// The Tracker RMS candidate portal both brands share
export const applyPortal = 'https://evoportalus.tracker-rms.com/AccountingStaffingAndAdministrativeStaffing/apply';

export const analytics = { ga4: '' };
export const forms = { requestEndpoint: '' };
export const stats = [];
export const testimonials = []; // TODO: client quotes for each brand (none on the live sites)
