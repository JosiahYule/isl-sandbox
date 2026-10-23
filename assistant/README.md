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
| `supabase/functions/_shared/insights.js` | Pay on open jobs for a role, the true cost of an employee, and answers from one posting. No AI in here. |
| `supabase/functions/_shared/pay.js`, `payroll.js`, `jobtext.js` | The same pay, payroll and posting-reading code the website's tools use (the site imports them from here). |
| `demo-engine.js` | The conversation without AI (rule-based), used until the backend is live. Same search and routing. |
| `demo-mode.js` | Starts the widget in demo mode on the website. |
| `widget/widget.js` | The chat bubble that goes on the website. |
| `test/` | Tests you can run with Node. `conversation.test.mjs` plays scripted chats through the demo engine. |
| `demo/` | Builds the preview page (`node demo/build.mjs data/feed.json`). |

## Who gets the request (routing)

`routing.js` decides who an employer is handed to. It never guesses: the bot can only hand out people listed there.

| Request | Goes to |
|---|---|
| Permanent (direct hire), anywhere | Zowie Tucker |
| Contract, Nova Scotia | Meg Antonick (Halifax office) |
| Contract, New Brunswick | Kelli Wetmore (Moncton line; Saint John line for Saint John, Quispamsis, Rothesay, Sussex, Fredericton) |
| Contract, PEI | Chance Skauge (Charlottetown office) |
| Contract, Newfoundland and Labrador | Crystal Murphy (St. John's office) |
| Contract outside Atlantic Canada | Not offered; the bot suggests a permanent search |
| Job seeker questions, Halifax | Skylar Hardwick |

**To change who handles an office**, edit `PEOPLE` and the matching line in `RULES`, for example:

```js
{ audience: "employer", office: "moncton", person: "jane" },
```

Rules are read top to bottom and the first match wins.

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
