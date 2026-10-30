// SQUARESPACE EXPORT
// Turns the sandbox into what each brand's Squarespace site needs:
//
//   node scripts/export-squarespace.mjs            all three brands
//   node scripts/export-squarespace.mjs isl        one brand
//   ... --publish                                   also copy the result into dist/sq/<brand>/ (the deploy does this)
//
// For each brand it runs a Squarespace build (SITE_MODE=squarespace, see astro.config.mjs) into
// dist-sq/<brand>/ and adds:
//   isl.css                  the shared style file: every page's styles in one file, scoped so they only
//                            touch our areas of a Squarespace page (and the Squarespace adjustments first)
//   isl.js                   the shared script file (src/squarespace/core.js)
//   c/*.js                   scripts every page runs (menus, entrance effects), loaded by isl.js
//   p/<page>.js              each page's own script, loaded by isl.js when the page has one
//   injection-header.html    paste into Settings > Developer tools > Code Injection > Header
//   injection-footer.html    paste into Code Injection > Footer (our header and footer)
//   blocks/<page>.html       one code block per page
//   live/                    fresh job counts and job lists, which isl.js swaps into pasted pages
//   kit.html                 the build kit: every page with its address, title, description and code block
//
// The deploy workflow copies these (not the built pages themselves) to GitHub Pages at
// https://josiahyule.github.io/isl-sandbox/sq/<brand>/, which is where the Squarespace sites load them from.

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, rmSync, cpSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { JSDOM } from 'jsdom';

// Brands whose blog lives at /learn on the live site (src/data/posts.js lists their articles)
const BLOG_BRANDS = ['isl', 'as'];
const BRANDS = process.argv.slice(2).filter((b) => ['isl', 'as', 'ads'].includes(b));
const PUBLISH = process.argv.includes('--publish');
const NAMES = { isl: 'Integrated Staffing', as: 'Accountant Staffing', ads: 'Administrative Staffing' };
const ROOTS = ':is(#isl-header,#isl-page,#isl-footer)';

for (const brand of BRANDS.length ? BRANDS : ['isl', 'as', 'ads']) exportBrand(brand);

function exportBrand(brand) {
  const OUT = `dist-sq/${brand}`;
  const ASSETS = `https://josiahyule.github.io/isl-sandbox/sq/${brand}`;
  rmSync(OUT, { recursive: true, force: true });
  execSync('npx astro build', { env: { ...process.env, SITE_MODE: 'squarespace', BRAND: brand }, stdio: ['ignore', 'ignore', 'inherit'] });

  // ---------- Read every built page ----------
  const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
  const files = walk(OUT).filter((f) => f.endsWith('.html') && !relative(OUT, f).startsWith('assistant'));
  const pages = files.map((file) => {
    const rel = relative(OUT, file).replace(/\\/g, '/');
    const path = rel === 'index.html' ? '/' : '/' + rel.replace(/(\/)?index\.html$/, '').replace(/\.html$/, '');
    const key = path === '/' ? 'home' : path.slice(1).replace(/\//g, '--');
    return { file, path, key, dom: new JSDOM(readFileSync(file, 'utf8')) };
  });

  // ONE PAGE, FILLED IN: rather than a Squarespace page for every job and every person, each kind gets one
  // page that fills itself in from the address (isl.js, showTemplate). Each job or person is saved as a
  // fragment (live/<kind>/<value>.html) with its title, description and search-engine data.
  const TEMPLATES = {
    // Each brand keeps its live site's job address, so old job links keep working:
    // ISL /find-work/job?id=..., AS and ADS /job-details?jobcode=...
    job: { ...(brand === 'isl' ? { path: '/find-work/job', param: 'id' } : { path: '/job-details', param: 'jobcode' }), mode: 'seeker', title: 'Job', note: 'Each open job, filled in from the job feed.',
      loading: 'Loading the job…', missing: 'This job has been filled or is no longer open.', back: ['/find-work', 'See all open jobs'] },
    person: { path: '/team/member', param: 'name', title: 'Team member', note: 'Each person on the team page, filled in by name.',
      loading: 'Loading…', missing: 'We couldn’t find that person. They may have moved on.', back: ['/team', 'See the whole team'] },
  };
  const filledIn = {}; // page path -> its address on the filled-in page
  for (const p of pages) {
    const id = p.dom.window.document.documentElement.dataset.assistantJob;
    if (id && p.path.startsWith('/find-work/')) p.tpl = { kind: 'job', value: id };
    else if (/^\/team\/[^/]+$/.test(p.path)) p.tpl = { kind: 'person', value: p.path.split('/')[2] };
    if (p.tpl) filledIn[p.path] = `${TEMPLATES[p.tpl.kind].path}?${TEMPLATES[p.tpl.kind].param}=${p.tpl.value}`;
  }

  // ---------- Links ----------
  // Page links stay on the brand's domain, tidied to Squarespace's style (no trailing slash).
  // Anything else starting with / is a file, which lives on GitHub Pages.
  const isFile = (v) => /^\/(assistant|images|brands|_astro)\//.test(v) || /\.(?!html?$)[a-z0-9]{2,5}$/i.test(v.split(/[?#]/)[0]);
  const pageLink = (v) => {
    const [, p, rest = ''] = v.match(/^([^?#]*)(.*)$/);
    const clean = p.replace(/\/+$/, '') || '/';
    if (filledIn[clean]) return filledIn[clean];
    return clean + rest;
  };
  const rewrite = (name, v) => {
    if (!v || !v.startsWith('/') || v.startsWith('//')) return v;
    if (isFile(v)) return ASSETS + v;
    return name === 'href' || name === 'action' || name.startsWith('data-') ? pageLink(v) : v;
  };
  function rewriteTree(root) {
    for (const el of [root, ...root.querySelectorAll('*')]) {
      for (const attr of [...(el.attributes || [])]) {
        if (attr.name === 'srcset') {
          el.setAttribute('srcset', attr.value.split(',').map((part) => { const [u, w] = part.trim().split(/\s+/); return [rewrite('src', u), w].filter(Boolean).join(' '); }).join(', '));
        } else if (attr.name === 'style') {
          el.setAttribute('style', attr.value.replace(/url\((['"]?)(\/[^)'"]+)\1\)/g, (m, q, u) => `url(${q}${rewrite('src', u)}${q})`));
        } else {
          const next = rewrite(attr.name, attr.value);
          if (next !== attr.value) el.setAttribute(attr.name, next);
        }
      }
    }
  }

  // ---------- Scripts: shared (on every page) or the page's own ----------
  const scriptsOf = (doc) => [...doc.querySelectorAll('script')].map((s) => {
    const type = s.getAttribute('type') || '';
    const src = s.getAttribute('src');
    if (type === 'application/ld+json') return { kind: 'data', el: s };
    if (src && src.includes('/assistant/')) return { kind: 'assistant', src };
    if (type !== 'module') return { kind: 'classic', el: s };
    return src ? { kind: 'module', id: src, src } : { kind: 'module', id: 'inline:' + hash(s.textContent), code: s.textContent };
  });
  for (const p of pages) p.scripts = scriptsOf(p.dom.window.document);
  const modulesIn = (p) => p.scripts.filter((s) => s.kind === 'module');
  const everywhere = new Set(modulesIn(pages[0]).map((s) => s.id).filter((id) => pages.every((p) => modulesIn(p).some((s) => s.id === id))));
  mkdirSync(`${OUT}/c`, { recursive: true });
  mkdirSync(`${OUT}/p`, { recursive: true });
  const common = modulesIn(pages[0]).filter((s) => everywhere.has(s.id)).map((s, i) => {
    if (s.src) return s.src.slice(ASSETS.length + 1); // already a file on GitHub Pages
    writeFileSync(`${OUT}/c/${i}.js`, s.code);
    return `c/${i}.js`;
  });
  for (const p of pages) {
    const own = modulesIn(p).filter((s) => !everywhere.has(s.id));
    if (!own.length) continue;
    const lines = own.map((s, i) => {
      if (s.src) return `import ${JSON.stringify(s.src)};`;
      writeFileSync(`${OUT}/p/${p.key}.${i}.js`, s.code);
      return `import './${p.key}.${i}.js';`;
    });
    writeFileSync(`${OUT}/p/${p.key}.js`, `// ${p.path}: this page's scripts, run by isl.js\n${lines.join('\n')}\n`);
    p.hasJs = true;
  }
  const assistantSrc = pages.flatMap((p) => p.scripts).find((s) => s.kind === 'assistant')?.src;
  const assistantDir = assistantSrc ? assistantSrc.slice(ASSETS.length + 1).replace(/[^/]+$/, '') : '';

  // ---------- The shared style file ----------
  const cssFiles = [];
  for (const p of pages) for (const l of p.dom.window.document.querySelectorAll('link[rel="stylesheet"]')) {
    const href = l.getAttribute('href');
    if (href.startsWith(ASSETS) && !cssFiles.includes(href)) cssFiles.push(href);
  }
  const inlineCss = [...new Set(pages.flatMap((p) => [...p.dom.window.document.querySelectorAll('style')].map((s) => s.textContent)))];
  const htmlEl = pages[0].dom.window.document.documentElement;
  const brandVars = htmlEl.getAttribute('style'); // the brand's colours (Base.astro)
  const siteCss = [...cssFiles.map((h) => readFileSync(join(OUT, h.slice(ASSETS.length)), 'utf8')), ...inlineCss].join('\n');
  const css = [
    `/* ${NAMES[brand]}: shared styles for the Squarespace site. Generated by scripts/export-squarespace.mjs from the sandbox; edit the sandbox, not this file. */`,
    readFileSync('src/squarespace/squarespace.css', 'utf8'),
    scopeCss(siteCss),
    brandVars ? `${ROOTS}{${brandVars}}` : '',
  ].join('\n');
  writeFileSync(`${OUT}/isl.css`, css);

  // ---------- The shared script file ----------
  writeFileSync(`${OUT}/isl.js`, readFileSync('src/squarespace/core.js', 'utf8')
    .replace('__COMMON__', JSON.stringify(common))
    .replace('__ASSISTANT__', JSON.stringify(assistantDir))
    .replace('__BRAND__', JSON.stringify(brand))
    .replace('__CHAT__', JSON.stringify({ alerts: htmlEl.dataset.chatAlerts || '', misses: htmlEl.dataset.chatMisses || '' })) // the chat's job alerts and miss log, when switched on
    .replace('__HAS_LEARN__', JSON.stringify(BLOG_BRANDS.includes(brand)))); // the Learn page lists the blog posts

  // ---------- Header and footer (Code Injection) ----------
  // Taken from the 404 page, where no menu item is current; isl.js marks the current page.
  const ref = pages.find((p) => p.path === '/404') || pages[0];
  const rdoc = ref.dom.window.document;
  const skip = rdoc.querySelector('a.skip');
  skip.setAttribute('href', '#isl-page');
  const head = rdoc.querySelector('header.header');
  const foot = rdoc.querySelector('footer.footer');
  const config = rdoc.querySelector('[data-analytics-config]');
  if (config) config.setAttribute('data-site-root', '/');
  const consent = rdoc.querySelector('[data-consent]');
  for (const el of [skip, head, foot, config, consent].filter(Boolean)) rewriteTree(el);
  head.querySelectorAll('[aria-current]').forEach((a) => a.removeAttribute('aria-current'));
  const fontPreload = rdoc.querySelector('link[rel="preload"][as="font"]');
  const stamp = `Generated ${new Date().toISOString().slice(0, 10)} by scripts/export-squarespace.mjs`;
  writeFileSync(`${OUT}/injection-header.html`, [
    `<!-- ${NAMES[brand]}: shared styles (${stamp}) -->`,
    fontPreload ? fontPreload.outerHTML : '',
    `<link rel="stylesheet" href="${ASSETS}/isl.css">`,
  ].filter(Boolean).join('\n') + '\n');
  writeFileSync(`${OUT}/injection-footer.html`, [
    `<!-- ${NAMES[brand]}: header, footer and shared script (${stamp}). Menu text and links can be edited here. -->`,
    `<div id="isl-header">`, skip.outerHTML, head.outerHTML, `</div>`,
    `<div id="isl-footer">`, foot.outerHTML, config?.outerHTML || '', consent?.outerHTML || '', `</div>`,
    `<script type="module" src="${ASSETS}/isl.js"></script>`,
  ].join('\n') + '\n');

  // ---------- Live counts ----------
  const counts = {};
  for (const el of rdoc.querySelectorAll('[data-isl-count]')) counts[el.dataset.islCount] = Number(el.textContent.trim());
  mkdirSync(`${OUT}/live`, { recursive: true });

  // ---------- One code block per page ----------
  mkdirSync(`${OUT}/blocks`, { recursive: true });
  const kit = [];
  const tplScript = {}; // kind -> the page whose script the filled-in page uses (it's the same for each)
  for (const p of pages) {
    const doc = p.dom.window.document;
    const main = doc.querySelector('main#main');
    if (!main) continue;
    const html = doc.documentElement;
    rewriteTree(main);
    for (const el of main.querySelectorAll('[data-isl-count]')) counts[el.dataset.islCount] ??= Number(el.textContent.trim());
    // Job lists and other job-based parts: the hourly build's copy is what isl.js swaps in
    main.querySelectorAll('[data-isl-live]').forEach((el) => {
      el.setAttribute('data-isl-live', `${p.key}~${el.getAttribute('data-isl-live')}`);
      writeFileSync(`${OUT}/live/${el.getAttribute('data-isl-live')}.html`, el.outerHTML);
      // The pasted copy is replaced on load, so it doesn't need the search text behind each job (most of its size)
      el.querySelectorAll('[data-search]').forEach((j) => j.removeAttribute('data-search'));
    });
    // Scripts stay out of the code block (isl.js runs them), except data for search engines
    // (data the page's script reads, type application/json, stays too)
    main.querySelectorAll('script').forEach((s) => { if (!/json$/.test(s.getAttribute('type') || '')) s.remove(); });
    const data = [...doc.head.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.outerHTML);
    const title = (doc.querySelector('title')?.textContent || '').replace(/\s*\|\s*[^|]+$/, '');
    const description = doc.querySelector('meta[name="description"]')?.getAttribute('content') || '';

    // A job or a person: saved as a fragment for the one filled-in page (TEMPLATES above)
    if (p.tpl) {
      mkdirSync(`${OUT}/live/${p.tpl.kind}`, { recursive: true });
      writeFileSync(`${OUT}/live/${p.tpl.kind}/${p.tpl.value}.html`, [
        `<template data-title="${esc(doc.querySelector('title')?.textContent || '')}" data-description="${esc(description)}"${html.dataset.assistantJob ? ` data-assistant-job="${esc(html.dataset.assistantJob)}"` : ''}>`,
        main.innerHTML.trim(), '</template>', ...data,
      ].join('\n'));
      tplScript[p.tpl.kind] ??= p.hasJs ? p.key : null;
      p.tplHasJs = p.hasJs;
      continue;
    }
    // A page built entirely from changing data (the jobs report, pay on open jobs): refreshed whole
    const livePage = main.hasAttribute('data-isl-live-page');
    if (livePage) writeFileSync(`${OUT}/live/${p.key}.html`, main.innerHTML.trim());
    const attrs = {
      id: 'isl-page',
      'data-isl-page': p.key,
      'data-isl-js': p.hasJs ? '1' : null,
      'data-isl-live-page': livePage ? '1' : null,
      'data-assistant-mode': html.dataset.assistantMode || null,
      'data-assistant-job': html.dataset.assistantJob || null,
      'data-isl-assistant': p.scripts.some((s) => s.kind === 'assistant') ? null : 'off',
      'data-footer-offices': doc.querySelector('footer .offices') ? null : 'false',
    };
    const open = '<div ' + Object.entries(attrs).filter(([, v]) => v != null).map(([k, v]) => `${k}="${v}"`).join(' ') + '>';
    const block = [
      `<!-- ${NAMES[brand]} page: ${p.path}. Text can be edited here; the styles and scripts come from the shared files (Code Injection). -->`,
      open,
      main.innerHTML.trim(),
      '</div>',
      ...data,
    ].join('\n') + '\n';
    writeFileSync(`${OUT}/blocks/${p.key}.html`, block);
    kit.push({ key: p.key, path: p.path, title, description, size: Buffer.byteLength(block) });
  }
  // The filled-in pages: one code block each, and one script (the same for every job, every person)
  for (const [kind, t] of Object.entries(TEMPLATES)) {
    if (!pages.some((p) => p.tpl?.kind === kind)) continue;
    const from = tplScript[kind];
    if (from) writeFileSync(`${OUT}/p/${kind}.js`, readFileSync(`${OUT}/p/${from}.js`, 'utf8').replace(/^\/\/.*\n/, `// ${t.path}: the page's scripts, run by isl.js\n`));
    for (const p of pages) if (p.tpl?.kind === kind) for (const f of readdirSync(`${OUT}/p`)) if (f.startsWith(p.key + '.') && !(p.key === from && f !== `${p.key}.js`)) rmSync(`${OUT}/p/${f}`);
    const attrs = [`id="isl-page"`, `data-isl-page="${kind}"`, from ? 'data-isl-js="1"' : '', `data-isl-template="${kind}"`, `data-isl-param="${t.param}"`, t.mode ? `data-assistant-mode="${t.mode}"` : ''].filter(Boolean).join(' ');
    const block = [
      `<!-- ${NAMES[brand]} page: ${t.path} (the address ends ?${t.param}=...). isl.js fills it in; leave this block as it is. -->`,
      `<div ${attrs} data-isl-missing="${esc(t.missing)}">`,
      `<section class="section"><div class="wrap"><p data-isl-status>${t.loading}</p><p><a href="${t.back[0]}">${t.back[1]}</a></p></div></section>`,
      '</div>',
    ].join('\n') + '\n';
    writeFileSync(`${OUT}/blocks/${kind}.html`, block);
    kit.push({ key: kind, path: t.path, title: t.title, description: t.note, size: Buffer.byteLength(block) });
  }
  writeFileSync(`${OUT}/live/counts.json`, JSON.stringify(counts));
  writeFileSync(`${OUT}/kit.json`, JSON.stringify({ brand, name: NAMES[brand], generated: new Date().toISOString(), pages: kit }, null, 1));
  writeFileSync(`${OUT}/kit.html`, kitPage(brand, ASSETS));
  // The kit's own script must be valid JavaScript (a broken one leaves every Copy button dead)
  const kitScript = kitPage(brand, ASSETS).split('<script>')[1].split('</script>')[0];
  try { new Function(kitScript); } catch (e) { throw new Error(`kit.html script doesn't parse: ${e.message}`); }

  // The built pages themselves aren't published (they'd be copies of the site on another address),
  // nor are the files that only mean something at the root of a site
  for (const p of pages) rmSync(p.file);
  // URL Mappings for Squarespace (Settings > Developer tools > URL Mappings): the old addresses in the
  // build's _redirects, in Squarespace's format. Old job links need none (the job page keeps its address).
  const mappings = readFileSync(`${OUT}/_redirects`, 'utf8').split('\n')
    .map((l) => l.trim().split(/\s+/)).filter((t) => t.length === 3 && t[0].startsWith('/') && !t.some((x) => x.includes('=')) && t[0] !== TEMPLATES.job.path)
    .map(([from, to, code]) => `${from} -> ${pageLink(to)} ${code}`);
  // The blog moved from /learn to /blog (the new Learn page took /learn): forward every old post
  if (BLOG_BRANDS.includes(brand)) mappings.push('/learn/[name] -> /blog/[name] 301');
  writeFileSync(`${OUT}/url-mappings.txt`, mappings.join('\n') + '\n');
  for (const f of ['sitemap.xml', 'robots.txt', '_headers', '_redirects', 'favicon.svg']) rmSync(`${OUT}/${f}`, { force: true });
  if (PUBLISH) cpSync(OUT, `dist/sq/${brand}`, { recursive: true });
  console.log(`${brand}: ${kit.length} code blocks, isl.css ${(Buffer.byteLength(css) / 1024).toFixed(0)} KB, ${common.length} shared scripts`);
}

function hash(s) { return createHash('sha1').update(s).digest('hex').slice(0, 10); }
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }

// ---------- Scoping the site's styles to our areas of a Squarespace page ----------
// Every selector gets #isl-header / #isl-page / #isl-footer in front of it, so these styles can't
// touch the rest of a Squarespace page, and win over Squarespace's own styles inside our areas.
//   :root, body    our areas themselves (the colours and fonts the whole page inherits)
//   html ...       left as is (page-wide settings)
//   .motion ...    the class isl.js's entrance-effects script puts on <html>
//   view transitions are dropped: Squarespace pages load in full each time.
function scopeCss(css) {
  let out = '';
  let i = 0;
  const n = css.length;
  const skipString = (j) => { const q = css[j]; j++; while (j < n && css[j] !== q) { if (css[j] === '\\') j++; j++; } return j + 1; };
  const until = (j, stops) => { // index of the first stop character outside strings, brackets and comments
    let depth = 0;
    while (j < n) {
      const c = css[j];
      if (c === '"' || c === "'") { j = skipString(j); continue; }
      if (c === '/' && css[j + 1] === '*') { j = css.indexOf('*/', j + 2) + 2; continue; }
      if (c === '(' || c === '[') depth++;
      else if (c === ')' || c === ']') depth--;
      else if (depth === 0 && stops.includes(c)) return j;
      j++;
    }
    return n;
  };
  const block = (j) => { // j at '{': index just past the matching '}'
    let depth = 0;
    while (j < n) {
      const c = css[j];
      if (c === '"' || c === "'") { j = skipString(j); continue; }
      if (c === '/' && css[j + 1] === '*') { j = css.indexOf('*/', j + 2) + 2; continue; }
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) return j + 1; }
      j++;
    }
    return n;
  };
  while (i < n) {
    const stop = until(i, '{;');
    const prelude = css.slice(i, stop).trim();
    if (stop >= n) break;
    if (css[stop] === ';') { if (prelude) out += prelude + ';'; i = stop + 1; continue; }
    const end = block(stop);
    const body = css.slice(stop + 1, end - 1);
    i = end;
    if (prelude.startsWith('/*')) { /* stray comment */ }
    if (prelude.startsWith('@')) {
      const name = prelude.match(/^@([\w-]+)/)[1];
      if (name === 'view-transition') continue;
      if (['media', 'supports', 'container', 'layer'].includes(name)) { const inner = scopeCss(body); if (inner) out += `${prelude}{${inner}}`; continue; }
      out += `${prelude}{${body}}`; // @keyframes, @font-face, @property ...
      continue;
    }
    const selectors = splitList(prelude.replace(/\/\*[\s\S]*?\*\//g, '')).map(scopeSelector).filter(Boolean);
    if (selectors.length) out += `${selectors.join(',')}{${body}}`;
  }
  return out;
}

function splitList(s) {
  const parts = [];
  let depth = 0, start = 0;
  for (let j = 0; j < s.length; j++) {
    const c = s[j];
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === ',' && depth === 0) { parts.push(s.slice(start, j)); start = j + 1; }
  }
  parts.push(s.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
}

function scopeSelector(sel) {
  if (sel.startsWith('::view-transition')) return null;
  if (/^html(?![\w-])/.test(sel)) return sel;
  if (/^(:root|body)(?![\w-])/.test(sel)) return sel.replace(/^(:root|body)/, ROOTS);
  if (/^\.motion(?![\w-])/.test(sel)) return `html.motion ${ROOTS}${sel.slice('.motion'.length)}`;
  return `${ROOTS} ${sel}`;
}

// ---------- The build kit ----------
function kitPage(brand, assets) {
  return `<!doctype html>
<html lang="en-CA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${NAMES[brand]} Squarespace build kit</title>
<style>
  body { font: 16px/1.55 system-ui, sans-serif; margin: 0; color: #1a1a1a; background: #f5f5f5; }
  .wrap { max-width: 980px; margin: 0 auto; padding: 32px 20px 80px; }
  h1 { font-size: 32px; margin: 0 0 6px; letter-spacing: -0.02em; }
  h2 { font-size: 20px; margin: 40px 0 10px; }
  p { margin: 0 0 12px; max-width: 70ch; }
  .card { background: #fff; border: 1px solid #e3e3e3; padding: 16px 18px; margin-bottom: 10px; display: grid; grid-template-columns: 1fr auto; gap: 4px 16px; align-items: center; }
  .card b { font-size: 16px; }
  .meta { color: #666; font-size: 14px; }
  .addr { font-family: ui-monospace, monospace; font-size: 14px; }
  button { font: inherit; font-weight: 600; padding: 8px 14px; border: 1.5px solid #0070ca; background: #0070ca; color: #fff; cursor: pointer; }
  button.ghost { background: #fff; color: #0070ca; }
  button.done { background: #1a7f37; border-color: #1a7f37; color: #fff; }
  .btns { display: flex; gap: 8px; grid-row: span 3; }
  input[type=search] { font: inherit; padding: 10px 12px; width: 100%; max-width: 420px; border: 1.5px solid #1a1a1a; margin: 8px 0 16px; }
  ol li { margin-bottom: 6px; }
  code { background: #eee; padding: 1px 5px; }
  dialog { max-width: 720px; width: calc(100% - 40px); border: 1.5px solid #1a1a1a; padding: 20px; }
  dialog textarea { width: 100%; height: 300px; font: 13px/1.4 ui-monospace, monospace; }
</style></head><body><div class="wrap">
<h1>${NAMES[brand]}: Squarespace build kit</h1>
<p class="meta" id="gen"></p>
<p id="err" hidden style="color:#b3261e;font-weight:600"></p>

<h2>0. Try a page first (optional)</h2>
<p>Code Injection changes every page at once. To see one page on Squarespace first, make a new page that isn't in the navigation, add a Code block, and paste that page's <b>Test version</b> (below): it carries the header, footer and shared files inside it, so it only affects that one page.</p>

<h2>1. Once for the whole site</h2>
<ol>
  <li>In Squarespace, open <b>Settings → Developer tools → Code Injection</b>.</li>
  <li>Paste the <b>Header</b> code into the Header box. <button data-copy="injection-header.html">Copy Header code</button></li>
  <li>Paste the <b>Footer</b> code into the Footer box. <button data-copy="injection-footer.html">Copy Footer code</button></li>
  <li>Save. Every page now has the new header and footer, and the new styles.</li>
  <li>Open <b>Settings → Developer tools → URL Mappings</b> and paste the old addresses to forward. <button data-copy="url-mappings.txt">Copy URL Mappings</button></li>
</ol>

<h2>2. Each page</h2>
<p>For each page: create (or open) the page at the address shown, add one section with one <b>Code</b> block stretched across the full width, paste the page's code into it, and turn off <b>Display source</b>. Set the page title and SEO description under the page's settings.</p>
<input type="search" placeholder="Find a page" id="find" aria-label="Find a page">
<div id="pages"></div>
</div>
<dialog id="manual"><p><b>Copy didn't work in this browser.</b> The code is selected below: press Ctrl+C (Cmd+C on a Mac), then close this.</p><textarea readonly></textarea><p><button type="button" id="manual-close">Close</button></p></dialog>
<script>
// Every file is loaded as soon as the page opens, so a click can copy straight away. (Browsers only
// let a page write to the clipboard right after a click; waiting for a download first can be refused.)
const ROOT = ${JSON.stringify(assets + '/')};
const NL = String.fromCharCode(10);
// Copies are kept for a minute at most, so a kit left open in a tab never hands out an old version
const cache = {};
const load = (file) => {
  const hit = cache[file];
  if (hit && Date.now() - hit.at < 60000) return hit.text;
  const text = fetch(ROOT + file, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(file + ' ' + r.status); return r.text(); });
  text.catch(() => { delete cache[file]; });
  cache[file] = { at: Date.now(), text };
  return text;
};
const textFor = (btn) => btn.dataset.text != null ? Promise.resolve(btn.dataset.text)
  : btn.dataset.test ? Promise.all(['injection-header.html', btn.dataset.copy, 'injection-footer.html'].map(load)).then((parts) => parts.join(NL))
  : load(btn.dataset.copy);
const done = (btn) => { const was = btn.textContent; btn.textContent = 'Copied'; btn.classList.add('done'); setTimeout(() => { btn.textContent = was; btn.classList.remove('done'); }, 1600); };
const dialog = document.getElementById('manual');
document.getElementById('manual-close').addEventListener('click', () => dialog.close());
function manual(text) { const t = dialog.querySelector('textarea'); t.value = text; dialog.showModal(); t.focus(); t.select(); }
async function copy(btn) {
  const pending = textFor(btn);
  try {
    // ClipboardItem takes the text while it's still loading, which keeps the click's permission (Safari needs this)
    if (window.ClipboardItem && navigator.clipboard?.write) {
      await navigator.clipboard.write([new ClipboardItem({ 'text/plain': pending.then((t) => new Blob([t], { type: 'text/plain' })) })]);
    } else {
      await navigator.clipboard.writeText(await pending);
    }
    done(btn);
  } catch (e) {
    try { manual(await pending); } catch (err) { alertBox('Couldn’t load that file (' + err.message + '). Refresh the page and try again.'); }
  }
}
function alertBox(msg) { const p = document.getElementById('err'); p.textContent = msg; p.hidden = false; }
document.addEventListener('click', (e) => { const b = e.target.closest('[data-copy],[data-text]'); if (b) copy(b); });
['injection-header.html', 'injection-footer.html'].forEach((f) => load(f).catch(() => {}));
fetch(ROOT + 'kit.json', { cache: 'no-cache' }).then((r) => r.json()).then((kit) => {
  document.getElementById('gen').textContent = 'Generated ' + new Date(kit.generated).toLocaleString('en-CA');
  const list = document.getElementById('pages');
  const pages = kit.pages.slice().sort((a, b) => a.path.localeCompare(b.path));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  list.innerHTML = pages.map((p) => '<div class="card" data-find="' + esc((p.path + ' ' + p.title).toLowerCase()) + '">' +
    '<b>' + esc(p.title || p.path) + '</b><div class="btns"><button data-copy="blocks/' + p.key + '.html">Copy code block</button>' +
    '<button class="ghost" data-text="' + esc(p.description) + '">Copy description</button>' +
    '<button class="ghost" data-copy="blocks/' + p.key + '.html" data-test="1">Test version</button></div>' +
    '<span class="addr">' + esc(p.path) + '</span><span class="meta">' + Math.round(p.size / 1024) + ' KB · ' + esc(p.description) + '</span></div>').join('');
  pages.forEach((p) => load('blocks/' + p.key + '.html').catch(() => {}));
  document.getElementById('find').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    list.querySelectorAll('.card').forEach((c) => { c.hidden = q && !c.dataset.find.includes(q); });
  });
}).catch((e) => alertBox('The page list didn’t load (' + e.message + '). Refresh the page.'));
</script></body></html>
`;
}
