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

// Permanent first: it's the bigger half of the specialist business, and the live sites lead with it
export const nav = [
  { label: 'Permanent recruitment', href: '/permanent/' },
  { label: 'Temporary staffing', href: '/temporary/' },
  { label: 'Find work', href: '/find-work/' },
  { label: 'About', href: '/about/' },
  { label: 'Team', href: '/team/' },
  { label: 'Contact', href: '/contact/' },
];

export const services = {
  contract: { name: 'Temporary staffing', href: '/temporary/', jobLabel: 'Temporary', ask: 'A temporary contractor', askMeta: 'Pre-screened, on short notice' },
  direct: { name: 'Permanent recruitment', href: '/permanent/', jobLabel: 'Permanent', ask: 'A permanent hire', askMeta: 'A full search with a six-month guarantee' },
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

// Registering as a candidate (Job Seekers page), and the questions candidates ask most
export const seekerSteps = [
  ['Send your resume', 'Apply to a posting, or send it in for roles that haven’t been posted yet.'],
  ['Meet a consultant', 'If your background fits our openings, we talk through your goals and the way you like to work.'],
  ['A short skills test', 'About 30 minutes, online. We also take references and your salary expectations.'],
  ['We call when it fits', 'Your resume stays on file, and goes to an employer only with your OK.'],
];
export const seekerFaq = [
  ['Does it cost anything?', 'No. Employers pay all our fees.'],
  ['Is my search confidential?', 'Yes. We never share your resume with an employer without your approval.'],
  ['Why take a contract?', 'It builds experience and contacts, moves faster than a permanent search, and lets you try a company. About 1 in 4 of our contracts become permanent.'],
];

export const hire = {
  locations: ['Nova Scotia', 'New Brunswick', 'Prince Edward Island', 'Newfoundland and Labrador', 'Elsewhere'],
  routing: 'office', // the card names the office that covers the province
};

export const cta = {
  text: 'Permanent or temporary, junior to senior. You pay nothing unless you hire.',
  faces: false,
};

// The Tracker RMS candidate portal both brands share
export const applyPortal = 'https://evoportalus.tracker-rms.com/AccountingStaffingAndAdministrativeStaffing/apply';

export const analytics = { ga4: '' };
export const forms = { requestEndpoint: '' };
export const stats = [];
export const testimonials = []; // TODO: client quotes for each brand (none on the live sites)
