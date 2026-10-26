// COPY SQUARESPACE IMAGES INTO THE REPO  (node scripts/copy-images.mjs, after npm run build:all)
// Most photos, the ISL logo and the team headshots still load from Squarespace's image server,
// which stops working when the Squarespace subscription ends. This finds every Squarespace image
// the built sites use (dist/), downloads it at each width the pages ask for, saves it in
// public/images/cms/, and lists it in src/data/cms-images.json. src/lib/img.js then points the
// pages at those copies. Run it again whenever new Squarespace images are added.
//
// It runs on GitHub (.github/workflows/copy-images.yml), because this sandbox can't reach
// Squarespace. Images already copied are skipped, so a re-run only fetches what's new.
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const CDN = 'https://images.squarespace-cdn.com/content/v1/691490c94119776708e69bbe/';
const OUT = 'public/images/cms';
const MANIFEST = 'src/data/cms-images.json';
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg' };

process.on('uncaughtException', (e) => { console.log(`::error::${e.stack || e.message}`.replace(/\n/g, ' ')); process.exit(1); });

// 1. Every Squarespace image URL in the built pages and scripts, with the widths asked for
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const found = new Map(); // path -> Set of widths
const re = /https:\/\/images\.squarespace-cdn\.com\/content\/v1\/691490c94119776708e69bbe\/([^"'\s)?,\\]+)(?:\?format=(\d+)w)?/g;
for (const file of walk('dist').filter((f) => /\.(html|js|json|xml)$/.test(f))) {
  for (const m of readFileSync(file, 'utf8').matchAll(re)) {
    const path = m[1];
    if (!/^[^/]+\/[^/]+/.test(path)) continue; // a URL still being put together in a script (folder only), not an image
    if (!found.has(path)) found.set(path, new Set());
    found.get(path).add(Number(m[2]) || 1500);
  }
}
console.log(`Found ${found.size} Squarespace images in the build`);

// 2. A readable file name: the original file name plus the start of its folder id, so names never clash
const nameFor = (path) => {
  const [dir, file] = path.split('/');
  const base = decodeURIComponent(file.replace(/\+/g, ' ')).replace(/\.[a-z0-9]+$/i, '')
    .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'image';
  return `${base}-${dir.replace(/[^a-z0-9]/gi, '').slice(0, 8).toLowerCase()}`;
};

// 3. Download what's missing
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
mkdirSync(OUT, { recursive: true });
let fetched = 0, failed = 0;
const reasons = [];
for (const [path, widthSet] of found) {
  const entry = manifest[path] ?? { name: nameFor(path), ext: '', widths: [] };
  const widths = [...widthSet].sort((a, b) => a - b);
  for (const w of widths) {
    if (entry.widths.includes(w)) continue;
    try {
      const res = await fetch(`${CDN}${path}?format=${w}w`, { headers: { 'User-Agent': 'isl-sandbox image copy (github.com/JosiahYule/isl-sandbox)' } });
      const type = (res.headers.get('content-type') || '').split(';')[0];
      if (!res.ok || !EXT[type]) throw new Error(`HTTP ${res.status} ${type}`);
      entry.ext ||= EXT[type];
      writeFileSync(join(OUT, `${entry.name}-${w}w.${entry.ext}`), Buffer.from(await res.arrayBuffer()));
      entry.widths.push(w); fetched++;
    } catch (e) {
      failed++; if (reasons.length < 3) reasons.push(`${path} at ${w}w: ${e.message}${e.cause ? ` (${e.cause.code || e.cause.message})` : ''}`);
    }
  }
  entry.widths.sort((a, b) => a - b);
  if (entry.widths.length) manifest[path] = entry;
}
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + '\n');
console.log(`::notice::Copied ${fetched} image files (${Object.keys(manifest).length} images listed, ${failed} failed)${reasons.length ? `. First failures: ${reasons.join('; ')}` : ''}`);
if (failed && !fetched) process.exit(1);
