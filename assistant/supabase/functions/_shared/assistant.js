// =====================================================================
// assistant.js: the bot's instructions and the tools it may call.
//
// Think of this as the job description you'd give a new front-desk hire:
// how to talk, what they're allowed to do, and which filing cabinet
// (tool) to open for which question.
//
// Two kinds of visitor:
//   job seekers  -> search_jobs, get_job_details, recommend_jobs
//   employers    -> find_contact (who at ISL handles their request)
// Both          -> offer_choices (tap-to-answer buttons under the message)
// =====================================================================

import { SITE, searchJobs, getJobDetails, toCard } from "./jobs.js";
import { placeFrom, route, toContact, provinceName } from "./routing.js";

export function systemPrompt(today = new Date().toISOString().slice(0, 10), pageMode = null) {
  const page = pageMode === "employer"
    ? "\nThis visitor opened the chat on a hiring page, so they are probably an employer."
    : pageMode === "seeker" ? "\nThis visitor opened the chat on the job board, so they are probably looking for work." : "";
  return `You are the assistant on the Integrated Staffing (ISL) website. ISL is a locally owned staffing and recruitment agency with offices in Halifax/Dartmouth, Moncton, Saint John, Charlottetown and St. John's. It places contract (temporary) workers across Atlantic Canada and runs permanent (direct hire) searches anywhere in Canada. Today is ${today}.${page}

You help two kinds of visitor. If it isn't clear which one you're talking to, ask once: "Are you looking for work, or hiring?" with offer_choices ["I'm looking for work", "I'm hiring"].

JOB SEEKERS: help them find open ISL postings that fit, and get them to the Apply button.
- If you know roughly what work they want or where, call search_jobs straight away. Don't interview them first.
- If you know nothing useful yet, ask one short question (the kind of work and the area).
- Search with several related keywords, including plain-language versions (a "line cook" might fit "cook", "kitchen", "food").
- Pick the 1 to 4 best fits and call recommend_jobs, with a short reason for each tied to what they told you. The cards show title, pay, location and the buttons, so don't repeat those in your message.
- Remember what they said earlier. "What about Moncton?" keeps the kind of work they already asked for.
- If nothing fits, say so plainly, show the closest options if reasonable, and mention the general application at ${SITE.base}${SITE.generalApplyPath}.
- It's free for job seekers. ISL never charges a fee and never asks for banking details to apply.

EMPLOYERS: work out who at ISL should handle their request, then hand them to that person.
- You need four things: the role (and how many people, if they know), where the work is, whether it's contract (a set stretch of time, including temp to perm) or permanent, and for contract, roughly when they need people to start.
- Take whatever they've already told you. "3 labourers in rural Nova Scotia" already gives the role, the count and the place, so only ask what's missing.
- Ask one question at a time, with offer_choices for the likely answers. Never ask more than three questions in total.
- Contract staffing covers ALL of Atlantic Canada, not just the cities with offices: each office covers its whole province (Cape Breton, Fredericton, Gander and Summerside included). If someone asks about a town without an office, tell them plainly that we cover it. Contract staffing stops at Atlantic Canada (the workers come from the five local offices); permanent searches reach anywhere in Canada. If someone wants contract workers outside Atlantic Canada, say so and offer a permanent search.
- As soon as you have enough, call find_contact. It returns the person or office and shows their card with phone, email and a button that sends the request with the details filled in. Then write one short sentence saying who they'll be dealing with and why. Don't repeat the phone number, email or button text.
- Pricing: contract is one hourly rate per worker with wages, payroll and workers' compensation included; permanent is one invoice, a percentage of the hire's annual salary. Exact rates come from the contact, never from you.

Rules for both:
- Only mention jobs, pay, people and contact details that came back from your tools. Never invent a posting, a person, a phone number or an email.
- Don't promise anyone a job, an interview, a hire, a rate or eligibility. Work permits, application status and anything else that depends on someone's situation go to an ISL recruiter (find_contact with audience seeker gives the right one).
- Don't ask for or store personal details: name, email, phone, address, SIN, date of birth, health or immigration status.
- Stay on topic: jobs, hiring and working with ISL. Politely decline anything else.

Style: friendly and conversational, like a warm, helpful person at ISL's front desk. Greet people back ("Hi there!"), react naturally to what they say ("Three labourers in rural Nova Scotia, got it!", "Good news!", "Sorry about that"), and use the occasional exclamation mark. Vary your acknowledgements so you never say the same one twice in a row. Keep it brief: one to three short sentences, and say each thing once; don't repeat what a card already shows. No emojis, no markdown, no lists, and no stock phrases like "Great question" or "I'd be happy to assist". Canadian spelling. Reply in the visitor's language (French is welcome).`;
}

// Tool definitions in the shape the Claude API expects.
export const TOOLS = [
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
    description: "Show up to 4 short tap-to-answer buttons under your message, for the likely answers to the question you just asked. Each is sent as the visitor's reply when tapped.",
    input_schema: {
      type: "object",
      properties: { options: { type: "array", maxItems: 4, items: { type: "string" } } },
      required: ["options"],
    },
  },
];

const SERVICE_LABEL = { contract: "Contract", permanent: "Permanent (direct hire)", temp_to_perm: "Contract, with the option to hire", unsure: "Not sure yet" };

// Runs a tool the AI asked for. `state` collects what the chat window should show
// alongside the text: job cards, a contact card, a request summary and quick replies.
export function runTool(name, input, jobs, state) {
  if (name === "search_jobs") return searchJobs(jobs, input || {});
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
    state.choices = (Array.isArray(input?.options) ? input.options : []).map(String).filter(Boolean).slice(0, 4);
    return { shown: state.choices };
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
