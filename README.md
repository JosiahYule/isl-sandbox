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

Everything follows the ISL brand (the same tokens as the "editorial minimal" blog system):

| Element | Value |
| --- | --- |
| Font | DM Sans, self-hosted. Headings 700, body 400, intros and large numbers 300 |
| ISL blue | `#0070CA` (hover `#005AAA`): primary buttons, links, active states |
| Near-black | `#1A1A1A`: text and dark sections |
| Hairlines | `#E8E8E8`: the main structural device |
| Label grey | `#888`: larger labels only. Body-size secondary text uses `#666` so it passes contrast |
| Corners | Square. No drop shadows |

**Colour also carries meaning.** Near-black always means contract staffing and ISL blue always means direct hire. Job listings, industries, timelines and form options use these two colours, always next to a text label.

**All the values** live in `src/styles/tokens.css`. Change one there and the whole site follows.

## The signature pieces

| Component | What it shows |
| --- | --- |
| `AtlanticMap` | Real province shapes with the five offices pinned. Clicking a pin shows that office's address and phone. |
| `CanadaMap` | Atlantic provinces filled (offices), the rest outlined (where permanent searches reach). |
| `IndustryMatrix` | Every industry, with a marker for each service that covers it. The filter buttons dim what a service doesn't cover. |
| `JobRow` | One job listing, with a coloured edge for its service. |

The map shapes are generated data in `src/data/maps.js` (Natural Earth boundaries). `scripts/generate-maps.mjs` rebuilds them if the framing ever needs to change.

## Folder map

```
src/
  pages/        one file per page (file name = URL)
  layouts/      Base.astro, the frame around every page
  components/   Header, Footer, Button, PageHero, CtaBand, AtlanticMap, CanadaMap,
                IndustryMatrix, JobRow, Photo
  data/         site facts, team, industries, jobs, blog posts, map shapes
  lib/          url.js, the internal-link helper
  styles/       tokens.css (design knobs) and global.css (base styles)
scripts/        generate-maps.mjs (rebuilds the map shapes)
astro.config.mjs  Astro settings (rarely touched)
package.json      project name, scripts, Astro and the DM Sans font package
```

## Photos

All photos are ISL's own, already on the live site: the team photos from the About page, the warehouse banner and the headshots from each bio page. They load from Squarespace's image server, which resizes on request, so each photo ships in several sizes and the browser picks the right one (`src/lib/img.js`).

- **Where they're listed:** `src/data/photos.js` (team and banner photos) and the `photo` field in `src/data/team.js` (headshots).
- **How they're placed:** the `Photo` component puts each photo in a fixed-shape frame and crops to fit, so layouts never jump. If a crop cuts off the wrong part, change its `position` (for example `position="70% center"` keeps more of the right side).
- **Missing headshots:** Ross, Chance, Erika, Natacha, Michaila, Crystal and Kelli have no headshot on the live site yet, so their cards show initials.

## Job assistant (chatbot)

The chat bubble in the corner is the ISL job assistant from `assistant/` (the same project as the zip: widget, Supabase backend, tests, README).

- **Right now it runs in demo mode** (`assistant/demo-mode.js`): it reads the visitor's message with simple rules, runs the real search code (`assistant/supabase/functions/_shared/jobs.js`) over a snapshot of 53 real postings, and replies from templates. The matching is real; the conversation is simplified, and the panel says so.
- **To make it live:** deploy the backend as described in `assistant/README.md`, add `https://josiahyule.github.io` to the allowed origins in `index.ts`, then in `src/layouts/Base.astro` replace the demo-mode script with `data-endpoint="...your function URL..."` on the widget script.
- **Edit the originals in `assistant/`.** Before every `dev` and `build`, `scripts/sync-assistant.mjs` copies the files the site needs into `public/assistant/` (which isn't committed).
- Any button with `data-open-assistant` opens the chat (used on the homepage and the Find work page).

The same snapshot feeds the job lists on the homepage and Find work page (`src/data/jobs.js`), so View and Apply go to real postings on the live site.

## Things that are placeholders

- **Job listings** are a snapshot of the Avionte feed from October 19, 2026 (`src/data/jobs.js`). A live site would read the feed directly.
- **The request form** on `/hire/` shows a confirmation but doesn't send anything yet.
- **Team roles** in `team.js` are mostly blank.
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
