// AREAS: the towns each office covers, for "Jobs near ..." links.
// A job counts as near an office when its city is in that office's list.
// Towns not listed (Bridgewater, Summerside, etc.) still show under their province and in "All".
// TODO: confirm with each office which towns they treat as their area.

import { offices } from './site.js';

const allAreas = [
  { key: 'halifax', label: 'Halifax', province: 'NS',
    towns: ['halifax', 'dartmouth', 'bedford', 'sackville', 'lower sackville', 'burnside', 'cole harbour', 'timberlea', 'goffs', 'prospect bay', 'fall river', 'enfield', 'hammonds plains'] },
  { key: 'moncton', label: 'Moncton', province: 'NB',
    towns: ['moncton', 'dieppe', 'riverview', 'shediac', 'scoudouc'] },
  { key: 'saint-john', label: 'Saint John', province: 'NB',
    towns: ['saint john', 'quispamsis', 'rothesay', 'grand bay-westfield'] },
  { key: 'charlottetown', label: 'Charlottetown', province: 'PE',
    towns: ['charlottetown', 'stratford', 'cornwall', 'alexandra'] },
  { key: 'st-johns', label: "St. John's", province: 'NL',
    towns: ["st. john's", 'mount pearl', 'paradise', 'conception bay south', 'torbay', 'portugal cove'] },
];

// Only the areas of the brand's own offices (ISL has five; AS and ADS share three)
export const areas = allAreas.filter((a) => offices.some((o) => o.city === a.label));

// Which area a job's city falls in ('' when none)
export function areaFor(city = '') {
  const c = city.trim().toLowerCase();
  return areas.find((a) => a.towns.includes(c))?.key ?? '';
}
