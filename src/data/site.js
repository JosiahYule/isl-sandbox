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
// A figure by its key (src/brands/isl.js), and whether this build may show it. Unconfirmed figures
// show in the sandbox only (marked with <Unconfirmed />), never on a live or Squarespace site.
const LIVE_BUILD = typeof __LIVE__ !== 'undefined' && __LIVE__;
export const stat = (key) => stats.find((s) => s.key === key);
export const showFigure = (s) => !!s && (s.confirmed !== false || !LIVE_BUILD);
export const testimonials = current.testimonials ?? [];
export const reviews = current.reviews ?? null; // Google reviews (ISL; see Reviews.astro)
export const social = current.social ?? [];
// Public deployment settings can be supplied per brand without editing source or sharing secrets.
const ga4 = { isl: import.meta.env.PUBLIC_ISL_GA4_ID, as: import.meta.env.PUBLIC_AS_GA4_ID, ads: import.meta.env.PUBLIC_ADS_GA4_ID };
const endpoints = { isl: import.meta.env.PUBLIC_ISL_REQUEST_ENDPOINT, as: import.meta.env.PUBLIC_AS_REQUEST_ENDPOINT, ads: import.meta.env.PUBLIC_ADS_REQUEST_ENDPOINT };
export const analytics = { ...current.analytics, ga4: ga4[BRAND] || current.analytics?.ga4 || '' };
export const forms = { ...current.forms, requestEndpoint: endpoints[BRAND] || current.forms?.requestEndpoint || '', referralEndpoint: (BRAND === 'isl' && import.meta.env.PUBLIC_ISL_REFERRAL_ENDPOINT) || current.forms?.referralEndpoint || '',
  // The chat's job alerts (ISL only: its job feed is live) and its log of messages it couldn't understand (all three brands)
  alertsEndpoint: (BRAND === 'isl' && import.meta.env.PUBLIC_ISL_ALERTS_ENDPOINT) || current.forms?.alertsEndpoint || '',
  chatMissEndpoint: import.meta.env.PUBLIC_CHAT_MISS_ENDPOINT || current.forms?.chatMissEndpoint || '',
  // Cloudflare Turnstile's site key (public): the request form then asks Cloudflare whether the sender is a
  // person, and the request function checks the answer (TURNSTILE_SECRET). Empty = off.
  turnstileSiteKey: import.meta.env.PUBLIC_TURNSTILE_SITE_KEY || current.forms?.turnstileSiteKey || '' };
export const hire = current.hire;
export const cta = current.cta;
export const tools = current.tools;
// Specialist brands only (AS, ADS); null for ISL
export const field = current.field ?? null;
export const terms = current.terms ?? null;
export const sourcing = current.sourcing ?? null;
export const copy = current.copy ?? null; // the words on each page (src/brands/copy/)
export const provinceOffice = current.provinceOffice ?? null;
