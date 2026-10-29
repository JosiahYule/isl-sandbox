// INTEGRATED STAFFING: the facts and words this brand's site is built from.
// One file per brand (isl.js, as.js, ads.js). The pages and components are shared; they read
// whichever brand is being built (src/brands/index.js). Change a phone number, address or
// stat here and every page of this brand's site updates.

const cdn = 'https://images.squarespace-cdn.com/content/v1/691490c94119776708e69bbe';

export const brand = {
  key: 'isl',
  name: 'Integrated Staffing',
  short: 'ISL',
  wordmark: ['Integrated', 'Staffing'], // shown only if the logo image fails to load
  tagline: 'Employment solutions on demand.',
  since: 2013,
  // One positioning line, used everywhere scope is mentioned.
  scope: 'Offices across Atlantic Canada. Permanent search nationwide.',
  titleTail: 'Contract and permanent staffing in Atlantic Canada', // the homepage's browser-tab title
  logo: `${cdn}/b4aaffd0-9d0e-4194-8851-2293b7d65d88/Integrated+Staffing+Full+Logo+-+Vector+File.png?format=750w`,
  footerLogoHeight: 52, // the footer's logo, a bit larger than the 40px default
  favicon: '/favicon.svg',
  siteUrl: 'https://www.integratedstaffing.ca',
  email: 'info@integratedstaffing.ca',
  mainPhone: '902-423-1919',
  loginUrl: 'https://integratedstaffing.myavionte.com/satellite/login?buildId=gye6ARhjPvM&appId=BOLD',
  // Colours: ISL blue is the default in src/styles/tokens.css, so nothing to override here
  colors: null,
  assistant: true,   // the job assistant chat
  officePages: true, // a page for each office (/offices/halifax/ ...)
};

// The two services, named the way this brand names them. Pages, job rows and the form use these.
// `contract` is near-black in the colour key, `direct` the brand colour.
export const services = {
  contract: { name: 'Contract staffing', href: '/contract/', jobLabel: 'Contract', ask: 'Contract workers', askMeta: 'For a set time, on site within hours' },
  direct: { name: 'Direct hire', href: '/direct-hire/', jobLabel: 'Permanent', ask: 'A permanent hire', askMeta: 'A targeted search with a 90-day guarantee' },
};

// Links that leave the site
export const links = {
  resume: 'https://www.integratedstaffing.ca/careers/general-apply', // "Send your resume"
  referral: '/referrals/', // the referral form (src/sites/isl/referrals.astro)
};

export const images = {
  hero: `${cdn}/0ef24270-c545-4732-a37c-05b7a7b05030/Isl-home-banner?format=2500w`,
  badgeBestPlaces: `${cdn}/35d4c867-0e4b-4e07-867d-d9fd4027d1b2/best-work-48.png?format=500w`,
  badgeCor: `${cdn}/a402f9b4-6815-4761-8089-00eb38a68d74/cor-logo-54-2.png?format=500w`,
};

// Main navigation. Order here = order in the menu.
export const nav = [
  // Each service has its own page; the "Request talent" button in the header goes to the /hire/ form.
  { label: 'Contract staffing', href: '/contract/' },
  { label: 'Direct hire', href: '/direct-hire/' },
  { label: 'Find work', href: '/find-work/' },
  { label: 'About', href: '/about/' },
  { label: 'Team', href: '/team/' },
  { label: 'Learn', href: '/learn/' },
  { label: 'Contact', href: '/contact/' },
];

export const offices = [
  { city: 'Halifax', province: 'NS', phone: '902-423-1919', address: '99 Wyse Road, Suite 1320, Dartmouth, NS B3A 4S5' },
  // TODO: confirm the current Moncton address. The live site shows both
  // 814 Main St, Suite 200 and 33 Weldon St, Suite 360-A.
  { city: 'Moncton', province: 'NB', phone: '506-801-1446', address: '814 Main St, Suite 200, Moncton, NB E1C 1E6' },
  { city: 'Saint John', province: 'NB', phone: '506-717-0607', address: '400 Main Street, Suite 2004, Saint John, NB E2K 4N5' },
  { city: 'Charlottetown', province: 'PE', phone: '902-201-4400', address: '9 Jordan Cres, Charlottetown, PE C1A 2W2' },
  { city: "St. John's", province: 'NL', phone: '709-800-2454', address: "120 Torbay Rd, Suite E115, St. John's, NL A1A 2G8" },
];

// TODO: confirm these. The live site quotes 92% and 88% retention, 200+ and 150+ reviews.
export const stats = [
  { value: '200+', label: 'five-star Google reviews' },
  { value: '92%', label: 'retention on direct hire placements' },
  { value: '47', label: 'day average time to fill (direct hire)' },
  { value: `${new Date().getFullYear() - 2013}+`, label: 'years placing people in Atlantic Canada' },
];

export const testimonials = [
  {
    quote: "Integrated Staffing's team was professional, responsive, and quickly demonstrated a strong understanding of our needs. Their partnership approach made the process seamless. They truly felt like an extension of our team.",
    who: 'Vice President, Investment Firm',
  },
  {
    quote: 'Their recruiters actually listened to our needs. The shortlist reflected our culture and long-term goals.',
    who: 'HR Director, Logistics Company',
  },
  {
    quote: "We've worked with Integrated Staffing for years. Their direct hire service has been a natural extension of our partnership.",
    who: 'General Manager, Construction Services',
  },
];

// Analytics: paste the Google Analytics 4 measurement ID here (e.g. 'G-XXXXXXX') to switch on
// analytics and the consent banner (src/components/Analytics.astro). Empty = off, no cookies.
export const analytics = { ga4: '' };

// Forms: the deployed isl-request function's URL (assistant/supabase/functions/isl-request).
// Empty = the request form shows its confirmation but sends nothing (the sandbox preview).
// requestEndpoint: the request form's sending function. referralEndpoint: where the referral form posts
// (a Formspree form address, https://formspree.io/f/<id>, or any endpoint that takes JSON). Empty: preview only.
export const forms = { requestEndpoint: '', referralEndpoint: '' };

// The request form (/hire/)
export const hire = {
  lead: 'Contract workers and permanent hires, anywhere in Canada. A recruiter replies within one business day.',
  locations: ['Nova Scotia', 'New Brunswick', 'Prince Edward Island', 'Newfoundland and Labrador', 'Elsewhere in Canada'],
  routing: 'people', // the card names the recruiter, from assistant/.../routing.js
};

// The dark band that closes most pages
export const cta = {
  text: 'Contract workers or a permanent hire. A recruiter replies within one business day.',
  faces: true, // the faces of the people who answer requests
};

// The Learn tools: which this brand has, and the words around them
export const tools = {
  list: ['jobs-report', 'true-cost-of-an-employee', 'pay-on-open-jobs', 'resume-check'], // no Job ad check: it coaches employers to do our job
  cost: {
    wage: 20, // the calculator's starting wage, and the tool card's example
    title: 'One rate covers all of it.',
    text: 'With contract staffing, the worker is on our payroll. Wages, CPP, EI, workers’ comp, vacation pay and recruiting are in one hourly rate.',
    details: 'Contract worker', // pre-fills the request form: "Contract worker at about $20.00/hour, ..."
  },
  ad: {
    text: 'We write the ad, post it, screen everyone who applies and send you the people worth meeting.',
    label: 'Request workers',
    // A weak example, so a visitor can see what the tool does before pasting their own
    sample: `WAREHOUSE ROCKSTAR WANTED!!!

We are a fast-paced environment looking for a young, energetic self-starter to join our family. Competitive pay.

Must have 3 years experience
Must have forklift ticket
Must have WHMIS
Must be able to lift 50 lbs
Must have own vehicle
Must have Canadian experience
Must be available evenings
Other duties as assigned.

Send your resume to jobs@example.ca`,
  },
};

// The job board's footnote

export const social = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/integratedstaffing' },
  { label: 'Facebook', href: 'https://www.facebook.com/integratedstaffing' },
  { label: 'Instagram', href: 'https://www.instagram.com/integrated.staffing/' },
];
