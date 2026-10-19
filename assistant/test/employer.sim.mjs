// Simulates an employer conversation through the backend with a fake Claude.
// Run: node test/employer.sim.mjs <bundled edge.js>
let handler;
const env = { ANTHROPIC_API_KEY: "test", AVIONTE_FEED_URL: "https://feed.test" };
globalThis.Deno = { env: { get: (k) => env[k] }, serve: (h) => { handler = h; } };
const calls = [];
const script = [
  { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "find_contact", input: { audience: "employer", service: "contract", place: "rural Nova Scotia", role: "labourers", headcount: 3, start: "as soon as possible" } }] },
  { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t2", name: "offer_choices", input: { options: ["How contract staffing works", "Start over"] } }] },
  { stop_reason: "end_turn", content: [{ type: "text", text: "Our Halifax office covers all of Nova Scotia, and Meg handles new client requests there." }] },
];
globalThis.fetch = async (url, opts) => {
  if (url === "https://feed.test") return new Response("[]");
  calls.push(JSON.parse(opts.body));
  return new Response(JSON.stringify(script[calls.length - 1]));
};
await import(process.argv[2]);
const res = await handler(new Request("https://x/f", { method: "POST", headers: { origin: "https://www.integratedstaffing.ca", "content-type": "application/json" },
  body: JSON.stringify({ messages: [
    { role: "assistant", content: "Hi. Tell me who you need...", meta: { mode: "employer" } },
    { role: "user", content: "I need 3 labourers in rural Nova Scotia, asap, short term" },
  ] }) }));
const out = await res.json();
const ok = (l, c) => { console.log((c ? "PASS " : "FAIL ") + l); if (!c) process.exitCode = 1; };
ok("status 200", res.status === 200);
ok("page mode reached the prompt", calls[0].system.includes("hiring page"));
ok("contact is Meg", out.contact?.name === "Meg Antonick");
ok("send button pre-fills the form", /service=contract/.test(out.contact?.action?.href || ""));
ok("summary has 4 rows", out.summary?.length === 4);
ok("choices returned", out.choices?.length === 2);
ok("reply text", /Meg/.test(out.reply));
