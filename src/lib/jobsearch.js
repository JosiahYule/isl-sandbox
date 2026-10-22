// Match every word across the role, skills and location, in any order.
// Punctuation/accents and common Canadian/US spelling should not hide a vacancy.
export function searchText(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/['’]/g, '').replace(/\blabor/g, 'labour')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

export function matchesJobQuery(text, query) {
  const words = searchText(text).split(/\s+/);
  const terms = searchText(query).split(/\s+/).filter(Boolean);
  return terms.every((term) => words.some((word) => word === term || (term.length >= 3 && word.startsWith(term))));
}
