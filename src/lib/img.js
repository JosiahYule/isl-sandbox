// IMAGE HELPERS for photos stored on Squarespace's image server.
// Squarespace resizes on request: adding ?format=750w returns the image 750px wide.
// We use that to build a srcset, so phones download small files and big screens get sharp ones.
//
// COPIES IN THIS REPO: Squarespace's image server goes away with the Squarespace subscription, so
// scripts/copy-images.mjs (run on GitHub by .github/workflows/copy-images.yml) saves every
// Squarespace image the site uses into public/images/cms/, at each width the pages ask for, and lists
// them in src/data/cms-images.json. Once an image is listed there, these helpers point at the copy
// instead of Squarespace. Images not copied yet keep loading from Squarespace, so nothing breaks.
import manifest from '../data/cms-images.json';
import { url as withBase } from './url.js';

const WIDTHS = [500, 750, 1000, 1500, 2500];
const CDN = 'https://images.squarespace-cdn.com/content/v1/691490c94119776708e69bbe/';

// The saved copy of a Squarespace image at (or just above) a width, or null if it isn't copied
function copy(src, width) {
  if (typeof src !== 'string' || !src.startsWith(CDN)) return null;
  const m = manifest[src.slice(CDN.length).split('?')[0]];
  if (!m) return null;
  const w = m.widths.find((x) => x >= width) ?? m.widths.at(-1);
  return withBase(`/images/cms/${m.name}-${w}w.${m.ext}`);
}

// The image URL at a given width, e.g. sized(url, 750) -> url?format=750w (or the saved copy)
// Photos kept in this repo (public/images/) can't be resized on request, so they're saved
// ahead of time at each width as name-500w.jpg, name-750w.jpg ... and we point at the right file.
export function sized(src, width) {
  const saved = copy(src, width);
  if (saved) return saved;
  if (src.startsWith('/')) return src.replace(/\.jpg$/, `-${width}w.jpg`);
  return `${src.split('?')[0]}?format=${width}w`;
}

// A Squarespace URL used as it is (a logo, a headshot): the saved copy at the width it asks for
export function asset(src) {
  if (typeof src !== 'string') return src;
  const width = Number((src.match(/format=(\d+)w/) || [])[1]) || 1500;
  return copy(src, width) ?? src;
}

// "url?format=500w 500w, url?format=750w 750w, ..." up to maxWidth
export function srcset(src, maxWidth = 2500) {
  return WIDTHS.filter((w) => w <= maxWidth).map((w) => `${sized(src, w)} ${w}w`).join(', ');
}
