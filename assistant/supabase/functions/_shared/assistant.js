// =====================================================================
// assistant.js: the bot's instructions and the tools it may call.
//
// Think of this as the job description you'd give a new front-desk hire:
// how to talk, what they're allowed to do, and which filing cabinet
// (tool) to open for which question.
//
// Two kinds of visitor:
//   job seekers  -> search_jobs, get_job_details, recommend_jobs
//   employers    -> find_contact (who at ISL handles their request), true_cost_of_employee
// Both          -> pay_on_open_jobs, offer_choices (tap-to-answer buttons under the message)
//
// On a job page the widget also says which posting the visitor is reading, so
// "what are the hours?" is answered from that posting.
// =====================================================================

import { SITE, searchJobs, getJobDetails, toCard } from "./jobs.js";
import { placeFrom, route, toContact, provinceName } from "./routing.js";
import { payFor, payInsight, costFor, costInsight } from "./insights.js";

const siteUrl = (path) => SITE.base + path;
// Pages the assistant may show as link buttons (offer_choices `links`). A fixed list, so it can't invent a URL.
const LINKS = {
  resume_check: { label: "Check my resume", href: siteUrl(SITE.toolsPath + "resume-check/") },
  job_ad_check: { label: "Check a job ad", href: siteUrl(SITE.toolsPath + "job-ad-check/") },
  pay_tool: { label: "Pay on our open jobs", href: siteUrl(SITE.toolsPath + "pay-on-open-jobs/") },
  cost_tool: { label: "True cost calculator", href: siteUrl(SITE.toolsPath + "true-cost-of-an-employee/") },
  general_apply: { label: "Send my resume", href: SITE.base + SITE.generalApplyPath },
};

// The instructions in two parts. The first never changes, so the Claude API can cache it
// (cheaper and faster on every message after the first). The second holds today's date and
// what the page told us, which change from visitor to visitor.
export function systemPrompt(today = new Date().toISOString().slice(0, 10), pageMode = null, job = null) {
  return [STATIC_PROMPT, pagePrompt(today, pageMode, job)];
}

function pagePrompt(today, pageMode, job) {
  const lines = [`Today is ${today}.`];
  if (pageMode === "employer") lines.push("This visitor opened the chat on a hiring page, so they are probably an employer.");
  if (pageMode === "seeker") lines.push("This visitor opened the chat on the job board, so they are probably looking for work.");
  if (job) lines.push(`The visitor is reading the posting for "${job.title}" in ${[job.city, job.province].filter(Boolean).join(", ")} (job_id ${job.id}). When they say "this job", "the hours", "the pay" and so on, they mean this posting: call get_job_details with job_id ${job.id} and answer from it in a sentence or two. If the posting doesn't say, tell them so and offer the recruiter (find_contact, audience seeker, with the job's place). To apply, they use the Apply button on the page.`);
  return lines.join("\n");
}

const STATIC_PROMPT = `You are the assistant on the Integrated Staffing (ISL) website. ISL is a locally owned staffing and recruitment agency with offices in Halifax/Dartmouth, Moncton, Saint John, Charlottetown and St. John's. It places contract (temporary) workers across Atlantic Canada and runs permanent (direct hire) searches anywhere in Canada.

You help two kinds of visitor. If it isn't clear which one you're talking to, ask once: "Are you looking for work, or hiring?" with offer_choices ["I'm looking for work", "I'm hiring"].

JOB SEEKERS: help them find open ISL postings that fit, and get them to the Apply button.
- If you know roughly what work they want or where, call search_jobs straight away. Don't interview them first.
- If you know nothing useful yet, ask one short question (the kind of work and the area).
- Search with several related keywords, including plain-language versions (a "line cook" might fit "cook", "kitchen", "food").
- Pick the 1 to 4 best fits and call recommend_jobs, with a short reason for each tied to what they told you. The cards show title, pay, location and the buttons, so don't repeat those in your message.
- Remember what they said earlier. "What about Moncton?" keeps the kind of work they already asked for.
- If nothing fits, say so plainly, show the closest options if reasonable, and offer the general application (offer_choices link general_apply).
- It's free for job seekers. ISL never charges a fee and never asks for banking details to apply.

EMPLOYERS: work out who at ISL should handle their request, then hand them to that person.
- You need four things: the role (and how many people, if they know), where the work is, whether it's contract (a set stretch of time, including temp to perm) or permanent, and for contract, roughly when they need people to start.
- Take whatever they've already told you. "3 labourers in rural Nova Scotia" already gives the role, the count and the place, so only ask what's missing.
- Ask one question at a time, with offer_choices for the likely answers. Never ask more than three questions in total.
- Contract staffing covers ALL of Atlantic Canada, not just the cities with offices: each office covers its whole province (Cape Breton, Fredericton, Gander and Summerside included). If someone asks about a town without an office, tell them plainly that we cover it. Contract staffing stops at Atlantic Canada (the workers come from the five local offices); permanent searches reach anywhere in Canada. If someone wants contract workers outside Atlantic Canada, say so and offer a permanent search.
- As soon as you have enough, call find_contact. It returns the person or office and shows their card with phone, email and a button that sends the request with the details filled in. Then write one short sentence saying who they'll be dealing with and why. Don't repeat the phone number, email or button text.
- Pricing: contract is one hourly rate per worker with wages, payroll and workers' compensation included; permanent is one invoice, a percentage of the hire's annual salary. Exact rates come from the contact, never from you.
- When an employer asks what an employee really costs them (CPP, EI, workers' comp, vacation, paid holidays), call true_cost_of_employee. If they haven't given a wage, use the middle figure from pay_on_open_jobs for the role, and say that's the wage you used. It's an estimate with the province's average workers' comp rate, not a quote, and it's separate from ISL's rate.
- For feedback on a job ad they've written, point them to the Job ad check (offer_choices link job_ad_check): it scores the ad, checks pay against ISL's open jobs and flags the provinces that require pay in the ad.

PAY (both): when anyone asks what a role pays, or what to offer, call pay_on_open_jobs. It only knows ISL's own open postings, so say it's from our open jobs and how many, never "the market". If it returns nothing, say so and offer the pay tool (offer_choices link pay_tool). The card shows the figure and range, so don't repeat them; add one useful sentence instead.
RESUMES: never ask anyone to paste a resume into this chat (it's full of personal details). The Resume check (offer_choices link resume_check) scores it, suggests fixes and lists the open jobs it fits, all inside their browser.

Rules for both:
- Only mention jobs, pay, people and contact details that came back from your tools. Never invent a posting, a person, a phone number or an email.
- Don't promise anyone a job, an interview, a hire, a rate or eligibility. Work permits, application status and anything else that depends on someone's situation go to an ISL recruiter (find_contact with audience seeker gives the right one).
- Don't ask for or store personal details: name, email, phone, address, SIN, date of birth, health or immigration status.
- Stay on topic: jobs, hiring and working with ISL. Politely decline anything else.

Style: friendly and conversational, like a warm, helpful person at ISL's front desk. Greet people back ("Hi there!"), react naturally to what they say ("Three labourers in rural Nova Scotia, got it!", "Good news!", "Sorry about that"), and use the occasional exclamation mark. Vary your acknowledgements so you never say the same one twice in a row. Keep it brief: one to three short sentences, and say each thing once; don't repeat what a card already shows. No emojis, no markdown, no lists, and no stock phrases like "Great question" or "I'd be happy to assist". Canadian spelling. Reply in the visitor's language (French is welcome).`;

// Tool definitions in the shape the Claude API expects.
export const TOOLS = [
  {
    name: "pay_on_open_jobs",
    description:
      "What ISL's open jobs pay for a role: the middle figure, the range and how many jobs it's based on, and shows it as a card. Matches the role's words in job titles, in the province first; when there are too few, it widens to all of Atlantic Canada or to the role's family (e.g. 'Warehouse and logistics') and says so in `basis` and `widened`. Returns null when nothing comparable is open.",
    input_schema: {
      type: "object",
      properties: {
        role: { type: "string", description: "The role in plain words, e.g. 'forklift operator', 'line cook', 'controller'." },
        province: { type: "string", description: "Province name or code, if they said one." },
      },
      required: ["role"],
    },
  },
  {
    name: "true_cost_of_employee",
    description:
      "What one hour actually worked costs an employer once vacation pay, paid holidays, CPP, EI and workers' comp are added, using 2026 rates, and shows it as a card with a link to the full calculator.",
    input_schema: {
      type: "object",
      properties: {
        hourly_wage: { type: "number", description: "The hourly wage, e.g. 20." },
        hours_per_week: { type: "number", description: "Scheduled hours a week. Default 40." },
        province: { type: "string", enum: ["NS", "NB", "PE", "NL"], description: "Default NS." },
      },
      required: ["hourly_wage"],
    },
  },
  {
    name: "search_jobs",
    description:
      "Search ISL's current open job postings. Returns up to `limit` brief results (job_id, title, employment type, location, category, pay, snippet), best matches first. matched_in says whether the keywords hit the title, category or only the description. Call this before recommending anything.",
    input_schema: {
      type: "object",
      properties: {
        keywords: { type: "array", items: { type: "string" }, description: "Words for the work they want or have done: job titles, skills, industries, tools. Several related words work best." },
        province: { type: "string", description: "Province name or code (NS, NB, PE, NL...). Leave out if they didn't say or are open to anywhere." },
        city: { type: "string", description: "City or area they want to work in. Nearby towns are ranked first." },
        employment: { type: "string", enum: ["permanent", "temporary", "any"], description: "Permanent, temporary/contract, or any." },
        limit: { type: "integer", description: "How many results to return, 1 to 15. Default 8." },
      },
    },
  },
  {
    name: "get_job_details",
    description: "Get the full description of one posting by its job_id, when you need detail to judge a fit or answer a question about it.",
    input_schema: { type: "object", properties: { job_id: { type: "string" } }, required: ["job_id"] },
  },
  {
    name: "recommend_jobs",
    description: "Show the job seeker your top picks as job cards with View and Apply buttons. Use job_ids from search_jobs only. Give each a one-sentence reason tied to what they told you.",
    input_schema: {
      type: "object",
      properties: {
        picks: { type: "array", maxItems: 4, items: { type: "object", properties: { job_id: { type: "string" }, reason: { type: "string" } }, required: ["job_id", "reason"] } },
      },
      required: ["picks"],
    },
  },
  {
    name: "find_contact",
    description:
      "Find the right person or office at ISL and show their contact card. For employers, call this once you know the role, the place and contract vs permanent. For job seekers, use it when they need a recruiter (work permits, application status).",
    input_schema: {
      type: "object",
      properties: {
        audience: { type: "string", enum: ["employer", "seeker"] },
        service: { type: "string", enum: ["contract", "permanent", "temp_to_perm", "unsure"], description: "Employers only." },
        place: { type: "string", description: "Where the work is, in the visitor's words, e.g. 'rural Nova Scotia', 'Quispamsis', 'Toronto'." },
        role: { type: "string", description: "Employers: the role, e.g. 'labourers', 'a controller'." },
        headcount: { type: "integer", description: "Employers: how many people, if they said." },
        start: { type: "string", description: "Employers (contract): when they need people, in plain words, e.g. 'as soon as possible'." },
      },
      required: ["audience"],
    },
  },
  {
    name: "offer_choices",
    description: "Show buttons under your message: up to 4 short tap-to-answer replies (`options`, each sent as the visitor's reply when tapped) and up to 2 links to ISL pages (`links`). Never write a URL in your message; use a link button.",
    input_schema: {
      type: "object",
      properties: {
        options: { type: "array", maxItems: 4, items: { type: "string" } },
        links: { type: "array", maxItems: 2, items: { type: "string", enum: Object.keys(LINKS) } },
      },
    },
  },
];

const SERVICE_LABEL = { contract: "Contract", permanent: "Permanent (direct hire)", temp_to_perm: "Contract, with the option to hire", unsure: "Not sure yet" };

// Runs a tool the AI asked for. `state` collects what the chat window should show
// alongside the text: job cards, a contact card, a request summary and quick replies.
export function runTool(name, input, jobs, state) {
  if (name === "search_jobs") return searchJobs(jobs, input || {});
  if (name === "pay_on_open_jobs") {
    const r = payFor(jobs, { role: input?.role, province: input?.province });
    if (!r) return { result: null, note: "No open ISL jobs are comparable. Say so plainly; don't guess a figure." };
    state.insight = payInsight(r, siteUrl);
    const { examples, ...summary } = r;
    return { ...summary, examples, note: "The visitor can see a card with the figure, range and count. Don't repeat them; say where it comes from in a few words." };
  }
  if (name === "true_cost_of_employee") {
    const r = costFor({ wage: input?.hourly_wage, hours: input?.hours_per_week, province: input?.province });
    if (!r) throw new Error("hourly_wage must be a number above 0.");
    state.insight = costInsight(r, siteUrl);
    return { ...r, note: "The visitor can see a card with the cost per hour worked and a link to the full breakdown. Don't repeat the numbers; one short sentence." };
  }
  if (name === "get_job_details") return getJobDetails(jobs, input?.job_id);
  if (name === "recommend_jobs") {
    const picks = Array.isArray(input?.picks) ? input.picks.slice(0, 4) : [];
    const cards = [];
    for (const p of picks) {
      const job = jobs.find((j) => j.id === String(p.job_id));
      if (job) cards.push(toCard(job, p.reason));
    }
    if (!cards.length) throw new Error("None of those job_ids exist. Use ids from search_jobs.");
    state.cards = cards;
    return { shown: cards.map((c) => c.id), note: "The visitor can now see these as cards. Write a short message; don't repeat the details." };
  }
  if (name === "offer_choices") {
    const options = (Array.isArray(input?.options) ? input.options : []).map(String).filter(Boolean).slice(0, 4);
    const links = (Array.isArray(input?.links) ? input.links : []).map((k) => LINKS[k]).filter(Boolean).slice(0, 2);
    state.choices = [...options, ...links];
    return { shown: state.choices.map((c) => (typeof c === "string" ? c : c.label)) };
  }
  if (name === "find_contact") {
    const audience = input?.audience === "seeker" ? "seeker" : "employer";
    const place = placeFrom(input?.place || "");
    const service = input?.service === "permanent" ? "direct" : input?.service === "unsure" ? "unsure" : "contract";
    const r = route({ audience, service: audience === "employer" ? service : undefined, place });
    if (r.unavailable === "contract-outside") {
      return { unavailable: true, note: "ISL's contract staffing is only in Atlantic Canada. Offer a permanent search instead." };
    }
    let action = null;
    if (audience === "employer") {
      const role = String(input?.role || "").trim();
      const count = Number(input?.headcount) > 0 ? `${input.headcount} ` : "";
      const whereRaw = place ? (place.outside ? place.label : place.city ? `${place.city}, ${provinceName(place.province)}` : place.label) : "";
      const where = whereRaw.charAt(0).toUpperCase() + whereRaw.slice(1);
      const details = [`${count}${role}`.trim(), where, SERVICE_LABEL[input?.service] || "", input?.start ? `Start: ${input.start}` : ""].filter(Boolean).join(". ") + ".";
      const params = new URLSearchParams({ service: service === "direct" ? "direct" : "contract", details });
      if (place?.province) params.set("where", provinceName(place.province));
      if (place?.outside) params.set("where", "Elsewhere in Canada");
      action = { label: r.person ? `Send my request to ${r.person.first}` : `Send my request to ${r.office.city}`, href: SITE.base + SITE.hirePath + "?" + params.toString() };
      state.summary = [["Role", `${count}${role}`.trim()], ["Where", where], ["Type", SERVICE_LABEL[input?.service] || ""], ["Start", service === "direct" ? "" : input?.start || ""]].filter(([, v]) => v);
    }
    state.contact = toContact(r, action);
    return {
      shown: true,
      person: r.person ? { name: r.person.name, handles: r.person.handles } : null,
      office: r.office?.city,
      note: "The visitor can now see the contact card with phone, email and a send button. Write one short sentence; don't repeat the details.",
    };
  }
  throw new Error("Unknown tool: " + name);
}
