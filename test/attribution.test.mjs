import test from 'node:test';
import assert from 'node:assert/strict';
import { captureTouch, mergeAttribution, sanitizeAttribution, sanitizeMeasurement } from '../assistant/supabase/functions/_shared/lead-context.js';
import { analyticsPageLocation, eventParameters } from '../src/lib/tracking.js';
import { leadOutcome } from '../src/lib/lead-outcome.js';
const leadId = 'lead_12345678-1234-4234-8234-123456789abc';

test('first campaign survives internal navigation; a subsequent campaign becomes latest touch', () => {
  const first = captureTouch('https://example.ca/?utm_source=linkedin&utm_medium=paid_social&utm_campaign=october&email=person@example.ca&details=private', 'https://linkedin.com/feed');
  let a = mergeAttribution(null, first);
  a = mergeAttribution(a, captureTouch('https://example.ca/direct-hire/', 'https://example.ca/'));
  assert.equal(a.first_touch.utm_source, 'linkedin');
  assert.equal(a.last_touch.utm_campaign, 'october');
  assert.equal(a.first_touch.landing_path, '/');
  a = mergeAttribution(a, captureTouch('https://example.ca/hire/?utm_source=newsletter&utm_medium=email'));
  assert.equal(a.first_touch.utm_source, 'linkedin');
  assert.equal(a.last_touch.utm_source, 'newsletter');
  assert(!JSON.stringify(a).includes('person@example.ca'));
  assert(!JSON.stringify(a).includes('private'));
});

test('contact fields, arbitrary queries and email-shaped campaign tags never enter analytics', () => {
  const p = eventParameters('generate_lead', { name: 'Private', email: 'person@example.ca', phone: '9025551234', role: 'Private role', company: 'Private company', audience: 'employer', service: 'direct', province: 'NS', lead_id: leadId },
    { brand: 'isl', path: '/hire/?email=person@example.ca', touch: { utm_source: 'linkedin', utm_campaign: 'person@example.ca' } });
  assert.deepEqual(p, { brand: 'isl', audience: 'employer', page_path: '/hire/', service: 'direct', province: 'NS', lead_id: leadId, utm_source: 'linkedin' });
  assert.equal(analyticsPageLocation('https://example.ca/hire/?service=direct&details=person@example.ca&utm_source=linkedin#private'), 'https://example.ca/hire/?utm_source=linkedin&service=direct');
  assert.equal(eventParameters('unknown_event', {}), null);
  assert.equal(sanitizeAttribution({ first_touch: { landing_path: '//evil.test', email: 'a@b.ca' } }).first_touch, null);
});

test('offline outcomes require original consenting measurement context and carry no contact data', () => {
  assert.equal(sanitizeMeasurement({ consent: 'denied', client_id: '123.456' }), null);
  const record = { lead_id: leadId, stage: 'qualified', name: 'Private', email: 'person@example.ca', measurement: { consent: 'granted', client_id: '123.456' }, service: 'direct' };
  const payload = leadOutcome(record);
  assert.equal(payload.events[0].name, 'qualify_lead');
  assert.equal(payload.client_id, '123.456');
  assert(!JSON.stringify(payload).includes('Private'));
  assert(!JSON.stringify(payload).includes('@'));
  assert.equal(leadOutcome({ ...record, stage: 'placed', value: 2000 }).events[0].params.currency, 'CAD');
  assert.equal(leadOutcome({ ...record, stage: 'proposal' }).events[0].name, 'proposal_sent');
  assert.throws(() => leadOutcome({ ...record, measurement: { consent: 'denied', client_id: '123.456' } }));
});
