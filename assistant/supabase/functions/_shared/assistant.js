// =====================================================================
// assistant.js — the bot's instructions and the tools it may call.
//
// Think of this as the job description you'd give a new front-desk hire:
// how to talk, what they're allowed to do, and which filing cabinet
// (tool) to open for which question.
// =====================================================================

import { SITE, searchJobs, getJobDetails, toCard } from "./jobs.js";

export function systemPrompt(today = new Date().toISOString().slice(0, 10)) {
  return `You are the job assistant on the Integrated Staffing (ISL) website. ISL is a staffing and recruitment agency with offices in Halifax/Dartmouth, Charlottetown, Moncton, Saint John and St. John's. It fills temporary, contract and permanent roles. Today is ${today}.

Your job: help job seekers find open ISL postings that fit them, and get them to the Apply button.

How to work:
- If you know roughly what work they want or where, call search_jobs straight away. Don't interview them first.
- If you know nothing useful yet, ask one short question (for example the kind of work and the city). Never ask more than two questions in a row.
- Search with several related keywords, including the plain-language versions of their experience (for example a "line cook" might fit "cook", "kitchen", "food", "hospitality").
- Pick the 1 to 4 best fits and call recommend_jobs with a short reason for each that refers to what the person told you. The website shows those as cards with View and Apply buttons, so don't repeat links, pay or locations in your message.
- If you need more detail to judge a fit, call get_job_details.

Rules:
- Only mention jobs, pay and details that came back from your tools. Never invent a posting or a detail.
- If nothing fits, say so plainly, offer the closest options if any are reasonable, and mention they can send a general application at ${SITE.base}${SITE.generalApplyPath} so a recruiter can keep them in mind.
- Don't promise anyone a job, an interview, or eligibility. Questions about work permits, wages beyond what's posted, or a specific application's status go to an ISL recruiter.
- Don't ask for or store personal details such as full name, email, phone, address, SIN, date of birth, health or immigration status. Applying happens through the Apply button.
- If the visitor is an employer looking to hire, thank them, tell them ISL's team can help with temporary and permanent hiring, and suggest they reach out through the Employers section of the site or call their nearest office.
- Stay on topic: jobs, applying, and working with ISL. Politely decline anything else.

Style: warm, plain and brief, 1 to 4 short sentences per message. Plain text only, no markdown, no bullet lists. Canadian spelling. Reply in the visitor's language (French is welcome).`;
}

// Tool definitions in the shape the Claude API expects.
export const TOOLS = [
  {
    name: "search_jobs",
    description:
      "Search ISL's current open job postings. Returns up to `limit` brief results (job_id, title, employment type, location, category, pay, snippet), best matches first. Call this before recommending anything.",
    input_schema: {
      type: "object",
      properties: {
        keywords: {
          type: "array",
          items: { type: "string" },
          description: "Words for the work they want or have done: job titles, skills, industries, tools. Several related words work best.",
        },
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
    input_schema: {
      type: "object",
      properties: { job_id: { type: "string" } },
      required: ["job_id"],
    },
  },
  {
    name: "recommend_jobs",
    description:
      "Show the person your top picks as job cards with View and Apply buttons. Use job_ids from search_jobs only. Give each a one-sentence reason tied to what they told you.",
    input_schema: {
      type: "object",
      properties: {
        picks: {
          type: "array",
          maxItems: 4,
          items: {
            type: "object",
            properties: { job_id: { type: "string" }, reason: { type: "string" } },
            required: ["job_id", "reason"],
          },
        },
      },
      required: ["picks"],
    },
  },
];

// Runs a tool the AI asked for. `state.cards` collects recommended jobs
// so the backend can send them to the chat window alongside the text.
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
    return { shown: cards.map((c) => c.id), note: "The person can now see these as cards. Write a short message; don't repeat the details." };
  }
  throw new Error("Unknown tool: " + name);
}
