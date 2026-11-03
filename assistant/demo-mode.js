// =====================================================================
// demo-mode.js: runs the assistant WITHOUT the AI backend.
//
// On the live site, every message goes to the Supabase function and Claude
// writes the reply. Until that backend is deployed, demo-engine.js stands in:
// rule-based conversation, but the REAL job search (jobs.js) over a snapshot
// of the brand's postings and the REAL contact routing (routing.js).
//
// One assistant serves all three sites. <html data-brand="isl|as|ads"> says which brand this is
// (Base.astro sets it in the sandbox, src/squarespace/core.js on Squarespace).
// ISL searches its Avionte feed; Accountant Staffing and Administrative Staffing search their
// saved sample postings (jobs-as.json, jobs-ads.json) until their Tracker RMS feeds are connected.
//
// The page can say which kind of visitor to expect with
//   <html data-assistant-mode="employer">   (hiring pages)
//   <html data-assistant-mode="seeker">     (the job board)
//   <html data-assistant-job="<job id>">    (one job's page: questions are about that posting)
// Any button with data-open-assistant opens the window; data-open-assistant="employer"
// opens it ready for an employer.
// =====================================================================
const base = new URL('.', import.meta.url);      // .../assistant/
// The site root (handles the /isl-sandbox/ prefix). On Squarespace the assistant's files are on GitHub
// Pages but the pages are on the brand's domain: src/squarespace/core.js says so with data-site-root.
const sqRoot = document.documentElement.dataset.siteRoot;
// The assistant's files sit in assistant/<version>/, so the site root is whatever comes before assistant/.
const site = sqRoot ? new URL(sqRoot, location.href) : new URL(base.pathname.replace(/assistant\/.*$/, ''), location.origin);
const brand = ['as', 'ads'].includes(document.documentElement.dataset.brand) ? document.documentElement.dataset.brand : 'isl';
const jobsFile = brand === 'isl' ? 'jobs-snapshot.json' : `jobs-${brand}.json`;

// The engine (and the job snapshot it searches) only load when someone sends a first message,
// so pages where nobody opens the chat don't download them.
let jobsPromise, enginePromise;
function loadJobs() {
  return (jobsPromise ||= fetch(new URL(jobsFile, base), { signal: AbortSignal.timeout(10000) })
    .then((r) => { if (!r.ok) throw new Error('Jobs unavailable'); return r.json(); })
    .then((d) => (Array.isArray(d) ? d : d.jobs)) // the AS and ADS files keep their jobs under "jobs"
    .catch((error) => { jobsPromise = null; throw error; }));
}
const respond = async (messages, context) => {
  enginePromise ||= import('./demo-engine.js').then(({ createEngine }) => createEngine({
    loadJobs,
    brand,
    siteUrl: (path) => {
      const u = new URL(path.replace(/^\//, ''), site);
      // Squarespace addresses have no trailing slash (/hire, not /hire/)
      return (sqRoot ? u.pathname.replace(/(.)\/$/, '$1') : u.pathname) + u.search;
    },
  })).catch((error) => { enginePromise = null; throw error; });
  return (await enginePromise)(messages, context);
};

// PILOT: the AI version, for the people testing it. Opening any sandbox page with ?pilot switches this
// browser to the AI (it stays on while they click around); ?pilot=off switches back. Everyone else
// gets the scripted version above, so the public sandbox never spends API credit. ISL only for now.
const PILOT_ENDPOINT = 'https://hgwhpwgpulouzeqeqfei.supabase.co/functions/v1/isl-job-chat';
const pilot = (() => {
  if (brand !== 'isl' || sqRoot) return false;
  try {
    const q = new URLSearchParams(location.search);
    if (q.has('pilot')) q.get('pilot') === 'off' ? localStorage.removeItem('isl-chat-pilot') : localStorage.setItem('isl-chat-pilot', '1');
    return localStorage.getItem('isl-chat-pilot') === '1';
  } catch { return new URLSearchParams(location.search).has('pilot'); }
})();
// The AI's links point at integratedstaffing.ca, but the request form and the tools only exist on the
// sandbox so far: send those two to the sandbox's pages.
const SANDBOX_ONLY = ['hire/', 'learn/tools/'];
async function pilotRespond(messages, context) {
  const res = await fetch(PILOT_ENDPOINT, { method: 'POST', signal: AbortSignal.timeout(45000), headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages, context }) });
  let text = await res.text();
  for (const path of SANDBOX_ONLY) text = text.split(`https://www.integratedstaffing.ca/${path}`).join(new URL(path, site).href);
  let data = {};
  try { data = JSON.parse(text); } catch { /* handled below */ }
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

function start() {
  const chat = window.ISLJobChat.mount({
    send: pilot ? pilotRespond : respond,
    brand,
    mode: document.documentElement.dataset.assistantMode,
    job: document.documentElement.dataset.assistantJob,
    fine: false, // no small print under the chat box
    // Job alerts (ISL) and the log of messages it couldn't understand: on when the page gives their addresses.
    // Without an alerts address the sign-up runs as a preview and says nothing was sent.
    alerts: brand === 'isl',
    alertsEndpoint: document.documentElement.dataset.chatAlerts || '',
    missEndpoint: document.documentElement.dataset.chatMisses || '',
    privacyUrl: brand === 'isl' ? (sqRoot ? '/privacy' : new URL('privacy/', site).pathname) : '',
  });
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-open-assistant]');
    if (!t) return;
    e.preventDefault();
    chat.open(t.dataset.openAssistant || undefined);
  });
}
document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start) : start();
