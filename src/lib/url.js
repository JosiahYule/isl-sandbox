// LINK HELPER
// The sandbox is hosted at a sub-folder (josiahyule.github.io/isl-sandbox/), so an
// internal link like "/hire/" must become "/isl-sandbox/hire/". This function adds that
// prefix. Astro supplies the prefix from `base` in astro.config.mjs as import.meta.env.BASE_URL.
//
// url('/hire/')                -> '/isl-sandbox/hire/'
// url('https://example.com')   -> unchanged (external links are left alone)
// url('tel:...'), url('mailto:...') -> unchanged

// SQUARESPACE BUILDS (SITE_MODE=squarespace): pages live on the brand's own domain, so page links stay
// as they are ('/hire/'), but files (images, the chat assistant) are served from GitHub Pages and need
// its full address. A path is a file when it has an extension or sits in one of the file folders.
const SQ_ASSETS = typeof __SQ__ !== 'undefined' && __SQ__ ? __SQ_ASSETS__ : '';
export const isFilePath = (path) => /^\/(assistant|images|brands|_astro)\//.test(path) || /\.(?!html?$)[a-z0-9]{2,5}$/i.test(path.split(/[?#]/)[0]);

export function url(path = '/') {
  if (!path.startsWith('/')) return path; // external, tel:, mailto:, #anchors
  if (SQ_ASSETS) return isFilePath(path) ? SQ_ASSETS + path : path;
  const base = import.meta.env.BASE_URL.replace(/\/$/, ''); // '/isl-sandbox'
  return base + path;
}
