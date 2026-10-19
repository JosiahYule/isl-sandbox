# ISL website sandbox

A private playground for redesigning the Integrated Staffing website. Nothing here touches the live Squarespace site. Every change pushed to GitHub rebuilds a preview link on Cloudflare Pages.

## How it works, in plain terms

The site is built with **Astro**. Astro takes the files in `src/` and turns them into ordinary HTML and CSS files in a folder called `dist/`. That `dist/` folder is the actual website. Cloudflare runs that conversion (the "build") every time you push, then serves the result.

You never edit `dist/` directly. You edit `src/`, and the build regenerates `dist/`.

There are four ideas to understand.

### 1. Pages: the file name is the URL

Every file in `src/pages/` becomes a page:

| File | URL |
| --- | --- |
| `src/pages/index.astro` | `/` (homepage) |
| `src/pages/hire.astro` | `/hire/` |
| `src/pages/direct-hire.astro` | `/direct-hire/` |

To add a page, create a new file there. `src/pages/moncton.astro` would become `/moncton/`.

### 2. Components: write it once, use it everywhere

A component is a reusable piece of a page, stored in `src/components/`. The header is one file, `Header.astro`, and every page uses it. Change the header once and it changes on every page. That's the main difference from plain HTML, where each page would carry its own copy.

You use a component like an HTML tag:

```astro
<Button href="/hire/">Request talent</Button>
```

An `.astro` file has two parts. The top, between the `---` lines, is JavaScript that runs at build time (importing things, preparing data). Below that is the HTML, and an optional `<style>` block. Styles inside a component only apply to that component, so they can't accidentally break other parts of the page.

### 3. The layout: the frame around every page

`src/layouts/Base.astro` holds what every page shares: the `<head>`, the header and the footer. Each page wraps its content in `<Base>...</Base>`, and the content drops in where the layout says `<slot />`.

### 4. Data files: one source of truth

Facts that appear in many places live in `src/data/`:

- `site.js`: offices, phone numbers, the navigation menu, stats, testimonials, social links, logo and image URLs
- `team.js`: team members
- `industries.js`: industries served
- `posts.js`: blog posts (they link to the live site)

Change a phone number in `site.js` and it updates on every page that shows it.

## Where to start a redesign

1. **`src/styles/tokens.css`**: the design "knobs": colours, fonts, sizes, spacing, corner rounding. The colours are neutral placeholders. Put in ISL's real brand colours first and the whole site picks them up.
2. **`src/styles/global.css`**: base styles for headings, links and shared helpers like `.card` and `.section`.
3. **Individual components and pages**: once the tokens feel right, reshape sections one at a time.

## Folder map

```
src/
  pages/        one file per page (file name = URL)
  layouts/      Base.astro, the frame around every page
  components/   Header, Footer, Button, PageHero, Stats, Testimonials, CtaBand, Offices
  data/         site facts, team, industries, blog posts
  styles/       tokens.css (design knobs) and global.css (base styles)
astro.config.mjs  Astro settings (rarely touched)
package.json      project name, scripts, and the Astro dependency
```

## Things that are placeholders

- **Brand colours and fonts** in `tokens.css`
- **Job listings** on `/find-work/` are samples. The real Avionte feed comes later.
- **The request form** on `/hire/` shows a confirmation but doesn't send anything yet.
- **Team roles and photos** in `team.js` are mostly blank.
- **Images** load from Squarespace's image server. Before this ever goes live, they should be downloaded into a `public/` folder.
- Items marked `TODO` in the code need a decision (for example, which Moncton address is current).

## Previews

Every push to the `main` branch updates the main preview link. If you push a different branch (say, `homepage-v2`), Cloudflare gives it its own preview link. That lets you try a direction without losing the current one.

Every page includes `<meta name="robots" content="noindex">`, so search engines won't index the sandbox.

## Running it on your own computer (optional)

You don't need this to use the sandbox, but it gives instant previews while you edit. You'll need [Node.js](https://nodejs.org) (the LTS version) installed. Then, in a terminal inside this folder:

```
npm install      # downloads Astro into node_modules/ (first time only)
npm run dev      # starts a local preview at http://localhost:4321
```

Leave `npm run dev` running. Every time you save a file, the browser updates.
