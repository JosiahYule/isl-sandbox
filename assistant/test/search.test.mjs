// Runs the search the way the AI would, against the real feed, so we can
// see what the bot would be handed for some typical candidates.
// Run with:  node test/search.test.mjs data/feed.json
import fs from "node:fs";
import { normalizeFeed, searchJobs, getJobDetails } from "../supabase/functions/_shared/jobs.js";
import { runTool } from "../supabase/functions/_shared/assistant.js";

const jobs = normalizeFeed(JSON.parse(fs.readFileSync(process.argv[2], "utf8")));
let failures = 0;
const check = (label, ok) => { console.log((ok ? "  PASS " : "  FAIL ") + label); if (!ok) failures++; };
const show = (r) => r.results.map((j) => `    ${j.title} | ${j.employment} | ${j.location} | ${j.pay}`).join("\n");

console.log("1. Warehouse worker in Dartmouth, wants permanent");
let r = searchJobs(jobs, { keywords: ["warehouse", "forklift", "shipping", "receiving", "material handler", "inventory"], city: "Dartmouth", employment: "permanent" });
console.log(show(r));
check("only permanent or temp-to-perm", r.results.every((j) => j.employment !== "Temporary / contract"));
check("finds Shipper/Receiver", r.results.some((j) => j.title === "Shipper/Receiver"));

console.log("\n2. Cook from Halifax area, any job type");
r = searchJobs(jobs, { keywords: ["cook", "kitchen", "food", "hospitality"], city: "Halifax" });
console.log(show(r));
check("Line Cook (Dartmouth) ranks first, because Halifax area includes Dartmouth", r.results[0]?.title === "Line Cook");

console.log("\n3. Accounting/payroll in New Brunswick");
r = searchJobs(jobs, { keywords: ["payroll", "accounts payable", "bookkeeping", "accounting"], province: "New Brunswick" });
console.log(show(r));
check("only NB jobs", r.results.every((j) => j.location.endsWith("NB")));
check("finds Scoudouc payroll role", r.results.some((j) => j.title === "Payroll Administrator"));

console.log("\n4. Something we don't have (nurse in PEI) falls back gracefully");
r = searchJobs(jobs, { keywords: ["nurse", "rn", "healthcare"], province: "PE" });
console.log("   note:", r.note);
check("fallback note present", Boolean(r.note));
check("fallback still only PE", r.results.every((j) => j.location.endsWith("PE")));

console.log("\n5. Job details and recommendations");
const d = getJobDetails(jobs, "LL1912859814");
check("details include a readable description", d.description.length > 200 && !d.description.includes("<"));
const state = {};
runTool("recommend_jobs", { picks: [{ job_id: "LL1912859814", reason: "Matches your line cook experience." }, { job_id: "FAKE123", reason: "x" }] }, jobs, state);
check("fake ids are dropped, real one becomes a card", state.cards.length === 1 && state.cards[0].applyUrl.includes("rpid="));
console.log("    card:", JSON.stringify(state.cards[0]));
let threw = false; try { runTool("recommend_jobs", { picks: [{ job_id: "NOPE", reason: "x" }] }, jobs, {}); } catch { threw = true; }
check("all-fake recommendation is refused", threw);

console.log(failures ? `\n${failures} failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
