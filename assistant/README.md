# ISL Assistant

A chat window for integratedstaffing.ca with two jobs:

- **Job seekers:** match them to open postings from the Avionte feed, and get them to Apply.
- **Employers:** take a request like "3 labourers in rural Nova Scotia", ask only for what's missing (role, place, contract or permanent, start date), then hand them to the right person at ISL with the request form already filled in.

## What's in here

| Path | What it is |
|---|---|
| `supabase/functions/isl-job-chat/index.ts` | The backend. Receives the chat, talks to Claude, runs the tools, sends back a reply and job cards. |
| `supabase/functions/_shared/jobs.js` | Cleans the Avionte feed and searches it. No AI in here. |
| `supabase/functions/_shared/assistant.js` | The bot's instructions and the tools it may call. Edit the tone and rules here. |
| `supabase/functions/_shared/routing.js` | **Who handles what.** The offices, the people, and the rules that pick one for each request. |
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
| Contract, New Brunswick | Moncton office line, or Saint John for Saint John, Quispamsis, Rothesay, Sussex, Fredericton |
| Contract, PEI | Charlottetown office line |
| Contract, Newfoundland and Labrador | St. John's office line |
| Contract outside Atlantic Canada | Not offered; the bot suggests a permanent search |
| Job seeker questions, Halifax | Skylar Hardwick |

**To name a person at another office**, add them to `PEOPLE` and add a line to `RULES`, for example:

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

You've done every one of these steps before on the onboarding portal.

1. **Get a Claude API key** from console.anthropic.com. Set a monthly spend limit there while testing.
2. **Create the function** in a Supabase project (the client portal project is fine, or a new one):
   ```
   supabase functions deploy isl-job-chat --no-verify-jwt
   ```
   `--no-verify-jwt` lets anonymous website visitors call it. The CORS allow-list in `index.ts` is what limits it to your site.
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

## Running the tests

```
node test/search.test.mjs data/feed.json     # search quality on real postings
node test/edge.sim.mjs <bundled edge.js> data/feed.json   # full backend loop with a fake Claude
```
