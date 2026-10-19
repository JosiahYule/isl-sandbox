// LINK HELPER
// The sandbox is hosted at a sub-folder (josiahyule.github.io/isl-sandbox/), so an
// internal link like "/hire/" must become "/isl-sandbox/hire/". This function adds that
// prefix. Astro supplies the prefix from `base` in astro.config.mjs as import.meta.env.BASE_URL.
//
// url('/hire/')                -> '/isl-sandbox/hire/'
// url('https://example.com')   -> unchanged (external links are left alone)
// url('tel:...'), url('mailto:...') -> unchanged

export function url(path = '/') {
  if (!path.startsWith('/')) return path; // external, tel:, mailto:, #anchors
  const base = import.meta.env.BASE_URL.replace(/\/$/, ''); // '/isl-sandbox'
  return base + path;
}
