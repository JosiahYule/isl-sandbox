// Copies the job assistant files from assistant/ into public/assistant/ so the site can serve them.
// Runs automatically before `npm run dev` and `npm run build` (see package.json).
// Edit the originals in assistant/, never the copies in public/assistant/.
import { mkdirSync, copyFileSync } from 'node:fs';

const out = 'public/assistant';
mkdirSync(out, { recursive: true });
const files = [
  ['assistant/widget/widget.js', 'widget.js'],
  ['assistant/supabase/functions/_shared/jobs.js', 'jobs.js'],
  ['assistant/demo-mode.js', 'demo-mode.js'],
  ['assistant/data/jobs-snapshot.json', 'jobs-snapshot.json'],
];
for (const [from, to] of files) copyFileSync(from, `${out}/${to}`);
console.log(`Copied ${files.length} job assistant files to ${out}/`);
