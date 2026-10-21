// WHICH BRAND IS BEING BUILT
// One codebase makes three websites. The build is run once per brand (see astro.config.mjs):
//   npm run build            -> Integrated Staffing (the default)
//   BRAND=as npm run build   -> Accountant Staffing
//   BRAND=ads npm run build  -> Administrative Staffing
// astro.config.mjs turns BRAND into the constant __BRAND__, which every file can read.
// Pages and components import the brand's facts from src/data/site.js, which reads this file.
import * as isl from './isl.js';
import * as as from './as.js';
import * as ads from './ads.js';

/* global __BRAND__ */
export const BRAND = typeof __BRAND__ !== 'undefined' ? __BRAND__ : 'isl';
export const brands = { isl, as, ads };
export const current = brands[BRAND] ?? isl;
