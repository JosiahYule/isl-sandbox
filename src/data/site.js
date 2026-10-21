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
export const analytics = current.analytics;
export const forms = current.forms;
export const hire = current.hire;
export const cta = current.cta;
export const jobsNote = current.jobsNote;
export const tools = current.tools;
// Specialist brands only (AS, ADS); null for ISL
export const field = current.field ?? null;
export const terms = current.terms ?? null;
export const sourcing = current.sourcing ?? null;
export const seekerSteps = current.seekerSteps ?? null;
export const seekerFaq = current.seekerFaq ?? null;
export const provinceOffice = current.provinceOffice ?? null;
