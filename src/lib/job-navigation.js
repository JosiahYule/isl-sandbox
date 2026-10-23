// Carry results context between the board and a posting without accepting a return URL.
export const RESULT_KEYS = ['q', 'province', 'industry', 'type', 'area', 'view'];
export function resultsContext(search) {
  const input = new URLSearchParams(search);
  const context = new URLSearchParams();
  for (const key of RESULT_KEYS) {
    const value = input.get(key);
    if (value && (key !== 'view' || value === 'all')) context.set(key, value.slice(0, key === 'q' ? 200 : 80));
  }
  return context.toString();
}
