// A short description of the largest absolute annual employment changes.
// Rows use people, rather than the thousands used in the source tables.
export function industryTakeaway(rows, province, since) {
  const comparable = rows.filter((r) => Number.isFinite(r.y));
  const intro = `Since ${since}`;
  if (!comparable.length) return `Annual industry comparisons are not available for ${province}.`;
  const high = Math.max(...comparable.map((r) => r.y));
  const low = Math.min(...comparable.map((r) => r.y));
  if (high === 0 && low === 0) return `${intro}, employment was unchanged across the reported industries in ${province}.`;
  const describe = (value, gain) => {
    const tied = comparable.filter((r) => r.y === value);
    const amount = `${gain ? '+' : '−'}${Math.abs(value).toLocaleString('en-CA')}`;
    if (tied.length > 1) return `${tied.length} industries shared the largest ${gain ? 'gain' : 'decline'} (${amount} people each)`;
    const name = tied[0].name.replace(/^./, (c) => c.toLowerCase());
    return `${name} ${gain ? 'gained' : 'lost'} the most workers (${amount})`;
  };
  const parts = [];
  if (high > 0) parts.push(describe(high, true));
  if (low < 0) parts.push(describe(low, false));
  if (high <= 0) parts.push('no industry recorded a gain');
  if (low >= 0) parts.push('no industry recorded a decline');
  return `In ${province} since ${since}, ${parts.join('; ')}.`;
}
