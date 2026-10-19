# ISL website sandbox

A playground for redesigning the Integrated Staffing website. Nothing here touches the live Squarespace site. Every change pushed to GitHub rebuilds the preview at **https://josiahyule.github.io/isl-sandbox/**.

## How it works, in plain terms

The site is built with **Astro**. Astro takes the files in `src/` and turns them into ordinary HTML and CSS files in a folder called `dist/`. That `dist/` folder is the actual website. A GitHub Actions workflow (`.github/workflows/deploy.yml`) runs that conversion (the "build") every time you push, then publishes the result to GitHub Pages. You can watch each run in the repo's **Actions** tab.

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

### One rule for internal links

The sandbox lives in a sub-folder (`/isl-sandbox/`), so a link written as `/hire/` would point to the wrong place. Wrap internal links in the `url()` helper from `src/lib/url.js`, which adds the prefix:

```astro
---
import { url } from '../lib/url.js';
---
<a href={url('/hire/')}>Hire talent</a>
```

`<Button>`, the header and the footer already do this for you. External links (`https://...`, `tel:`, `mailto:`) don't need it.

## The design system

**Colour has a job.** Two colours carry meaning everywhere on the site:

| Colour | Means | Token |
| --- | --- | --- |
| Hi-vis amber `#FFC20E` | Contract staffing | `--contract` |
| ISL blue `#0070CA` | Direct hire (permanent placement) | `--direct` |

Jobs, industries, timelines and form options all use these two colours, so a visitor learns the key once. Buttons and other controls stay navy so the two colours keep their meaning. Deep harbour navy (`--navy`) carries dark sections and the map.

**Type.** Archivo, set wide and heavy, for headings (its width axis is `--display-stretch`). DM Sans, the ISL brand face, for body text. Both are self-hosted from npm packages, so pages don't wait on Google Fonts.

**All the knobs** live in `src/styles/tokens.css`. Change a value there and the whole site follows.

## The signature pieces

| Component | What it shows |
| --- | --- |
| `AtlanticMap` | Real province shapes with the five offices pinned. Clicking a pin shows that office's address and phone. |
| `CanadaMap` | Atlantic provinces filled (offices), the rest outlined (where permanent searches reach). |
| `HireClock` | Both services on one time axis, to scale: contract within hours, direct hire averaging 47 days, then the 90-day guarantee. |
| `IndustryMatrix` | Every industry, with a marker for each service that covers it. The filter buttons dim what a service doesn't cover. |
| `JobRow` | One job listing, with a coloured edge for its service. |

The map shapes are generated data in `src/data/maps.js` (Natural Earth boundaries). `scripts/generate-maps.mjs` rebuilds them if the framing ever needs to change.

## Folder map

```
src/
  pages/        one file per page (file name = URL)
  layouts/      Base.astro, the frame around every page
  components/   Header, Footer, Button, PageHero, CtaBand, AtlanticMap, CanadaMap,
                HireClock, IndustryMatrix, JobRow
  data/         site facts, team, industries, jobs, blog posts, map shapes
  lib/          url.js, the internal-link helper
  styles/       tokens.css (design knobs) and global.css (base styles)
scripts/        generate-maps.mjs (rebuilds the map shapes)
astro.config.mjs  Astro settings (rarely touched)
package.json      project name, scripts, Astro and the two font packages
```

## Things that are placeholders

- **Job listings** on `/find-work/` and the homepage are samples (`src/data/jobs.js`). The real Avionte feed comes later.
- **The request form** on `/hire/` shows a confirmation but doesn't send anything yet.
- **Team roles and photos** in `team.js` are mostly blank, so cards show initials.
- **The logo and badge images** load from Squarespace's image server. Before this ever goes live, download them into a `public/` folder.
- Items marked `TODO` in the code need a decision: which Moncton address is current, and which retention and review numbers are right.

## Previews

Every push to the `main` branch rebuilds the preview, usually within a minute or two. GitHub Pages hosts one version at a time, so to try a direction without losing the current one, work on a separate branch and merge it into `main` when you like it.

The preview link is public: anyone with the address can open it. Every page includes `<meta name="robots" content="noindex">`, so search engines won't index the sandbox.

## Running it on your own computer (optional)

You don't need this to use the sandbox, but it gives instant previews while you edit. You'll need [Node.js](https://nodejs.org) (the LTS version) installed. Then, in a terminal inside this folder:

```
npm install      # downloads Astro into node_modules/ (first time only)
npm run dev      # starts a local preview at http://localhost:4321
```

Leave `npm run dev` running. Every time you save a file, the browser updates.
