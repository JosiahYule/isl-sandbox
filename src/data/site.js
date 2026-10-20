// ONE SOURCE OF TRUTH for facts that appear on many pages.
// Change a phone number, address or stat here and every page that uses it updates.
// This is the fix for the live site's problem of the same fact drifting page to page.

const cdn = 'https://images.squarespace-cdn.com/content/v1/691490c94119776708e69bbe';

export const brand = {
  name: 'Integrated Staffing',
  tagline: 'Employment solutions on demand.',
  since: 2013,
  // One positioning line, used everywhere scope is mentioned.
  scope: 'Offices across Atlantic Canada. Permanent search nationwide.',
  logo: `${cdn}/b4aaffd0-9d0e-4194-8851-2293b7d65d88/Integrated+Staffing+Full+Logo+-+Vector+File.png?format=750w`,
  email: 'info@integratedstaffing.ca',
  mainPhone: '902-423-1919',
  loginUrl: 'https://integratedstaffing.myavionte.com/satellite/login?buildId=gye6ARhjPvM&appId=BOLD',
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
export const forms = { requestEndpoint: '' };

export const social = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/integratedstaffing' },
  { label: 'Facebook', href: 'https://www.facebook.com/integratedstaffing' },
  { label: 'Instagram', href: 'https://www.instagram.com/integrated.staffing/' },
];
