# ISL website sandbox

A playground for redesigning the websites of the three sister firms: Integrated Staffing, Accountant Staffing and Administrative Staffing. Nothing here touches the live Squarespace sites. Every change pushed to GitHub rebuilds the previews:

- Integrated Staffing: **https://josiahyule.github.io/isl-sandbox/**
- Accountant Staffing: **https://josiahyule.github.io/isl-sandbox/as/**
- Administrative Staffing: **https://josiahyule.github.io/isl-sandbox/ads/**

## How it works, in plain terms

The site is built with **Astro**. Astro takes the files in `src/` and turns them into ordinary HTML and CSS files in a folder called `dist/`. That `dist/` folder is the actual website. A GitHub Actions workflow (`.github/workflows/deploy.yml`) runs that conversion (the "build") every time you push, then publishes the result to GitHub Pages. You can watch each run in the repo's **Actions** tab.

You never edit `dist/` directly. You edit `src/`, and the build regenerates `dist/`.

There are four ideas to understand.

### 1. Pages: the file name is the URL

Every file in `src/pages/` becomes a page (and so does every file in a brand's folder in `src/sites/`; see "Three brands" below):

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

Facts that appear in many places live in `src/data/` and `src/brands/`:

- `src/brands/isl.js`, `as.js`, `ads.js`: each brand's offices, phone numbers, menu, colours, logo, stats, testimonials and social links. Pages read them through `src/data/site.js`.
- `team.js`: team members
- `industries.js`: industries served
- `posts.js`: blog posts (they link to the live site)

Change a phone number in the brand's file and it updates on every page of that brand's site.

## Three brands, one codebase

The three sites share everything that makes them look and work alike: the layout, the header and footer, the type, the spacing, the job board, the request form, the map. What differs lives in one file per brand, so the sites stay aligned without being copies of each other.

**The build is run once per brand.** A setting called `BRAND` picks which:

| Command | Builds | Into |
| --- | --- | --- |
| `npm run build` | Integrated Staffing | `dist/` |
| `BRAND=as npm run build` | Accountant Staffing | `dist/as/` |
| `BRAND=ads npm run build` | Administrative Staffing | `dist/ads/` |
| `npm run build:all` | all three, ISL first | (the deploy uses this) |

`astro.config.mjs` reads `BRAND` and sets three things from it: the brand's web address prefix (`base`), the output folder, and a constant `__BRAND__` that any file can read. `src/brands/index.js` uses that constant to pick the brand's file, and `src/data/site.js` passes its facts on to the pages. So when a page says `brand.name`, it gets "Integrated Staffing" in one build and "Accountant Staffing" in another, from the same line of code.

**Where pages live:**

- `src/pages/`: pages every brand has, written once (Find work and each job, Team, Contact, the request form, Privacy, Terms, Accessibility, 404).
- `src/sites/isl/`: pages only ISL has, or that ISL words differently (homepage, Contract staffing, Direct hire, About, office pages, industry pages, Learn, the tools list, the Atlantic jobs report and Pay on our open jobs).
- True cost of an employee and Resume check are in `src/pages/learn/tools/`, shared. Job ad check is AS and ADS only (`src/sites/specialist/learn/tools/`): ISL dropped it, since it coaches employers to do what we do. Each brand's `tools` block says which tools it lists and the words around them; AS and ADS leave out the pay tool until their jobs carry pay.
- `src/sites/specialist/`: the same for Accountant and Administrative Staffing, which share these pages because they share a structure (homepage, Employers, Job Seekers, Permanent and Temporary Recruitment FAQ, About Us, Learn). Their words come from the live sites, in `src/brands/copy/as.js` and `ads.js`; each block there says whether it's word for word or still to be replaced with the exact text. Their words come from each brand's file.

A small piece of `astro.config.mjs` (`brandPages`) adds the right `src/sites/` folder's pages to each build.

**What differs, and where it's set:**

- **Colour:** each brand's `colors` can set any design token from `tokens.css` by name (ISL's are the defaults). AS and ADS use the palettes from their live sites' stylesheets: navy for buttons, links and the dark sections; AS's blue and ADS's orange for permanent work and the big figures (deepened on white so text passes contrast). ADS's closing band is its orange.
- **Logo, name and contact details:** the `brand` object in each brand's file.
- **Services and menus:** ISL has Contract staffing and Direct hire; the specialists keep their live sites' menu (Employers, Job Seekers, Job Opportunities, About Us, Our Team, Contact Us) and page addresses (/employers/, /job-seekers/, /permanent-recruitment/, /temporary-recruitment/). Each brand's `services` names them, and the job board, job pages and request form use those names. The colour key stays the same everywhere: near-black square for contract or temporary, brand colour circle for permanent.
- **The field:** AS and ADS have a `field` block with their roles at each level (junior, intermediate, senior), headline and story.
- **Jobs:** ISL reads its Avionte feed. AS and ADS use a saved sample (`src/brands/jobs/as.json`, `ads.json`) until their board reads Tracker RMS.
- **Team:** ISL's people are in `team.js`. AS and ADS show their offices on the Team page until their people are added.

A sandbox-only line at the bottom of every footer links the three previews, so you can compare them. Remove it at launch.

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
| `Steps` | A numbered sequence on one line that fills from first step to last (hire process, direct hire search). |
| `UnitChart` | 100 dots with 92 filled: the retention figure as something you can see. |
| `Facts` | A row of key figures that count up (contract page, About). |
| `HeroFigure` | The one number on the right of an inner page's intro (Hire, Find work, Team, Learn, Contact). |
| `ToolCards` | The free tools, each previewed with real numbers from the tool itself. |

The map shapes are generated data in `src/data/maps.js` (Natural Earth boundaries). `scripts/generate-maps.mjs` rebuilds them if the framing ever needs to change.

## The Atlantic jobs report (updates itself)

`/learn/tools/jobs-report/` turns Statistics Canada's monthly Labour Force Survey into charts for the four Atlantic provinces: unemployment on a map, jobs gained or lost over the year, two years of unemployment against Canada, out of every 100 adults (working, looking, neither), young people, industries and wages (with each province's minimum wage from `src/lib/minwage.js`).

How the monthly update works:

1. `.github/workflows/update-lfs.yml` runs on GitHub every hour. It has to run there: this sandbox can't reach Statistics Canada.
2. It runs `scripts/fetch-lfs.mjs`, which downloads three tables as CSV files (14-10-0287, 14-10-0355, 14-10-0063), keeps Canada and the Atlantic provinces, and writes `src/data/lfs/latest.json`.
3. If the month in that file is new, the workflow commits it and starts a deploy. Otherwise it does nothing. If Statistics Canada's site is down, it keeps the figures it has and tries again at the next run.
4. `src/lib/lfs.js` reads the file for the page and its tool card. Until the first file arrives, the page says the report is on its way.

The survey comes out once a month (usually the first Friday, 8:30 am Eastern), so the page changes within a few hours of each release.

## Motion

All the entrance animations come from one small system, so they feel like one family:

- **What moves:** section headings rise into place; rows of items come in one after another while the rule above each one draws in from the left; numbers marked `data-countup` count up from zero.
- **How:** `src/scripts/motion.js` watches for elements scrolling into view (an IntersectionObserver, which is the browser telling us, instead of us checking on every scroll) and adds the class `is-in`. The CSS in `global.css` and each component does the animating.
- **Accessibility:** it only runs when `<html>` has the class `motion`. `Base.astro` adds that only if the visitor hasn't asked their device to reduce motion. Without it, or without JavaScript, everything is simply shown in its final state.
- **To animate something new:** add `data-reveal` (rises in), `data-stagger` (its children come in one by one) or `data-countup` (a number counts up).

## Folder map

```
src/
  pages/        pages every brand has (file name = URL)
  sites/        pages that differ by brand: isl/ and specialist/ (AS and ADS)
  brands/       one file per brand (isl.js, as.js, ads.js), what AS and ADS share
                (specialist.js), and their sample jobs (jobs/)
  layouts/      Base.astro, the frame around every page
  components/   Header, Footer, Button, PageHero, CtaBand, AtlanticMap, CanadaMap,
                IndustryMatrix, JobRow, Photo
  data/         site.js (the brand being built), team, industries, jobs, office areas,
                blog posts, map shapes
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
- **Office areas** in `src/data/areas.js` decide which towns count as "near" each office for the Jobs near links. Check them with each office.
- **The scam notice** in the footer is placeholder wording for ISL to approve.
- **Accountant and Administrative Staffing:** the jobs are a sample (no descriptions or pay yet), the team isn't in yet, there are no client quotes, the photos are stock, and the Administrative Staffing logo is a small stand-in until there's an SVG or large PNG.
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


## Search, pay review and enquiry measurement

Job-board searches match individual words across the role, skills and location. Keywords and all filters stay in the URL, including job type, and Clear search removes all of them without deleting campaign tags.

The pay resolver compares the feed with the complete set of advertised base-pay tiers. Consistent ranges stay visible. Conflicting numerical rates are withheld across listings, job pages, pay tools and the assistant; candidates see **Confirm pay with recruiter**. Correct the original fields or ad in Avionte and the next refresh restores the rate. The saved snapshot is not rewritten to guess the answer. Every build produces `.astro/pay-review.json`, the GitHub Actions summary lists the affected job IDs, and the `job-pay-review` workflow artifact is available for download.

The homepage has an employer action beside the job search. The mobile header keeps Hire staff visible, the menu opens with hiring/call actions and collapsed secondary groups, and the assistant launcher yields to form and application controls.

Enquiry attribution and separate employer/candidate events are implemented in the shared analytics script. Sandbox confirmations do not generate leads. See [measurement setup and recruiter outcomes](docs/measurement.md) for the event definitions, per-brand build variables, consent handling and the trusted-side outcome import tool. Live GA4 collection and delivery still require the actual measurement ID and delivery endpoint; the sandbox defaults stay off.

Run `npm test` to build all three brands, test job/search/pay behaviour, execute the built pages' scripts against their HTML, simulate form delivery with a fake email transport, and run the assistant conversations. These checks run before every GitHub Pages deployment.
