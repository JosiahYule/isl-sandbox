// Shared, runtime-independent Labour Force Survey arithmetic and formatting.
export const GEOS = ['NS', 'NB', 'PE', 'NL'];
export const NAME = { CA: 'Canada', NS: 'Nova Scotia', NB: 'New Brunswick', PE: 'Prince Edward Island', NL: 'Newfoundland and Labrador' };
export const SHORT = { CA: 'Canada', NS: 'NS', NB: 'NB', PE: 'PEI', NL: 'NL' };

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthName = (m, short = false) => { const [y, mo] = m.split('-').map(Number); const n = MONTHS[mo - 1]; return short ? `${n.slice(0, 3)} ${String(y).slice(2)}` : `${n} ${y}`; };

// The value for a month, and the month a given number of months before another
export const at = (s, month) => s?.find((p) => p.month === month)?.value ?? null;
export const back = (month, n) => { const [y, m] = month.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 - n, 1)); return d.toISOString().slice(0, 7); };

// Latest value, and its change over one month and over twelve
export function read(s, month) {
  const now = at(s, month), prev = at(s, back(month, 1)), year = at(s, back(month, 12));
  return { now, prev, year, m: now != null && prev != null ? now - prev : null, y: now != null && year != null ? now - year : null };
}

// Formatting: one decimal for rates; people rounded to the nearest hundred
export const rate = (v) => `${v.toFixed(1)}%`;
export const pts = (v) => (Math.abs(v) < 0.05 ? 'no change' : `${v > 0 ? 'up' : 'down'} ${Math.abs(v).toFixed(1)} ${Math.abs(v) >= 0.95 && Math.abs(v) < 1.05 ? 'point' : 'points'}`);
export const people = (thousands) => Math.round(thousands * 10) * 100; // 541.04 → 541,000
export const num = (v) => v.toLocaleString('en-CA');
export const signed = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + num(Math.abs(v));
export const money = (v) => `$${v.toFixed(2)}`;

