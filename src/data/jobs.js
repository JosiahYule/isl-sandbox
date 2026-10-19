// REAL JOBS: a snapshot of ISL's Avionte feed taken on October 19, 2026
// (the same 53 postings the job assistant demo uses). View and Apply link to the live site.
// Later, the live site would read the feed directly instead of this snapshot.
//
// Avionte's job types fall into the site's two services:
//   Permanent                         -> 'direct'   (ISL blue)
//   Temporary / contract, Temp to perm -> 'contract' (near-black)
import snapshot from './jobs-snapshot.json';
import { areaFor } from './areas.js';

export const snapshotDate = 'October 19, 2026';

export const jobs = snapshot.map((j) => ({
  ...j,
  area: areaFor(j.city),
  type: j.employment === 'Permanent' ? 'direct' : 'contract',
  typeLabel: j.employment === 'Permanent' ? 'Permanent' : j.employment === 'Temp to perm' ? 'Temp to perm' : 'Contract',
}));

export const provinces = {
  NS: 'Nova Scotia', NB: 'New Brunswick', PE: 'Prince Edward Island', NL: 'Newfoundland and Labrador',
  QC: 'Quebec', ON: 'Ontario', MB: 'Manitoba', SK: 'Saskatchewan', AB: 'Alberta', BC: 'British Columbia',
};
