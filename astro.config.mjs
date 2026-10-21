// Astro's settings file.
// `site` + `base` tell Astro where the sandbox is hosted: https://josiahyule.github.io/isl-sandbox/
// If you ever host it at the root of a domain, delete `base` and update `site`.
import { defineConfig } from 'astro/config';
import { writeFileSync, renameSync, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// THREE BRANDS, ONE CODEBASE
// Each build makes one brand's site. BRAND picks which (isl is the default):
//   npm run build            Integrated Staffing      -> dist/       (/isl-sandbox/)
//   BRAND=as npm run build   Accountant Staffing      -> dist/as/    (/isl-sandbox/as/)
//   BRAND=ads npm run build  Administrative Staffing  -> dist/ads/   (/isl-sandbox/ads/)
// `npm run build:all` builds all three, ISL first (its build empties dist/, so it has to go first).
// In the sandbox the two specialist sites live in sub-folders of the ISL preview; at launch each
// brand gets its own domain and `base` goes.
const BRAND = process.env.BRAND || 'isl';
if (!['isl', 'as', 'ads'].includes(BRAND)) throw new Error(`Unknown BRAND "${BRAND}". Use isl, as or ads.`);
const site = 'https://josiahyule.github.io';
const base = BRAND === 'isl' ? '/isl-sandbox' : `/isl-sandbox/${BRAND}`;
const outDir = BRAND === 'isl' ? './dist' : `./dist/${BRAND}`;

// PAGES: src/pages/ holds the pages every brand has (jobs, team, contact, the request form,
// the legal pages), each reading the brand's facts from src/data/site.js. Pages that differ
// by brand live in src/sites/: isl/ for Integrated Staffing, specialist/ for AS and ADS (the
// two share a structure, so they share pages). This adds the right folder's pages to the build.
const pageFolder = { isl: 'isl', as: 'specialist', ads: 'specialist' }[BRAND];
const brandPages = {
  name: 'brand-pages',
  hooks: {
    'astro:config:setup': ({ injectRoute }) => {
      const root = fileURLToPath(new URL(`./src/sites/${pageFolder}/`, import.meta.url));
      const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
      for (const file of walk(root).filter((f) => /\.(astro|js)$/.test(f))) {
        // about.astro -> /about, learn/tools/index.astro -> /learn/tools, redirects.txt.js -> /redirects.txt
        const rel = relative(root, file).replace(/\\/g, '/').replace(/\.(astro|js)$/, '');
        const pattern = '/' + rel.replace(/(^|\/)index$/, '');
        injectRoute({ pattern, entrypoint: `./src/sites/${pageFolder}/${relative(root, file).replace(/\\/g, '/')}` });
      }
    },
  },
};

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

export default defineConfig({
  site, base, outDir,
  integrations: [brandPages, sitemap, typography],
  // __BRAND__ ('isl', 'as' or 'ads') can be read in any page, component or script
  vite: { define: { __BRAND__: JSON.stringify(BRAND) } },
});
