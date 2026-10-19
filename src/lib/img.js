// IMAGE HELPERS for photos stored on Squarespace's image server.
// Squarespace resizes on request: adding ?format=750w returns the image 750px wide.
// We use that to build a srcset, so phones download small files and big screens get sharp ones.

const WIDTHS = [500, 750, 1000, 1500, 2500];

// The image URL at a given width, e.g. sized(url, 750) -> url?format=750w
export function sized(url, width) {
  return `${url.split('?')[0]}?format=${width}w`;
}

// "url?format=500w 500w, url?format=750w 750w, ..." up to maxWidth
export function srcset(url, maxWidth = 2500) {
  return WIDTHS.filter((w) => w <= maxWidth).map((w) => `${sized(url, w)} ${w}w`).join(', ');
}
