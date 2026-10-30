import { isLeadId, pagePath, campaignValue } from '../../assistant/supabase/functions/_shared/lead-context.js';

const EVENTS = new Set(['employer_cta_click', 'form_start', 'form_submit', 'form_error', 'form_preview', 'generate_lead', 'apply_click', 'phone_click', 'email_click', 'job_view', 'job_search',
  // The chat assistant: opened, what kind of visitor it was, what it couldn't answer, an employer request ready to send, a job-alert sign-up
  'chat_open', 'chat_intent', 'chat_fallback', 'chat_request_ready', 'job_alert_signup']);
const PROVINCES = new Set(['NS', 'NB', 'PE', 'NL', 'QC', 'ON', 'MB', 'SK', 'AB', 'BC', 'YT', 'NT', 'NU', 'outside', 'all']);

// Only named, non-contact fields reach GA4. Free text, names, email, company and phone do not.
export function eventParameters(name, params = {}, context = {}) {
  if (!EVENTS.has(name)) return null;
  const out = {
    brand: ['isl', 'as', 'ads'].includes(context.brand) ? context.brand : 'isl',
    audience: ['employer', 'candidate', 'general'].includes(params.audience) ? params.audience : 'general',
    page_path: pagePath(context.path) || '/',
  };
  if (['contract', 'direct', 'unsure', 'all'].includes(params.service)) out.service = params.service;
  if (PROVINCES.has(params.province)) out.province = params.province;
  if (isLeadId(params.lead_id)) out.lead_id = params.lead_id;
  if (params.form_id === 'talent_request') out.form_id = params.form_id;
  if (['specific', 'general'].includes(params.application_kind)) out.application_kind = params.application_kind;
  if (typeof params.job_id === 'string' && /^[a-z0-9_-]{1,80}$/i.test(params.job_id)) out.job_id = params.job_id;
  if (['header', 'footer', 'page', 'home_hero', 'mobile_header', 'mobile_menu', 'service'].includes(params.cta_placement)) out.cta_placement = params.cta_placement;
  if (['validation', 'delivery'].includes(params.error_type)) out.error_type = params.error_type;
  if (Number.isInteger(params.results_count) && params.results_count >= 0) out.results_count = params.results_count;
  if (typeof params.has_keywords === 'boolean') out.has_keywords = params.has_keywords;
  // Where it happened (inside the chat or on the page), and the chat's own labels. Never the visitor's words.
  if (['assistant', 'page'].includes(params.via)) out.via = params.via;
  if (['seeker', 'employer', 'worker'].includes(params.intent)) out.intent = params.intent;
  if (['unclear', 'no_match'].includes(params.miss_kind)) out.miss_kind = params.miss_kind;
  if (typeof params.preview === 'boolean') out.preview = params.preview;
  for (const [key, value] of Object.entries(context.touch || {})) {
    if (['utm_source', 'utm_medium', 'utm_campaign', 'utm_id', 'utm_content', 'utm_term'].includes(key) && campaignValue(value)) out[key] = campaignValue(value);
  }
  return out;
}

export function analyticsPageLocation(href) {
  const url = new URL(href);
  const params = new URLSearchParams();
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_id', 'utm_content', 'utm_term', 'service']) {
    const value = campaignValue(url.searchParams.get(key));
    if (value) params.set(key, value);
  }
  return url.origin + url.pathname + (params.size ? '?' + params.toString() : '');
}
