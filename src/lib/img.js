// IMAGE HELPERS for photos stored on Squarespace's image server.
// Squarespace resizes on request: adding ?format=750w returns the image 750px wide.
// We use that to build a srcset, so phones download small files and big screens get sharp ones.

const WIDTHS = [500, 750, 1000, 1500, 2500];

// The image URL at a given width, e.g. sized(url, 750) -> url?format=750w
// Photos kept in this repo (public/images/) can't be resized on request, so they're saved
// ahead of time at each width as name-500w.jpg, name-750w.jpg ... and we point at the right file.
export function sized(url, width) {
  if (url.startsWith('/')) return url.replace(/\.jpg$/, `-${width}w.jpg`);
  return `${url.split('?')[0]}?format=${width}w`;
}

// "url?format=500w 500w, url?format=750w 750w, ..." up to maxWidth
export function srcset(url, maxWidth = 2500) {
  return WIDTHS.filter((w) => w <= maxWidth).map((w) => `${sized(url, w)} ${w}w`).join(', ');
}
