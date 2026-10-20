// REAL JOBS from ISL's Avionte feed.
// One file feeds both the website and the job assistant: assistant/data/jobs-snapshot.json.
// When the AVIONTE_FEED_URL secret is set in GitHub, scripts/fetch-jobs.mjs refreshes it from the
// live feed before every build (the deploy runs on a schedule, so the board stays current).
// Without it, the build uses the saved snapshot from October 19, 2026.
//
// Avionte's job types fall into the site's two services:
//   Permanent                         -> 'direct'   (ISL blue)
//   Temporary / contract, Temp to perm -> 'contract' (near-black)
//
// Each job gets its own page at /find-work/<slug>/. The slug is the title and city in words
// (readable, and good for search) plus the posting's ID (so two "Labourer, Halifax" postings
// never collide, and a job's address never changes while it's open).
import snapshot from '../../assistant/data/jobs-snapshot.json';
import meta from '../../assistant/data/jobs-meta.json';
import { areaFor } from './areas.js';
import { url } from '../lib/url.js';
import { jobSummary } from '../lib/jobtext.js';
import { industryOf } from './industries.js';

// When the jobs were last read from the feed, e.g. "October 19, 2026"
export const snapshotDate = new Date(meta.fetched).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Halifax' });

// Feed titles sometimes carry things that belong elsewhere: a year ("General Labourer 2025")
// or the town again ("Garbage Collector - Saint John"). Both come off for display.
function tidyTitle(title, city) {
  let t = title.replace(/\s*\/\s*/g, ' / ').trim();          // "Driver/ Labourer" -> "Driver / Labourer"
  t = t.replace(/\s+(19|20)\d{2}$/, '');                       // trailing year
  if (city) t = t.replace(new RegExp(`\\s*[-–]\\s*${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'), '');
  return t.trim();
}

// "$55 to $65,000/year": the low end was typed in thousands. Read it as $55,000.
function tidyPay(pay) {
  const m = String(pay || '').match(/^\$([\d,]+) to \$([\d,]+)\/year$/);
  if (!m) return pay;
  const lo = Number(m[1].replace(/,/g, '')), hi = Number(m[2].replace(/,/g, ''));
  return lo < 1000 && lo * 1000 <= hi ? `$${(lo * 1000).toLocaleString('en-CA')} to $${m[2]}/year` : pay;
}

const slugify = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/['’]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export const jobs = snapshot
  .map((j) => {
    // Leave the city out when the title already names it ("Garbage Collector Saint John")
    const city = slugify(j.title).includes(slugify(j.city)) ? '' : slugify(j.city);
    const slug = [slugify(j.title), city, slugify(j.id)].filter(Boolean).join('-');
    return {
      ...j,
      title: tidyTitle(j.title, j.city),
      pay: tidyPay(j.pay),
      slug,
      url: url(`/find-work/${slug}/`),
      area: areaFor(j.city),
      industry: industryOf(j.title), // '' when it's none of the six industry pages
      type: j.employment === 'Permanent' ? 'direct' : 'contract',
      typeLabel: j.employment === 'Permanent' ? 'Permanent' : j.employment === 'Temp to perm' ? 'Temp to perm' : 'Contract',
      snippet: jobSummary(j.description, j.title),
    };
  })
  // Newest first
  .sort((a, b) => (b.posted || '').localeCompare(a.posted || ''));

export const provinces = {
  NS: 'Nova Scotia', NB: 'New Brunswick', PE: 'Prince Edward Island', NL: 'Newfoundland and Labrador',
  QC: 'Quebec', ON: 'Ontario', MB: 'Manitoba', SK: 'Saskatchewan', AB: 'Alberta', BC: 'British Columbia',
};
