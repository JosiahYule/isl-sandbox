import { isLeadId, sanitizeMeasurement } from '../../assistant/supabase/functions/_shared/lead-context.js';

export const OUTCOME_EVENTS = { qualified: 'qualify_lead', contacted: 'working_lead', proposal: 'proposal_sent',
  placed: 'close_convert_lead', lost: 'close_unconvert_lead', disqualified: 'disqualify_lead' };

// A recruiter-confirmed outcome, joined to the consenting enquiry by its opaque reference.
// A website click never qualifies a lead or creates a placement.
export function leadOutcome(record) {
  if (!isLeadId(record?.lead_id)) throw new Error('A valid lead_id is required.');
  const name = OUTCOME_EVENTS[record.stage];
  if (!name) throw new Error('Unknown lead stage.');
  const measurement = sanitizeMeasurement(record.measurement);
  if (!measurement) throw new Error('A consenting enquiry with its original Analytics client ID is required.');
  const params = { lead_id: record.lead_id, audience: 'employer',
    brand: ['isl', 'as', 'ads'].includes(record.brand) ? record.brand : 'isl' };
  if (['contract', 'direct', 'unsure'].includes(record.service)) params.service = record.service;
  if (typeof record.value === 'number' && Number.isFinite(record.value) && record.value >= 0) {
    params.value = record.value; params.currency = 'CAD';
  }
  // Outcomes happen when the recruiter records the new stage. Do not attach them to an old session.
  return { client_id: measurement.client_id, consent: { ad_user_data: 'DENIED', ad_personalization: 'DENIED' }, events: [{ name, params }] };
}
