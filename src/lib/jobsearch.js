// Match every word across the role, skills and location, in any order.
// Punctuation/accents and common Canadian/US spelling should not hide a vacancy.
//
// "Part time" and "full time" are one idea in two words. Searched as two separate words, "part"
// matched "partner" and "time" matched every "full-time" posting, so "part time" found half the
// board. Both the postings and the search join them into one word ("parttime"), however they're
// written ("part time", "part-time", "parttime").
export function searchText(value = '') {
  return String(value).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/['’]/g, '').replace(/\blabor/g, 'labour')
    .replace(/\b(part|full)[\s-]*time\b/g, '$1time')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

export function matchesJobQuery(text, query) {
  const words = searchText(text).split(/\s+/);
  const terms = searchText(query).split(/\s+/).filter(Boolean);
  return terms.every((term) => words.some((word) => word === term || (term.length >= 3 && word.startsWith(term))));
}
