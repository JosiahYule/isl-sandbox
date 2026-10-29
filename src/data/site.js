// THE BRAND'S FACTS, for whichever brand is being built.
// The facts themselves live in src/brands/ (isl.js, as.js, ads.js). Pages import from here,
// so one page file can serve all three brands.
import { current, BRAND } from '../brands/index.js';

export { BRAND };
export const brand = current.brand;
export const nav = current.nav;
export const offices = current.offices;
export const services = current.services;
export const links = current.links;
export const images = current.images;
export const stats = current.stats ?? [];
export const testimonials = current.testimonials ?? [];
export const social = current.social ?? [];
// Public deployment settings can be supplied per brand without editing source or sharing secrets.
const ga4 = { isl: import.meta.env.PUBLIC_ISL_GA4_ID, as: import.meta.env.PUBLIC_AS_GA4_ID, ads: import.meta.env.PUBLIC_ADS_GA4_ID };
const endpoints = { isl: import.meta.env.PUBLIC_ISL_REQUEST_ENDPOINT, as: import.meta.env.PUBLIC_AS_REQUEST_ENDPOINT, ads: import.meta.env.PUBLIC_ADS_REQUEST_ENDPOINT };
export const analytics = { ...current.analytics, ga4: ga4[BRAND] || current.analytics?.ga4 || '' };
export const forms = { ...current.forms, requestEndpoint: endpoints[BRAND] || current.forms?.requestEndpoint || '', referralEndpoint: (BRAND === 'isl' && import.meta.env.PUBLIC_ISL_REFERRAL_ENDPOINT) || current.forms?.referralEndpoint || '' };
export const hire = current.hire;
export const cta = current.cta;
export const tools = current.tools;
// Specialist brands only (AS, ADS); null for ISL
export const field = current.field ?? null;
export const terms = current.terms ?? null;
export const sourcing = current.sourcing ?? null;
export const copy = current.copy ?? null; // the words on each page (src/brands/copy/)
export const provinceOffice = current.provinceOffice ?? null;
