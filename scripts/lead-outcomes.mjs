// Safe by default: prints a validated, contact-free payload. --validate sends only to Google's
// validation endpoint; --send submits real recruiter-confirmed stages to GA4.
import { readFileSync } from 'node:fs';
import { leadOutcome } from '../src/lib/lead-outcome.js';

const file = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
if (!file) {
  console.error('Usage: node scripts/lead-outcomes.mjs outcomes.json [--validate | --send]');
  process.exit(1);
}
const input = JSON.parse(readFileSync(file, 'utf8'));
const records = Array.isArray(input) ? input : [input];
const seen = new Set();
const payloads = records.map((record) => {
  const key = record.lead_id + ':' + record.stage;
  if (seen.has(key)) throw new Error('Duplicate lead stage in input: ' + key);
  seen.add(key);
  return leadOutcome(record);
});
const send = process.argv.includes('--send'), validate = process.argv.includes('--validate');
if (send && validate) throw new Error('Choose --validate or --send.');
if (!send && !validate) console.log(JSON.stringify(payloads, null, 2));
else {
  const id = process.env.GA4_MEASUREMENT_ID || '';
  const secret = process.env.GA4_API_SECRET || '';
  if (!/^G-[A-Z0-9]+$/i.test(id) || !secret) throw new Error('Set GA4_MEASUREMENT_ID and GA4_API_SECRET in this trusted environment.');
  const url = new URL('https://www.google-analytics.com/' + (validate ? 'debug/mp/collect' : 'mp/collect'));
  url.searchParams.set('measurement_id', id); url.searchParams.set('api_secret', secret);
  for (const payload of payloads) {
    const response = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!response.ok) throw new Error('Analytics returned HTTP ' + response.status + '. Check the request before trying again.');
    if (validate) {
      const result = await response.json();
      if (result.validationMessages?.length) throw new Error(JSON.stringify(result.validationMessages));
      console.log('Validated: ' + payload.events[0].name);
    } else console.log('Submitted: ' + payload.events[0].name + '. Verify processing in GA4; do not resend this stage.');
  }
}
