// Builds demo/index.html: one self-contained page with the job logic, the
// widget, and a snapshot of the feed baked in (artifact pages can't fetch Avionte).
// Run with:  node demo/build.mjs data/feed.json
import fs from "node:fs";
import { normalizeFeed } from "../supabase/functions/_shared/jobs.js";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
// Turn the two ES modules into plain browser script (drop import/export keywords).
const asScript = (src) => src.replace(/^import .*$/gm, "").replace(/^export /gm, "");
const safe = (s) => s.replace(/<\/script/gi, "<\\/script");

const jobs = normalizeFeed(JSON.parse(fs.readFileSync(process.argv[2], "utf8")));
const date = new Date().toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" });

const html = read("./template.html")
  .replace("/*__JOBS_LOGIC__*/", () => safe(asScript(read("../supabase/functions/_shared/jobs.js")) + "\n" + asScript(read("../supabase/functions/_shared/assistant.js"))))
  .replace("/*__WIDGET__*/", () => safe(read("../widget/widget.js")))
  .replace("/*__JOBS_DATA__*/", () => safe(JSON.stringify(jobs)))
  .replace("/*__SNAPSHOT_DATE__*/", date);

fs.writeFileSync(new URL("./index.html", import.meta.url), html);
console.log("Built demo/index.html with", jobs.length, "jobs,", Math.round(html.length / 1024), "KB");
