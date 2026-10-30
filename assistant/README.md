# ISL Assistant

A chat window for integratedstaffing.ca with two jobs:

- **Job seekers:** match them to open postings from the Avionte feed, and get them to Apply.
- **Employers:** take a request like "3 labourers in rural Nova Scotia", ask only for what's missing (role, place, contract or permanent, start date), then hand them to the right person at ISL with the request form already filled in.

Both can also ask what a role pays ("what do forklift operators make in NB?", answered from ISL's open jobs) and what an employee really costs ("what would a $20/hour worker cost me?", the True cost calculator's maths). On a job's own page it answers questions about that posting ("what are the hours?") from the posting itself, and hands off to the recruiter when the posting doesn't say.

## What's in here

| Path | What it is |
|---|---|
| `supabase/functions/isl-job-chat/index.ts` | The backend. Receives the chat, talks to Claude, runs the tools, sends back a reply and job cards. |
| `supabase/functions/_shared/jobs.js` | Cleans the Avionte feed and searches it. No AI in here. |
| `supabase/functions/_shared/assistant.js` | The bot's instructions and the tools it may call. Edit the tone and rules here. |
| `supabase/functions/_shared/routing.js` | **Who handles what.** The offices, the people, and the rules that pick one for each request. |
| `supabase/functions/_shared/routing.js` → `DUTIES` | **Who looks after what inside ISL** ("who's in charge of marketing?"). One line per topic, naming team members by their team page slug. |
| `supabase/functions/_shared/directory.js` | The team (names, titles, phones, emails, photos), generated from the website's team data by `npm run sync-assistant`. Don't edit it by hand. |
| `supabase/functions/_shared/insights.js` | Pay on open jobs for a role, the true cost of an employee, and answers from one posting. No AI in here. |
| `supabase/functions/_shared/pay.js`, `payroll.js`, `jobtext.js` | The same pay, payroll and posting-reading code the website's tools use (the site imports them from here). |
| `demo-engine.js` | The conversation without AI (rule-based), used until the backend is live. Same search and routing. It understands job seekers, employers, people already working through ISL (pay, T4s, hours, a missed shift, an injury), office and people questions, and who ISL can place (Canadian citizens and permanent residents). Its everyday-word list (`SYNONYMS`) is where to teach it new words. |
| `demo-mode.js` | Starts the widget in demo mode on the website. |
| `widget/widget.js` | The chat bubble that goes on the website. |
| `test/` | Tests you can run with Node. `conversation.test.mjs` plays scripted chats through the demo engine. |
| `supabase/functions/chat-miss/` | Saves a message the chat couldn't understand (contact details stripped by `_shared/redact.js`), so its rules can learn. |
| `supabase/functions/job-alerts/` | Job-alert sign-ups from the chat: saves them, emails a confirmation link, handles confirm and unsubscribe. Words and emails in `_shared/alerts.js`. |
| `supabase/migrations/` | The two tables those functions use (`chat_misses`, `job_alerts`). Run once in Supabase. |
| `demo/` | Builds the preview page (`node demo/build.mjs data/feed.json`). |

## Accountant Staffing and Administrative Staffing

The same assistant runs on all three sites. The page says which brand it is (`<html data-brand="as">`:
Base.astro sets it in the sandbox, `src/squarespace/core.js` on Squarespace), and `profileFor()` in
`demo-engine.js` holds what differs:

| | ISL | AS and ADS |
|---|---|---|
| Requests go to | the named recruiter (`RULES`) | the office that covers the province (`routeSpecialist`): Halifax for NS and PEI, Moncton for NB, St. John's for NL, Halifax for anywhere else |
| Services | Contract staffing, Direct hire | Temporary recruitment, Permanent recruitment |
| Terms | 90-day replacement on permanent hires | No upfront fees; one all-inclusive hourly rate; one-time fee on first-year compensation; six-month guarantee (their FAQ pages) |
| Jobs | the Avionte feed | the saved sample postings (`src/brands/jobs/as.json`, `ads.json`) until Tracker RMS is connected. They carry no pay, so pay questions go to the office |
| "Who's in charge of…" | everyone on the team page | marketing (Josiah, at josiah@accountantstaffing.com); anything else goes to the Halifax office, since their team pages aren't up yet |
| After hours | the response coordinators' numbers | office hours only |

Work a brand doesn't do goes to the sister company that does: warehouse or labour work on AS or ADS goes to
Integrated Staffing (employers get ISL's recruiter for the area), accounting on ADS to Accountant Staffing,
and office roles on AS to Administrative Staffing. The chat window takes each brand's name, mark and colours
from `BRANDS` in `widget/widget.js`.

When the AS and ADS team pages are filled in, add their people to the directory and widen their `duties`
in `profileFor()`, and the bot will name people the way it does on ISL.

## French

The chat works in French and English. Each conversation follows the visitor: French in, French out,
and it switches if they switch. The window starts in French when the visitor's browser is set to French,
and the greeting has a Français / English button.

- **Understanding French:** `FRENCH` in `demo-engine.js` turns French words and phrases into the English
  words the rules already understand. To teach it a new French word, add a line there.
- **Replies:** every reply is written in both languages with `L('English', 'Français')`. Buttons are written
  once in English and translated in one place (`BUTTONS_FR`); tapped French buttons are read back to English.
- **The window's own labels** (View job, Apply, Your request...) are in `UI` and `GREETINGS_FR` in `widget/widget.js`.
- Job titles and posting text come from the job feed and stay in English. Staff job titles stay as they are on the team page.
- The request form a French conversation fills in stays in English (the form and recruiters' inboxes are English), with a note that the visitor wrote in French.
- Have a French-speaking colleague read through the French replies before launch.

## Opening hours and urgent requests

Offices are open 8:30 to 4:30, Monday to Friday. Outside those hours the bot gives the response coordinators'
numbers, taken from the team data (anyone whose title is Response Coordinator), so it stays in step with the team page.

## Who gets the request (routing)

`routing.js` decides who an employer is handed to. It never guesses: the bot can only hand out people listed there.

| Request | Goes to |
|---|---|
| Permanent (direct hire), anywhere | Zowie Tucker |
| Contract, Nova Scotia | Meg Antonick (Halifax office) |
| Contract, New Brunswick | Kelli Wetmore (Moncton line; Saint John line for Saint John, Quispamsis, Rothesay, Sussex, Fredericton) |
| Contract, PEI | Chance Skauge (Charlottetown office) |
| Contract, Newfoundland and Labrador | Crystal Murphy (St. John's office) |
| Contract outside Atlantic Canada | Chance Skauge (`OUTSIDE_PERSON` in routing.js) |
| Job seeker questions, Halifax | Skylar Hardwick |

**To change who handles an office**, edit `PEOPLE` and the matching line in `RULES`, for example:

```js
{ audience: "employer", office: "moncton", person: "jane" },
```

Rules are read top to bottom and the first match wins.

## The tools, in conversation

The chat answers with the same figures as the website's tools, so the two never disagree:

| Asked | Answer | Comes from |
|---|---|---|
| "What do forklift operators make in NB?" | Pay card | Pay on our open jobs (`_shared/insights.js`) |
| "What would a $20/hour worker cost me?" | True cost card | True cost calculator (`_shared/payroll.js`) |
| "What's minimum wage in PEI?", "is $16.50 legal in Nova Scotia?" | Minimum wage card | `src/lib/minwage.js` |
| "What's unemployment like in NB?", "is it hard to hire in Moncton?" | Labour market card, with a link to the Atlantic jobs report | `src/data/lfs/latest.json` |

They chain on what the visitor already said. After an employer's request, "What would they really cost?"
works out the cost from what we pay for that role in that province. After a minimum wage answer, "What would one
cost me?" uses that rate. A wage under the province's minimum is pointed out in a cost answer and after a request.

`scripts/sync-assistant.mjs` copies the minimum wages and the latest survey figures into
`_shared/market-data.js` (the chat and the AI backend both read it; `_shared/market.js` turns it into answers).
The jobs report workflow refreshes it when Statistics Canada releases a new month. When the minimum wages change
(April and October), update `src/lib/minwage.js`, including `MIN_WAGE_CHECKED`, and the chat follows.
The AI backend has the same two as tools: `minimum_wage` and `labour_market`.

## Learning from what it misses

The chat runs on rules, so it only gets better when someone sees what it didn't understand.

- **Counting (Google Analytics, only with the visitor's consent):** `chat_open`, `chat_intent` (job seeker, employer or
  someone already working through us), `chat_fallback` (it didn't understand), `chat_request_ready` (an employer request
  is ready to send) and `job_alert_signup`. Apply, phone, email and request clicks made inside the chat carry
  `via: assistant`, so you can see what the chat itself brings in. Only these labels are sent, never what anyone typed
  (`src/lib/tracking.js` decides what may reach Google).
- **The misses themselves:** when the chat can't understand a message, the window sends that one message to the
  `chat-miss` function, which removes email addresses, phone numbers, long numbers and postal codes, then saves it.
  They're kept 180 days. Once a month run `node scripts/chat-misses.mjs` (with `SUPABASE_URL` and
  `SUPABASE_SERVICE_ROLE_KEY` set) for the list, most common first, and teach the engine the words:
  `SYNONYMS` for kinds of work, `FRENCH` for French phrases, `FAQ` for questions. Add a scripted test for each.
- **Switching it on:** run the migration, deploy `chat-miss`, then set the repo variable `CHAT_MISS_ENDPOINT` to its URL
  (Settings > Secrets and variables > Actions > Variables). Until then nothing is sent; the counting still works.

## Job alerts (Integrated Staffing)

Under search results the chat offers "Email me jobs like these" ("Email me when one opens" when nothing matches yet).
The visitor gives their email and ticks a consent box, and the search they just ran is saved.

1. `job-alerts` saves the sign-up as pending and emails a confirmation link (double opt-in, so nobody can sign up
   someone else, and the confirmation is the consent record CASL asks for).
2. Every morning `.github/workflows/job-alerts.yml` refreshes the jobs and runs `scripts/send-job-alerts.mjs`, which runs
   each confirmed search through the chat's own search (`rankJobs` in `demo-engine.js`) and emails only jobs that are new
   and not sent before. Every email names the sender with its mailing address and has an unsubscribe link plus the
   one-click unsubscribe header. Unsubscribing deletes the email address and the search.
3. Without the set-up below, the sign-up runs as a preview in the chat ("Preview only: nothing was sent"), like the request form.

Only Integrated Staffing offers alerts, because its job feed is live. Accountant Staffing and Administrative Staffing
can get them once their Tracker RMS feeds are connected.

To switch it on: run the migration; deploy `job-alerts` with the secrets `RESEND_API_KEY` and `ALERTS_FROM`; set the repo
variable `ISL_ALERTS_ENDPOINT` to its URL; add the repo secrets `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`RESEND_API_KEY` and `ALERTS_FROM` for the morning email. Try the morning email without sending anything:
`node scripts/send-job-alerts.mjs --dry-run test/fixtures/alerts.json`.

## The moving parts

```
Visitor's browser                 Supabase edge function                 Outside services
-----------------                 ----------------------                 ----------------
widget.js  --- conversation --->  isl-job-chat
                                     | load jobs (cached 10 min) ------>  Avionte JSON feed
                                     | send chat + tools -------------->  Claude API
                                     | <-- "please run search_jobs"
                                     | run search (jobs.js)
                                     | send results back -------------->  Claude API
                                     | <-- final reply
widget.js  <-- reply + job cards --  (done)
```

The API key lives only in Supabase. The browser never sees it, which is why the bubble talks to Supabase instead of straight to Claude.

## Setup

The sandbox currently uses the scripted demo engine. These functions must be deployed and
configured before live chat or recruiter-email delivery is enabled.

1. **Get a Claude API key** from console.anthropic.com. Set a monthly spend limit there while testing.
2. **Create the function** in the Supabase project chosen for this website:
   ```
   supabase functions deploy isl-job-chat --no-verify-jwt
   ```
   `--no-verify-jwt` lets anonymous website visitors call it. Requests carrying a foreign browser
   Origin are rejected. CORS is a browser control, not authentication: a non-browser client can
   omit or spoof Origin. The bounded per-instance rate limiter is a basic brake, not a global
   quota. Configure gateway abuse controls and provider spending limits before enabling paid chat.
3. **Add the secrets** (Supabase dashboard > Edge Functions > Secrets, or the CLI):
   ```
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   supabase secrets set AVIONTE_FEED_URL="https://myavionte.com/staff/jsonjobsv3.aspx?ID=...&proc=getalljobs"
   ```
4. **Host `widget.js`** somewhere public. Your GitHub Pages account (the one that hosts the Tracker CSS) works well.
5. **Add it to Squarespace**, Settings > Advanced > Code Injection > Footer:
   ```html
   <script src="https://YOUR-GITHUB-PAGES/widget.js"
           data-endpoint="https://YOUR-PROJECT.supabase.co/functions/v1/isl-job-chat" defer></script>
   ```
   Test on a single hidden page first by putting the same snippet in that page's Page Header Code Injection instead.

## Before going live, confirm

- The **apply and job-detail URL formats** at the top of `jobs.js` (`SITE`). They're built from your job board work but should be clicked through on the real site.
- The **Employers** wording in `assistant.js` points people somewhere real.
- `SITE.hirePath` and `SITE.toolsPath` in `jobs.js`: the request form and the tools are only on the sandbox so far.
- The payroll rates in `payroll.js` each January, and the pay-in-job-ads rules in `src/lib/jobad.js` when a province changes them (Nova Scotia and Newfoundland and Labrador are expected to).

## Running the tests

From the repository root, `npm test` builds all three brands, runs the DOM, feed, request and
chat endpoint regression tests with mocked providers, then checks the scripted conversations.
No test sends a recruiter email or calls a paid model.

```
node test/search.test.mjs data/feed.json     # search quality on real postings
node test/edge.sim.mjs <bundled edge.js> data/feed.json   # full backend loop with a fake Claude
node --experimental-strip-types test/edge.tools.sim.mjs   # pay and cost tools, job-page context, caching, rate limit
node test/conversation.test.mjs                           # scripted chats through the demo engine (run npm run sync-assistant first)
```

## The request form (isl-request)

`supabase/functions/isl-request/index.ts` sends the website's "Tell us who you need" form to the
recruiter the page names (the same routing.js the chatbot uses), by email through Resend.

1. In Resend, verify the sending domain (integratedstaffing.ca) if it isn't already.
2. Add the secrets in Supabase:
   ```
   supabase secrets set RESEND_API_KEY=re_...
   supabase secrets set REQUEST_FROM="Integrated Staffing website <website@integratedstaffing.ca>"
   supabase secrets set REQUEST_CC=info@integratedstaffing.ca     # optional
   ```
3. Deploy: `supabase functions deploy isl-request --no-verify-jwt`
4. Set the GitHub Actions variable `ISL_REQUEST_ENDPOINT` to the function URL (or the brand's
   `forms.requestEndpoint` in `src/brands/isl.js`) and push.
   Until then the form shows its confirmation and says nothing was sent.

The request handler limits payload size, rejects invalid input, uses the lead reference as the
Resend idempotency key and waits for a provider receipt before acknowledging acceptance. A send
has a 10-second deadline; the browser restores the form for retry after 15 seconds. Repeating an
unchanged request keeps the same reference and payload. Provider acceptance does not prove inbox
delivery: verify Resend delivery events and an actual recruiter inbox during launch checks.
