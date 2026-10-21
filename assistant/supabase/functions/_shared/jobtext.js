// JOB DESCRIPTION → PAGE BLOCKS
// The feed gives each description as plain text, one line per paragraph, heading or bullet
// (the HTML is stripped by assistant/.../jobs.js). Recruiters format postings by hand, so the
// same kind of line shows up in different ways. This turns the text back into structure:
//
//   "KEY RESPONSIBILITIES"            -> heading   (short line in capitals)
//   "Responsibilities:"               -> heading   (short line ending in a colon)
//   "Compensation & Benefits"         -> heading   (short Title Case line, no full stop)
//   "Pay: $18.00/hour + 4% vacation"  -> detail    (short "Label: value" line)
//   "• Wash dishes ..."               -> list item (consecutive ones become one list)
//   anything else                     -> paragraph
//
// It also leaves out what the page already says or what isn't for job seekers:
//   - the title repeated as the first line (the page's h1 shows it)
//   - Location / Job type lines (the page shows these beside the posting)
//   - tracking codes ("Int001") and hashtags ("#WeRecruit")
//   - the standard closing ISL adds to every posting (About Integrated Staffing, the
//     referral bonus, "Qualified candidates will be contacted..."), which would otherwise
//     repeat word for word on every job page
//
// We build our own blocks instead of using the feed's HTML on the page, so nothing from the
// feed can inject markup into the site, and every posting looks the same.

// Headings in one consistent style: sentence case, keeping short acronyms (PPE, CRA, PEI)
const ACRONYMS = new Set(['PPE', 'CRA', 'PEI', 'NS', 'NB', 'NL', 'ISL', 'WHMIS', 'CDL', 'AZ', 'DZ', 'TDG', 'CPR', 'IT', 'HR', 'AP', 'AR', 'CPA']);
function headingCase(text) {
  const words = text.replace(/:$/, '').trim().split(/\s+/);
  return words.map((w, i) => {
    const bare = w.replace(/[^A-Za-z]/g, '');
    if (ACRONYMS.has(bare.toUpperCase()) && bare === bare.toUpperCase()) return w;
    if (bare === 'I') return w;
    const lower = w.toLowerCase();
    return i === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
  }).join(' ');
}

const SMALL = new Set(['and', 'or', 'of', 'the', 'a', 'an', 'to', 'for', 'in', 'on', 'at', 'with', '&', 'you', 'we']);
function looksLikeTitle(line) {
  if (line.length > 45 || /[.!?,;]$/.test(line)) return false;
  const words = line.split(/\s+/).filter((w) => !SMALL.has(w.toLowerCase()));
  return words.length >= 1 && words.length <= 6 && words.every((w) => /^[A-Z0-9&]/.test(w));
}

const norm = (s) => String(s).toLowerCase().replace(/[^a-z]/g, '').replace(/s$/, '');
const REDUNDANT = /^(location|work location|job type|employment type|role type|position type|job opportunity)$/i;
const CLOSING = /^(refer talent|about integrated staffing)/i;

export function jobBlocks(description = '', title = '') {
  const lines = String(description)
    .split('\n')
    // Some postings run several bullets together on one line
    .flatMap((l) => l.split(/\s(?=•)/))
    // Spacing the feed sometimes adds inside times: "11 :00 p m" -> "11:00 pm"
    .map((l) => l.trim().replace(/(\d)\s+:(\d)/g, '$1:$2').replace(/(\d)\s*([ap])\s+m\b/gi, (m, d, ap) => `${d} ${ap.toLowerCase()}m`))
    .filter(Boolean);

  // The first line is often just the job title again; the page already shows it as the h1
  if (lines[0] && lines[0].length <= 80 && (norm(title).startsWith(norm(lines[0])) || norm(lines[0]).startsWith(norm(title)))) lines.shift();

  const blocks = [];
  for (const line of lines) {
    if (/^int\d+$/i.test(line) || /^(#\w+\s*)+$/.test(line)) continue; // tracking codes, hashtags
    if (CLOSING.test(line)) break; // the standard closing: stop here
    const bullet = line.match(/^[•·\-\*]\s*(.+)$/);
    if (bullet) {
      const last = blocks.at(-1);
      if (last?.type === 'list') last.items.push(bullet[1]);
      else blocks.push({ type: 'list', items: [bullet[1]] });
      continue;
    }
    // "Label: value" before the heading checks, so "Location: Halifax, NS" isn't read as a heading
    const detail = line.match(/^([A-Z][A-Za-z /&']{1,28}):\s+(.+)$/);
    if (detail && line.length <= 140) {
      if (REDUNDANT.test(detail[1].trim())) continue;
      const last = blocks.at(-1);
      const item = { label: detail[1].trim(), value: detail[2] };
      if (last?.type === 'details') last.items.push(item);
      else blocks.push({ type: 'details', items: [item] });
      continue;
    }
    const letters = line.replace(/[^A-Za-z]/g, '');
    if (line.length <= 60 && letters.length > 2 && letters === letters.toUpperCase()) {
      blocks.push({ type: 'heading', text: headingCase(line) });
      continue;
    }
    if ((line.length <= 60 && line.endsWith(':')) || looksLikeTitle(line)) {
      blocks.push({ type: 'heading', text: headingCase(line) });
      continue;
    }
    blocks.push({ type: 'p', text: line });
  }
  while (blocks.at(-1)?.type === 'heading') blocks.pop();
  return blocks;
}

// A short plain summary: the first real paragraph, cut at a word
export function jobSummary(description = '', title = '', max = 160) {
  // Skip "Schedule: ..." style lines; the summary should read as a sentence about the job
  const p = jobBlocks(description, title).find((b) => b.type === 'p' && b.text.length > 40 && !/^[A-Z][\w &/]{1,28}:/.test(b.text));
  const text = p ? p.text : String(description).replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return text.slice(0, max).replace(/\s+\S*$/, '') + '…';
}

// Pay as the recruiter wrote it in the posting ("$18.00/hour + 4% vacation pay"), if there's a
// "Pay:" style line. It's often more complete than the feed's pay fields, which can be empty.
export const PAY_LABEL = /^(pay|pay rate|wage|wages|compensation|salary|hourly rate|rate)$/i;
export function payFromBlocks(blocks) {
  for (const b of blocks) if (b.type === 'details') for (const i of b.items) if (PAY_LABEL.test(i.label)) return i.value;
  return '';
}
