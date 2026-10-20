// Astro's settings file.
// `site` + `base` tell Astro where the sandbox is hosted: https://josiahyule.github.io/isl-sandbox/
// If you ever host it at the root of a domain, delete `base` and update `site`.
import { defineConfig } from 'astro/config';
import { writeFileSync, renameSync, existsSync } from 'node:fs';
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

export default defineConfig({ site, base, integrations: [sitemap] });
