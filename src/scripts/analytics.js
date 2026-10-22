import { CAMPAIGN_KEYS, captureTouch, mergeAttribution, sanitizeAttribution, sanitizeMeasurement } from '../../assistant/supabase/functions/_shared/lead-context.js';
import { analyticsPageLocation, eventParameters } from '../lib/tracking.js';

let attribution = sanitizeAttribution(null);
export const getAttribution = () => sanitizeAttribution(attribution);
let readMeasurement = async () => null;
export const getMeasurementContext = () => readMeasurement();
export const track = (name, params = {}) => document.dispatchEvent(new CustomEvent('isl:track', { detail: { name, params } }));

const config = document.querySelector('[data-analytics-config]');
if (config) initialise();

function initialise() {
  const id = config.dataset.ga4 || '';
  const enabled = /^G-[A-Z0-9]+$/i.test(id);
  const brand = config.dataset.brand;
  const root = config.dataset.siteRoot;
  const key = 'isl-enquiry-source-' + brand;
  let choice = null, started = false, jobViewSent = false;
  try { choice = localStorage.getItem('isl-consent'); } catch {}
  if (!['granted', 'denied'].includes(choice)) choice = null;
  // No analytics ID: retain only anonymous enquiry-source metadata for this tab.
  // Explicit analytics refusal also stops persistence of campaign metadata.
  let mayStore = choice !== 'denied' && (!enabled || choice === 'granted');
  let previous = null;
  if (mayStore) { try { previous = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch {} }
  attribution = mergeAttribution(previous, captureTouch(location.href, document.referrer));
  const persist = () => { try { if (mayStore) sessionStorage.setItem(key, JSON.stringify(attribution)); else sessionStorage.removeItem(key); } catch {} };
  persist();

  function send(name, params) {
    if (!enabled || choice !== 'granted') return;
    const safe = eventParameters(name, params, { brand, path: location.pathname, touch: attribution.last_touch });
    if (safe) window.gtag('event', name, safe);
  }
  function jobView() {
    const job = document.documentElement.dataset.assistantJob || document.querySelector('article[data-job-id]')?.dataset.jobId;
    if (job && !jobViewSent && choice === 'granted') { send('job_view', { audience: 'candidate', job_id: job }); jobViewSent = true; }
  }
  function start() {
    if (!enabled || started || choice !== 'granted') return;
    started = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    window.gtag('js', new Date());
    let referrer = '';
    try { referrer = new URL(document.referrer).origin; } catch {}
    window.gtag('config', id, { page_location: analyticsPageLocation(location.href), page_referrer: referrer,
      allow_google_signals: false, allow_ad_personalization_signals: false });
    const script = document.createElement('script');
    script.async = true; script.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
    document.head.appendChild(script);
    jobView();
  }
  readMeasurement = async () => {
    if (!enabled || choice !== 'granted' || !started) return null;
    const read = (field) => new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(null), 600);
      window.gtag('get', id, field, (value) => { clearTimeout(timeout); resolve(value); });
    });
    const [client, session] = await Promise.all([read('client_id'), read('session_id')]);
    return sanitizeMeasurement({ consent: choice, client_id: client, session_id: String(session || '') });
  };

  const banner = document.querySelector('[data-consent]');
  if (banner) {
    banner.hidden = !enabled || !!choice;
    banner.addEventListener('click', (e) => {
      const button = e.target.closest('[data-consent-choice]');
      if (!button) return;
      choice = button.dataset.consentChoice;
      try { localStorage.setItem('isl-consent', choice); } catch {}
      mayStore = choice === 'granted'; persist(); banner.hidden = true;
      if (started) window.gtag('consent', 'update', { analytics_storage: choice === 'granted' ? 'granted' : 'denied' });
      start();
    });
  }
  start();
  document.querySelector('[data-open-consent]')?.addEventListener('click', () => { if (banner) banner.hidden = false; });
  document.addEventListener('isl:track', (e) => send(e.detail?.name, e.detail?.params));

  // Preserve campaign tags across internal navigation when storage is unavailable or declined.
  function carryCampaign(url) {
    if (url.origin !== location.origin || !url.pathname.startsWith(root)) return url;
    for (const field of CAMPAIGN_KEYS) {
      if (!url.searchParams.has(field) && attribution.last_touch?.[field]) url.searchParams.set(field, attribution.last_touch[field]);
    }
    return url;
  }
  document.addEventListener('click', (e) => {
    const anchor = e.composedPath().find((node) => node instanceof HTMLAnchorElement);
    if (!anchor) return;
    let url;
    try { url = new URL(anchor.href); } catch { return; }
    if (!mayStore) anchor.href = carryCampaign(url).href;
    const job = anchor.closest('[data-job-id]')?.dataset.jobId || document.documentElement.dataset.assistantJob;
    const mode = document.documentElement.dataset.assistantMode;
    const audience = mode === 'employer' ? 'employer' : mode === 'seeker' || job ? 'candidate' : 'general';
    if (url.protocol === 'tel:') send('phone_click', { audience });
    else if (url.protocol === 'mailto:') send('email_click', { audience });
    else if (/\/careers\/(?:general-apply|apply)(?:\/|$)/.test(url.pathname)) {
      send('apply_click', { audience: 'candidate', job_id: job, application_kind: url.pathname.includes('general-apply') ? 'general' : 'specific' });
    } else if (url.origin === location.origin && url.pathname === root + 'hire/') {
      send('employer_cta_click', { audience: 'employer', service: url.searchParams.get('service'),
        cta_placement: anchor.dataset.ctaPlacement || (anchor.closest('header') ? 'header' : anchor.closest('footer') ? 'footer' : 'page') });
    }
  }, true);
  document.addEventListener('submit', (e) => {
    if (mayStore || !(e.target instanceof HTMLFormElement) || e.target.getAttribute('role') !== 'search') return;
    for (const field of CAMPAIGN_KEYS) {
      const value = attribution.last_touch?.[field];
      if (!value || e.target.elements.namedItem(field)) continue;
      const input = document.createElement('input'); input.type = 'hidden'; input.name = field; input.value = value;
      e.target.appendChild(input);
    }
  }, true);
}
