// SQUARESPACE CORE SCRIPT  →  served as isl.js from GitHub Pages, loaded on every page of the
// brand's Squarespace site by the Footer Code Injection (scripts/export-squarespace.mjs writes it,
// filling in the values marked __LIKE_THIS__).
//
// What it does, in order:
//   1. Puts the header (pasted at the end of the page by Code Injection) first in the page, so
//      keyboard and screen reader users meet it first. It already shows at the top: it's fixed there.
//   2. Marks the current page in the menus, and applies the page's settings (data-* on #isl-page).
//   3. Brings job counts and job lists up to date. Code blocks are a snapshot of the day they were
//      pasted; the build on GitHub refreshes these hourly (live/), so open jobs never go stale.
//   4. Runs the shared scripts (menus, entrance effects, analytics), then the page's own script.
//   5. Starts the chat assistant.

const ROOT = new URL('.', import.meta.url).href; // https://josiahyule.github.io/isl-sandbox/sq/<brand>/
const COMMON = __COMMON__;                        // shared scripts every page runs (c/*.js)
const ASSISTANT = __ASSISTANT__;                  // the assistant's folder, or '' when it's off for this brand
const BRAND = __BRAND__;                          // 'isl', 'as' or 'ads': the chat assistant speaks for this brand
const CHAT = __CHAT__;                            // the chat's job-alert and miss-log addresses ('' = off)

const html = document.documentElement;
const header = document.getElementById('isl-header');
const footer = document.getElementById('isl-footer');
const page = document.getElementById('isl-page');
const path = location.pathname.replace(/\/+$/, '') || '/';

// 1. Header first in the page
if (header && document.body.firstElementChild !== header) document.body.prepend(header);
html.classList.add('isl-site');
html.dataset.siteRoot = '/'; // pages are on this domain (the chat assistant reads this for its links)
html.dataset.brand = BRAND;
if (CHAT.alerts) html.dataset.chatAlerts = CHAT.alerts;
if (CHAT.misses) html.dataset.chatMisses = CHAT.misses;

// 2. Current page and page settings
if (header) {
  const here = (href) => {
    const p = new URL(href, location.href).pathname.replace(/\/+$/, '') || '/';
    return p !== '/' && (path === p || path.startsWith(p + '/'));
  };
  header.querySelectorAll('nav.primary > a, nav.primary .has-drop > a, .mobile-row > a').forEach((a) => {
    if (here(a.getAttribute('href'))) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  // On the request form itself, the phone header's "Hire staff" button would only point back here
  if (path === '/hire') {
    header.querySelector('.bar')?.classList.add('bar--hire');
    header.querySelector('.hire-m')?.remove();
  }
}
if (footer) {
  footer.querySelectorAll('[data-isl-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });
  // The contact page lists every office itself, so the footer leaves its office row out there
  if (page?.dataset.footerOffices === 'false') {
    footer.querySelector('.offices')?.remove();
    footer.querySelector('.lower')?.classList.add('lower--top');
  }
}
// Blog posts (Squarespace's own pages): a way back to every article, above the date
const post = document.querySelector('.blog-item-wrapper');
if (post && __HAS_LEARN__ && !post.querySelector('.isl-post-back')) {
  const back = document.createElement('a');
  back.className = 'isl-post-back';
  back.href = '/learn';
  back.textContent = '\u2190 All articles';
  (post.querySelector('.blog-item-top-wrapper') || post).prepend(back);
}
// Squarespace puts the previous/next links outside the post, across the whole window: moved to the end
// of the post, they line up with its text
const pager = document.querySelector('.item-pagination');
if (post && pager && !post.contains(pager)) post.append(pager);
if (page?.dataset.assistantMode) html.dataset.assistantMode = page.dataset.assistantMode;
if (page?.dataset.assistantJob) html.dataset.assistantJob = page.dataset.assistantJob;

// 3. Fresh job counts and job lists (each waits at most a few seconds; the pasted snapshot stays otherwise)
const fetchText = (url, ms = 4000) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal, cache: 'no-cache' })
    .then((r) => (r.ok ? r.text() : null))
    .catch(() => null)
    .finally(() => clearTimeout(timer));
};

// Counts are plain text, so they update whenever they arrive. Job lists are swapped in before the
// page's script runs, so the script works on the fresh list.
function refreshCounts() {
  if (!document.querySelector('[data-isl-count]')) return;
  fetchText(`${ROOT}live/counts.json`).then((t) => {
    let counts = null;
    try { counts = JSON.parse(t); } catch { return; }
    document.querySelectorAll('[data-isl-count]').forEach((el) => {
      const n = counts[el.dataset.islCount];
      if (n != null) el.textContent = String(n);
    });
  });
}

async function refreshLists() {
  if (page?.dataset.islTemplate) return showTemplate();
  // A page built entirely from changing data (a tool): replaced whole with the latest version
  if (page?.dataset.islLivePage) {
    const fresh = await fetchText(`${ROOT}live/${page.dataset.islPage}.html`);
    if (fresh) page.innerHTML = fresh;
  }
  const regions = page ? [...page.querySelectorAll('[data-isl-live]')] : [];
  await Promise.all([
    ...regions.map(async (el) => {
      const fresh = await fetchText(`${ROOT}live/${el.dataset.islLive}.html`);
      if (!fresh) return;
      const t = document.createElement('template');
      t.innerHTML = fresh.trim();
      const next = t.content.firstElementChild;
      // (or the part that replaced it: data-isl-was names the part an older pasted block may still hold)
      if (next && (next.dataset.islLive === el.dataset.islLive || next.dataset.islWas === el.dataset.islLive)) el.replaceWith(next);
    }),
  ]);
}

// The pages that fill themselves in from the address: the job page (/find-work/job?id=...) and the
// team member page (/team/member?name=...). Each job or person is a fragment with its title,
// description and search-engine data.
async function showTemplate() {
  const value = new URLSearchParams(location.search).get(page.dataset.islParam) || '';
  const status = page.querySelector('[data-isl-status]');
  const fresh = /^[\w-]+$/.test(value) ? await fetchText(`${ROOT}live/${page.dataset.islTemplate}/${value}.html`) : null;
  if (!fresh) {
    if (status) status.textContent = page.dataset.islMissing;
    page.dataset.islJs = ''; // nothing for the page's script to work on
    return;
  }
  const holder = document.createElement('div');
  holder.innerHTML = fresh;
  const t = holder.querySelector('template');
  page.innerHTML = '';
  page.append(t.content.cloneNode(true));
  if (t.dataset.assistantJob) html.dataset.assistantJob = t.dataset.assistantJob;
  document.title = t.dataset.title;
  const meta = (sel, make) => document.head.querySelector(sel) || document.head.appendChild(make());
  meta('meta[name="description"]', () => Object.assign(document.createElement('meta'), { name: 'description' })).content = t.dataset.description;
  meta('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' })).href = `${location.origin}${location.pathname}?${page.dataset.islParam}=${value}`;
  // Search-engine data (a script added like this is read, not run)
  holder.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
    const d = document.createElement('script');
    d.type = 'application/ld+json';
    d.textContent = s.textContent;
    document.head.append(d);
  });
}

// 4 and 5. Shared scripts, the page's script, then the assistant
async function start() {
  await refreshLists();
  refreshCounts();
  for (const file of COMMON) {
    try { await import(ROOT + file); } catch (e) { console.error('[ISL] shared script', file, e); }
  }
  if (page?.dataset.islJs) {
    try { await import(`${ROOT}p/${page.dataset.islPage}.js`); } catch (e) { console.error('[ISL] page script', e); }
  }
  if (ASSISTANT && page?.dataset.islAssistant !== 'off') {
    // The widget first, then demo mode once the widget has loaded (it builds on the widget)
    const w = document.createElement('script');
    w.src = `${ROOT}${ASSISTANT}widget.js`;
    w.addEventListener('load', () => {
      const d = document.createElement('script');
      d.type = 'module';
      d.src = `${ROOT}${ASSISTANT}demo-mode.js`;
      document.body.append(d);
    });
    document.body.append(w);
  }
}
start();
