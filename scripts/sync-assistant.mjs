// Copies the job assistant files from assistant/ into public/assistant/ so the site can serve them.
// Runs automatically before `npm run dev` and `npm run build` (see package.json).
// Edit the originals in assistant/, never the copies in public/assistant/.
import { mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';

const out = 'public/assistant';
const files = [
  ['assistant/widget/widget.js', 'widget.js'],
  ['assistant/supabase/functions/_shared/jobs.js', 'jobs.js'],
  ['assistant/supabase/functions/_shared/compensation.js', 'compensation.js'],
  ['assistant/supabase/functions/_shared/routing.js', 'routing.js'],
  ['assistant/supabase/functions/_shared/insights.js', 'insights.js'],
  ['assistant/supabase/functions/_shared/pay.js', 'pay.js'],
  ['assistant/supabase/functions/_shared/payroll.js', 'payroll.js'],
  ['assistant/supabase/functions/_shared/jobtext.js', 'jobtext.js'],
  ['assistant/demo-engine.js', 'demo-engine.js'],
  ['assistant/demo-mode.js', 'demo-mode.js'],
  ['assistant/data/jobs-snapshot.json', 'jobs-snapshot.json'],
];
const hash = createHash('sha256');
for (const [from] of files) hash.update(readFileSync(from));
const version = hash.digest('hex').slice(0, 12);
// This folder contains only generated copies, never the editable assistant sources.
rmSync(out, { recursive: true, force: true });
mkdirSync(`${out}/${version}`, { recursive: true });
for (const [from, to] of files) {
  copyFileSync(from, `${out}/${to}`); // stable local paths for the existing assistant tests/demo
  copyFileSync(from, `${out}/${version}/${to}`);
}
writeFileSync(`${out}/version.json`, JSON.stringify({ version }));
console.log(`Copied ${files.length} job assistant files to ${out}/${version}/`);
