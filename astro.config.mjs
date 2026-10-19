// Astro's settings file.
// `site` + `base` tell Astro where the sandbox is hosted: https://josiahyule.github.io/isl-sandbox/
// If you ever host it at the root of a domain, delete `base` and update `site`.
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://josiahyule.github.io',
  base: '/isl-sandbox',
});
