// Simulates the Supabase function with fake Avionte + fake Claude responses.
// Run: node test/edge.sim.mjs <bundled edge.js> data/feed.json
import fs from "node:fs";
const [bundle, feedPath] = process.argv.slice(2);
const feed = JSON.parse(fs.readFileSync(feedPath, "utf8"));
let handler;
const env = { ANTHROPIC_API_KEY: "test", AVIONTE_FEED_URL: "https://feed.test" };
globalThis.Deno = { env: { get: (k) => env[k] }, serve: (h) => { handler = h; } };

const claudeCalls = [];
const script = [
  { stop_reason: "tool_use", content: [{ type: "text", text: "Let me look." }, { type: "tool_use", id: "t1", name: "search_jobs", input: { keywords: ["forklift", "warehouse", "shipping"], city: "Dartmouth", employment: "permanent" } }] },
  { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t2", name: "recommend_jobs", input: { picks: [{ job_id: "LL885290929", reason: "Your forklift and warehouse years fit shipping and receiving." }] } }] },
  { stop_reason: "end_turn", content: [{ type: "text", text: "I found a permanent Shipper/Receiver role in Dartmouth that fits your experience." }] },
];
globalThis.fetch = async (url, opts) => {
  if (url === "https://feed.test") return new Response(JSON.stringify(feed));
  claudeCalls.push(JSON.parse(opts.body));
  return new Response(JSON.stringify(script[claudeCalls.length - 1]));
};
await import(bundle);

const req = (body, origin = "https://www.integratedstaffing.ca") => new Request("https://x/functions/v1/isl-job-chat", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
const res = await handler(req({ messages: [{ role: "user", content: "5 years forklift in Dartmouth, want permanent" }] }));
const out = await res.json();
const ok = (l, c) => { console.log((c ? "PASS " : "FAIL ") + l); if (!c) process.exitCode = 1; };
ok("status 200", res.status === 200);
ok("3 round trips to Claude", claudeCalls.length === 3);
ok("tool results were sent back to Claude", JSON.stringify(claudeCalls[1].messages).includes("tool_result"));
ok("search results reached Claude", JSON.stringify(claudeCalls[1].messages).includes("Shipper/Receiver"));
ok("reply is only the final text", out.reply.startsWith("I found"));
ok("one job card returned", out.jobs.length === 1 && out.jobs[0].title === "Shipper/Receiver");
ok("CORS echoes the ISL origin", res.headers.get("access-control-allow-origin") === "https://www.integratedstaffing.ca");
const bad = await handler(req({ messages: [{ role: "assistant", content: "hi" }] }));
ok("conversation must end with the visitor (400)", bad.status === 400);
const pre = await handler(new Request("https://x", { method: "OPTIONS", headers: { origin: "https://evil.example" } }));
ok("other websites don't get their origin approved", pre.headers.get("access-control-allow-origin") !== "https://evil.example");
console.log("card:", JSON.stringify(out.jobs[0]));
