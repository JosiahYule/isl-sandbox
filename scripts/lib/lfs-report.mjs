export function sameReport(a, b) {
  const { fetched: _a, ...previous } = a || {};
  const { fetched: _b, ...next } = b || {};
  return JSON.stringify(previous) === JSON.stringify(next);
}

export function validateReport(data) {
  if (!/^\d{4}-\d{2}$/.test(data.month)) throw new Error('Invalid report month');
  for (const geo of ['CA', 'NS', 'NB', 'PE', 'NL']) {
    const series = ['unemploymentRate', 'employment', 'participationRate', 'employmentRate', 'labourForce', 'youthUnemploymentRate']
      .map((key) => data.provinces[geo]?.[key]);
    series.push(data.wages[geo]?.averageHourly, data.industries[geo]?.Total);
    for (const values of series) {
      if (!Array.isArray(values) || values.length < 13 || values.at(-1).month !== data.month
        || new Set(values.map((p) => p.month)).size !== values.length
        || values.some((p) => !/^\d{4}-\d{2}$/.test(p.month) || (p.value !== null && !Number.isFinite(p.value)))) {
        throw new Error(`Incomplete or invalid report series for ${geo}; nothing saved.`);
      }
    }
  }
}
