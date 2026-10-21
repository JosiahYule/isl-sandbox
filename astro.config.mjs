// Astro's settings file.
// `site` + `base` tell Astro where the sandbox is hosted: https://josiahyule.github.io/isl-sandbox/
// If you ever host it at the root of a domain, delete `base` and update `site`.
import { defineConfig } from 'astro/config';
import { writeFileSync, renameSync, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const site = 'https://josiahyule.github.io';
const base = '/isl-sandbox';

// SITEMAP: after every build, list every page Astro actually made, so the sitemap can
// never fall out of date (new jobs, people and tools appear in it automatically).
// The 404 page, robots.txt and the redirects file are left out; they aren't pages to index.
const sitemap = {
  name: 'isl-sitemap',
  hooks: {
    'astro:build:done': ({ pages, dir }) => {
      const urls = pages
        .map((p) => p.pathname)
        .filter((p) => !/^(404|robots\.txt|redirects\.txt)\/?$/.test(p))
        .map((p) => `${site}${base}/${p}`.replace(/\/+$/, '/'))
        .sort();
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`;
      writeFileSync(fileURLToPath(new URL('sitemap.xml', dir)), xml);
      // Netlify and Cloudflare look for a file named exactly _redirects (src/pages/redirects.txt.js)
      const r = fileURLToPath(new URL('redirects.txt', dir));
      if (existsSync(r)) renameSync(r, fileURLToPath(new URL('_redirects', dir)));
    },
  },
};

// TYPOGRAPHY: curly apostrophes in the text people read ("you’ll", "St. John’s").
// Copy comes from many places (pages, data files, the job feed), so rather than retype it all,
// the built pages are tidied once at the end. Only text between tags changes: attributes, scripts,
// styles, code and form fields are left exactly as they were, so nothing that matches on text breaks.
const typography = {
  name: 'isl-typography',
  hooks: {
    'astro:build:done': ({ dir }) => {
      const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.html') ? [p] : []; });
      // Split into: whole raw-text elements (script, style, textarea, pre, code), single tags, and text.
      // Raw-text elements are taken whole, because code inside them can contain < and >.
      const TOKENS = /(<(script|style|textarea|pre|code)\b[\s\S]*?<\/\2>|<[^>]+>)/i;
      for (const file of walk(fileURLToPath(dir))) {
        const parts = readFileSync(file, 'utf8').split(new RegExp(TOKENS.source, 'gi'));
        for (let i = 0; i < parts.length; i += 3) {
          // split() with two capture groups gives [text, token, tagName, text, token, tagName, ...]
          parts[i] = (parts[i] || '').replace(/(\w)(?:'|&#39;|&#x27;)(\w)/g, '$1’$2');
        }
        for (let i = 2; i < parts.length; i += 3) parts[i] = ''; // drop the captured tag names
        writeFileSync(file, parts.join(''));
      }
    },
  },
};

export default defineConfig({ site, base, integrations: [sitemap, typography] });
