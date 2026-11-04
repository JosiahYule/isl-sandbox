// COMPRESS THE SAVED IMAGES  (node scripts/compress-images.mjs)
// Re-saves every image in public/images/cms/ that is still heavier than it needs to be (see
// scripts/lib/compress-image.mjs). Safe to run any time: light images are skipped.
// scripts/copy-images.mjs already compresses new copies, so this is only needed for old ones.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compress } from './lib/compress-image.mjs';

const DIR = 'public/images/cms';
let before = 0, after = 0, changed = 0;
for (const f of readdirSync(DIR).filter((f) => f.endsWith('.webp'))) {
  const path = join(DIR, f);
  const original = readFileSync(path);
  const smaller = await compress(original);
  before += original.length;
  after += (smaller ?? original).length;
  if (smaller) { writeFileSync(path, smaller); changed++; }
}
console.log(`compress-images: ${changed} files re-saved, ${(before / 1e6).toFixed(1)} MB -> ${(after / 1e6).toFixed(1)} MB`);
