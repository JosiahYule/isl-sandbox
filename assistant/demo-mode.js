// =====================================================================
// demo-mode.js: runs the assistant WITHOUT the AI backend.
//
// On the live site, every message goes to the Supabase function and Claude
// writes the reply. Until that backend is deployed, demo-engine.js stands in:
// rule-based conversation, but the REAL job search (jobs.js) over a snapshot
// of ISL's postings and the REAL contact routing (routing.js).
//
// The page can say which kind of visitor to expect with
//   <html data-assistant-mode="employer">   (hiring pages)
//   <html data-assistant-mode="seeker">     (the job board)
//   <html data-assistant-job="<job id>">    (one job's page: questions are about that posting)
// Any button with data-open-assistant opens the window; data-open-assistant="employer"
// opens it ready for an employer.
// =====================================================================
const base = new URL('.', import.meta.url);      // .../assistant/
const site = new URL('..', base);                // the site root (handles the /isl-sandbox/ prefix)

// The engine (and the job snapshot it searches) only load when someone sends a first message,
// so pages where nobody opens the chat don't download them.
let jobsPromise, enginePromise;
function loadJobs() {
  return (jobsPromise ||= fetch(new URL('jobs-snapshot.json', base), { signal: AbortSignal.timeout(10000) })
    .then((r) => { if (!r.ok) throw new Error('Jobs unavailable'); return r.json(); })
    .catch((error) => { jobsPromise = null; throw error; }));
}
const respond = async (messages, context) => {
  enginePromise ||= import('./demo-engine.js').then(({ createEngine }) => createEngine({
    loadJobs,
    siteUrl: (path) => { const u = new URL(path.replace(/^\//, ''), site); return u.pathname + u.search; },
  })).catch((error) => { enginePromise = null; throw error; });
  return (await enginePromise)(messages, context);
};

function start() {
  const chat = window.ISLJobChat.mount({
    send: respond,
    mode: document.documentElement.dataset.assistantMode,
    job: document.documentElement.dataset.assistantJob,
    note: 'Demo mode: real job search and contact routing, with scripted replies until the AI is connected.',
  });
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-open-assistant]');
    if (!t) return;
    e.preventDefault();
    chat.open(t.dataset.openAssistant || undefined);
  });
}
document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start) : start();
