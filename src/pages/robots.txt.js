// ROBOTS.TXT  →  /robots.txt
// Tells search engines where the sitemap is. Crawling is allowed on purpose: during the preview
// every page carries <meta name="robots" content="noindex"> (Base.astro), and a crawler has to be
// allowed in to read that. At launch, remove the noindex line and this file can stay as it is.
export function GET({ site }) {
  const sitemap = new URL(`${import.meta.env.BASE_URL.replace(/\/$/, '')}/sitemap.xml`, site).href;
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
