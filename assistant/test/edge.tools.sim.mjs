// Runs the REAL edge function (isl-job-chat/index.ts) with a fake Avionte feed and a fake Claude,
// to check the parts the AI can't be trusted to test: the new tools, the job-page context,
// prompt caching, link buttons and the rate limit.
//   node --experimental-strip-types assistant/test/edge.tools.sim.mjs
import { readFileSync } from "node:fs";
import { readPay } from "../supabase/functions/_shared/pay.js";

// Turn the saved snapshot back into the shape Avionte sends
const snapshot = JSON.parse(readFileSync(new URL("../data/jobs-snapshot.json", import.meta.url)));
const feed = snapshot.map((j) => {
  const p = readPay(j.pay);
  return { ReqID: j.id, PostId: j.id, Name: j.title, JobType: j.employment === "Permanent" ? "Direct Hire" : "Temp", JobCity: j.city, JobState: j.province,
    Category: j.category, JobDesc: j.description, PostDate: j.posted, PayMin: p?.min ?? "", PayMax: p?.max ?? "" };
});

let handler;
const env = { ANTHROPIC_API_KEY: "test", AVIONTE_FEED_URL: "https://feed.test" };
globalThis.Deno = { env: { get: (k) => env[k] }, serve: (h) => { handler = h; } };
const calls = [];
let script = [];
globalThis.fetch = async (url, opts) => {
  if (url === "https://feed.test") return new Response(JSON.stringify(feed));
  calls.push(JSON.parse(opts.body));
  return new Response(JSON.stringify(script[calls.length - 1] || { stop_reason: "end_turn", content: [{ type: "text", text: "ok" }] }));
};
await import("../supabase/functions/isl-job-chat/index.ts");

const req = (body, ip = "1.1.1.1") => new Request("https://x/functions/v1/isl-job-chat", { method: "POST", headers: { origin: "https://www.integratedstaffing.ca", "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body) });
const ok = (label, cond) => { console.log((cond ? "PASS " : "FAIL ") + label); if (!cond) process.exitCode = 1; };
const toolResult = (call, id) => JSON.parse(call.messages.at(-1).content.find((b) => b.tool_use_id === id).content);

// 1. Pay, then true cost, then link buttons, in one turn
script = [
  { stop_reason: "tool_use", content: [{ type: "tool_use", id: "p1", name: "pay_on_open_jobs", input: { role: "driver", province: "NS" } }] },
  { stop_reason: "tool_use", content: [{ type: "tool_use", id: "c1", name: "true_cost_of_employee", input: { hourly_wage: 20, province: "NS" } },
    { type: "tool_use", id: "o1", name: "offer_choices", input: { options: ["Find me drivers"], links: ["cost_tool", "not_a_real_link"] } }] },
  { stop_reason: "end_turn", content: [{ type: "text", text: "That's from our open driver jobs." }] },
];
let res = await handler(req({ messages: [{ role: "user", content: "what do drivers make in NS and what would one cost me" }] }));
let out = await res.json();
const pay = toolResult(calls[1], "p1");
ok("pay tool answers from open jobs", pay.count >= 2 && pay.figure.endsWith("/hour"));
ok("cost tool: $20 in NS is $23.52", toolResult(calls[2], "c1").perHour.toFixed(2) === "23.52");
ok("the last card shown wins (cost)", out.insight?.figure === "$23.52");
ok("link buttons come from the fixed list only", out.choices.length === 2 && out.choices[1].href?.includes("true-cost-of-an-employee") && !JSON.stringify(out.choices).includes("not_a_real_link"));
ok("prompt caching: fixed instructions marked", calls[0].system[0].cache_control?.type === "ephemeral" && !calls[0].system[1].cache_control);
ok("prompt caching: tools marked once, on the last tool", calls[0].tools.at(-1).cache_control && calls[0].tools.filter((t) => t.cache_control).length === 1);
ok("no URLs in the instructions (link buttons instead)", !/https?:\/\//.test(calls[0].system[0].text.replace(/integratedstaffing\.ca/g, "")));

// 2. On a job page: the posting is named in the instructions
calls.length = 0;
const dock = snapshot.find((j) => /Overnight Dock Worker/.test(j.title));
script = [{ stop_reason: "end_turn", content: [{ type: "text", text: "It's overnight, Sunday to Thursday." }] }];
await (await handler(req({ messages: [{ role: "assistant", content: "hi", meta: { mode: "seeker" } }, { role: "user", content: "what are the hours?" }], context: { job: dock.id } }))).json();
ok("job page: the posting is in the instructions", calls[0].system[1].text.includes(dock.id) && calls[0].system[1].text.includes("Overnight Dock Worker"));
ok("job page: the fixed part doesn't change (still cacheable)", !calls[0].system[0].text.includes(dock.id));
calls.length = 0;
await (await handler(req({ messages: [{ role: "user", content: "hi" }], context: { job: "<script>not-a-job" } }))).json();
ok("job page: an unknown id is ignored", !calls[0].system[1].text.includes("posting"));

// 3. Rate limit: the 31st message in ten minutes from one address is refused
let last;
for (let i = 0; i < 31; i++) { script = []; calls.length = 0; last = await handler(req({ messages: [{ role: "user", content: "hi" }] }, "9.9.9.9")); }
ok("rate limit: 31st message gets 429", last.status === 429);
const other = await handler(req({ messages: [{ role: "user", content: "hi" }] }, "8.8.8.8"));
ok("rate limit: other visitors unaffected", other.status === 200);
