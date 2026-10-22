// Portable, allowlisted campaign context. Never include form answers or arbitrary URL queries.
export const CAMPAIGN_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_id', 'utm_content', 'utm_term'];
export const isLeadId = (v) => typeof v === 'string' && /^lead_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

export function sanitizeMeasurement(value) {
  if (value?.consent !== 'granted' || typeof value.client_id !== 'string' || !/^\d{1,20}\.\d{1,20}$/.test(value.client_id)) return null;
  return { consent: 'granted', client_id: value.client_id,
    ...(typeof value.session_id === 'string' && /^\d{1,20}$/.test(value.session_id) ? { session_id: value.session_id } : {}) };
}

export function campaignValue(value) {
  if (typeof value !== 'string' || /@|%40/i.test(value)) return '';
  return value.replace(/[\u0000-\u001f\u007f<>"\\]/g, '').trim().slice(0, 100);
}

export function pagePath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '';
  return value.split(/[?#]/)[0].replace(/[\u0000-\u001f\u007f<>"\\]/g, '').slice(0, 240);
}

export function sanitizeTouch(touch) {
  if (!touch || typeof touch !== 'object' || Array.isArray(touch)) return null;
  const out = {};
  for (const key of CAMPAIGN_KEYS) {
    const value = campaignValue(touch[key]);
    if (value) out[key] = value;
  }
  const path = pagePath(touch.landing_path);
  if (path) out.landing_path = path;
  if (typeof touch.referrer_host === 'string' && /^[a-z0-9.-]{1,253}$/i.test(touch.referrer_host)) out.referrer_host = touch.referrer_host;
  if (typeof touch.captured_at === 'string' && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(touch.captured_at)) out.captured_at = touch.captured_at.slice(0, 30);
  return Object.keys(out).length ? out : null;
}

export function sanitizeAttribution(value) {
  return { first_touch: sanitizeTouch(value?.first_touch), last_touch: sanitizeTouch(value?.last_touch) };
}

export function captureTouch(href, referrer = '', now = new Date().toISOString()) {
  const url = new URL(href);
  const touch = { landing_path: url.pathname, captured_at: now };
  for (const key of CAMPAIGN_KEYS) if (url.searchParams.has(key)) touch[key] = url.searchParams.get(key);
  try { const ref = new URL(referrer); if (ref.origin !== url.origin) touch.referrer_host = ref.hostname; } catch {}
  return sanitizeTouch(touch);
}

export function mergeAttribution(previous, touch) {
  const current = sanitizeAttribution(previous);
  const next = sanitizeTouch(touch);
  if (!next) return current;
  const campaign = CAMPAIGN_KEYS.some((key) => next[key]);
  const prior = current.last_touch;
  const newCampaign = campaign && CAMPAIGN_KEYS.some((key) => next[key] !== prior?.[key]);
  const newReferral = !campaign && next.referrer_host && next.referrer_host !== prior?.referrer_host;
  return { first_touch: current.first_touch || next, last_touch: !prior || newCampaign || newReferral ? next : prior };
}

export function attributionRows(attribution) {
  const safe = sanitizeAttribution(attribution);
  return [['First', safe.first_touch], ['Latest', safe.last_touch]].flatMap(([label, touch]) => touch ? [
    [label + ' source', touch.utm_source || touch.referrer_host || 'Direct'],
    ...CAMPAIGN_KEYS.filter((key) => key !== 'utm_source' && touch[key]).map((key) => [label + ' ' + key.replace('utm_', ''), touch[key]]),
    ...(touch.landing_path ? [[label + ' landing page', touch.landing_path]] : []),
  ] : []);
}
