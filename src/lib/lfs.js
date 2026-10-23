// THE LABOUR FORCE SURVEY, READY TO SHOW
// Reads src/data/lfs/latest.json (written each month by scripts/fetch-lfs.mjs on GitHub) and
// works out the figures the Atlantic jobs report page and its tool card use.
// If the file isn't there yet, `lfs` is null and the page says the first report is on its way.
//
// Every series is a list of { month: '2026-09', value } with the newest month last.
// Rates are percentages; employment is in thousands of people; wages are dollars an hour.

// import.meta.glob returns {} when the file is missing, so the site still builds without it
const files = import.meta.glob('../data/lfs/latest.json', { eager: true, import: 'default' });
export const lfs = Object.values(files)[0] ?? null;

export * from './lfs-math.js';
import { GEOS, SHORT, monthName, at } from './lfs-math.js';

// The four provinces' unemployment rates for the tool card, highest first
export function cardFigures() {
  if (!lfs) return null;
  return {
    month: monthName(lfs.month),
    rows: [...GEOS, 'CA'].map((g) => ({ g, name: SHORT[g], v: at(lfs.provinces[g]?.unemploymentRate, lfs.month) })).filter((r) => r.v != null),
  };
}
