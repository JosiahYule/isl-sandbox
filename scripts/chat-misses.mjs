// CHAT MISSES: what the chat assistant couldn't understand lately, most common first.
//
// Run it once a month:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/chat-misses.mjs [days]
// (days defaults to 30). For each phrase that comes up, teach the chat the words in
// assistant/demo-engine.js: SYNONYMS for kinds of work, FRENCH for French phrases, FAQ for questions.
// Then add a line to assistant/test/conversation.test.mjs so it stays learned.
import { restClient } from '../assistant/supabase/functions/_shared/db.js';

const days = Number(process.argv[2]) || 30;
const rest = restClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
if (!rest) { console.log('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first (Supabase > Settings > API).'); process.exit(1); }

const since = new Date(Date.now() - days * 864e5).toISOString();
const rows = await rest(`chat_misses?created_at=gte.${since}&select=brand,lang,kind,text&order=created_at.desc&limit=5000`);
// The same message typed slightly differently counts once: lower case, no punctuation
const key = (t) => t.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim();
const groups = new Map();
for (const r of rows) {
  const k = `${r.kind}|${key(r.text)}`;
  const g = groups.get(k) || { ...r, count: 0, brands: new Set() };
  g.count++; g.brands.add(r.brand);
  groups.set(k, g);
}
const list = [...groups.values()].sort((a, b) => b.count - a.count);
console.log(`${rows.length} message(s) the chat didn't understand in the last ${days} days, ${list.length} different.\n`);
for (const kind of ['unclear', 'no-match']) {
  const of = list.filter((g) => g.kind === kind);
  if (!of.length) continue;
  console.log(kind === 'unclear' ? 'Not understood at all:' : 'Kinds of work it had no word for:');
  for (const g of of.slice(0, 40)) console.log(`  ${String(g.count).padStart(3)}  ${g.text}  (${[...g.brands].join(', ')}${g.lang === 'fr' ? ', French' : ''})`);
  console.log('');
}
