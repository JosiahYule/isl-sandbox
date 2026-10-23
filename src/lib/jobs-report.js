// All report calculations are shared by the static page, interactive view and regression tests.
// Employment is an estimate of people working, not vacancies or advertised jobs.
import { GEOS, NAME, SHORT, at, back, read, monthName, people, num, signed, money, rate } from './lfs-math.js';
export { GEOS, NAME, SHORT, monthName, back } from './lfs-math.js';
export const ALL_GEOS = [...GEOS, 'CA'];
export const METRICS = {
  unemployment: { label: 'Unemployment', title: 'Unemployment rate', key: 'unemploymentRate', unit: '%', kind: 'rate', definition: 'People looking for work as a share of the labour force. Seasonally adjusted.' },
  employment: { label: 'Employment', title: 'People working', key: 'employment', unit: 'people', kind: 'count', definition: 'People who are employed, including self-employed people. This measures employment, not open jobs. Seasonally adjusted.' },
  wages: { label: 'Hourly pay', title: 'Average hourly wage', key: 'averageHourly', unit: 'CAD/hour', kind: 'money', definition: 'Average pay at employees’ main jobs, before deductions. Not seasonally adjusted or adjusted for inflation. Compare the same month a year earlier; changes can also reflect who is employed.' },
  participation: { label: 'Participation', title: 'Labour force participation', key: 'participationRate', unit: '%', kind: 'rate', definition: 'People working or looking for work as a share of the population aged 15 and over. Seasonally adjusted.' },
  youth: { label: 'Youth unemployment', title: 'Unemployment, ages 15–24', key: 'youthUnemploymentRate', unit: '%', kind: 'rate', definition: 'Young people looking for work as a share of the labour force aged 15–24. It is not a share of all young people. Seasonally adjusted.' },
};
export const INDUSTRIES = ['Agriculture', 'Forestry, fishing, mining, quarrying, oil and gas', 'Utilities', 'Construction', 'Manufacturing', 'Wholesale and retail trade', 'Transportation and warehousing', 'Finance, insurance, real estate, rental and leasing', 'Professional, scientific and technical services', 'Business, building and other support services', 'Educational services', 'Health care and social assistance', 'Information, culture and recreation', 'Accommodation and food services', 'Other services (except public administration)', 'Public administration'];
export const INDUSTRY_SHORT = { 'Forestry, fishing, mining, quarrying, oil and gas': 'Forestry, fishing, mining, oil & gas', 'Wholesale and retail trade': 'Retail & wholesale', 'Finance, insurance, real estate, rental and leasing': 'Finance, insurance & real estate', 'Professional, scientific and technical services': 'Professional & technical services', 'Business, building and other support services': 'Business, building & support services', 'Educational services': 'Education', 'Other services (except public administration)': 'Other services' };
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
export const pctChange = (a, b) => finite(a) && finite(b) && b !== 0 ? ((a - b) / b) * 100 : null;
export const formatSigned = (v, digits = 1, suffix = '') => !finite(v) ? 'Not available' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(digits)}${suffix}`;
export const formatValue = (v, metric, compact = false) => !finite(v) ? 'Not available' : METRICS[metric].kind === 'count'
  ? compact ? new Intl.NumberFormat('en-CA', { notation: 'compact', maximumFractionDigits: 1 }).format(v) : num(Math.round(v))
  : METRICS[metric].kind === 'money' ? compact ? '$' + v.toFixed(0) : money(v) : rate(v);

export function seriesFor(data, geo, metric, industry = '') {
  const series = industry ? data.industries?.[geo]?.[industry] : metric === 'wages' ? data.wages?.[geo]?.averageHourly : data.provinces?.[geo]?.[METRICS[metric]?.key];
  return (series || []).map((point) => ({ month: point.month, value: finite(point.value) ? industry || metric === 'employment' ? people(point.value) : point.value : null }));
}
export function reportMonths(data) {
  return (data.provinces?.NS?.employment || []).map((p) => p.month).filter((month) =>
    GEOS.every((g) => finite(at(data.provinces?.[g]?.employment, month)) && finite(at(data.provinces?.[g]?.employment, back(month, 12)))),
  ).sort();
}
export function defaultState(data) {
  return { province: 'NS', month: data.month, metric: 'unemployment', compare: 'CA', range: 24, mode: 'level', period: 'year', sector: 'Construction', sort: 'gains', basis: 'people', audience: 'employer' };
}
export function reportState(data, search = '') {
  const p = search instanceof URLSearchParams ? search : new URLSearchParams(search);
  const state = defaultState(data);
  for (const [key, allowed] of Object.entries({ province: ALL_GEOS, month: reportMonths(data), metric: Object.keys(METRICS), compare: [...ALL_GEOS, 'none'], mode: ['level', 'change'], period: ['month', 'year'], sector: INDUSTRIES, sort: ['gains', 'losses', 'size'], basis: ['people', 'percent'], audience: ['employer', 'candidate'] })) {
    if (allowed.includes(p.get(key))) state[key] = p.get(key);
  }
  state.range = p.get('range') === '12' ? 12 : 24;
  if (state.compare === state.province) state.compare = state.province === 'CA' ? 'NS' : 'CA';
  if (state.metric === 'employment' && !p.has('mode')) state.mode = 'change';
  return state;
}
export function stateUrl(url, state, data) {
  const result = new URL(url);
  const defaults = defaultState(data);
  for (const key of Object.keys(defaults)) {
    if (String(state[key]) === String(defaults[key])) result.searchParams.delete(key);
    else result.searchParams.set(key, String(state[key]));
  }
  // An employment chart needs an explicit level mode, since its natural default is change.
  if (state.metric === 'employment' && state.mode === 'level') result.searchParams.set('mode', 'level');
  return result;
}
export function measure(data, geo, metric, month, period = 'year') {
  const r = read(seriesFor(data, geo, metric), month);
  const annual = metric === 'wages';
  const base = annual || period === 'year' ? r.year : r.prev;
  const delta = finite(r.now) && finite(base) ? r.now - base : null;
  const change = METRICS[metric].kind === 'rate' ? delta : pctChange(r.now, base);
  const prior = back(month, annual || period === 'year' ? 12 : 1);
  const deltaText = finite(change) ? formatSigned(change, 1, METRICS[metric].kind === 'rate' ? ' pp' : '%') : 'Not available';
  return { ...r, delta, change, prior, deltaText, comparison: `${deltaText} vs ${monthName(prior, true)}`, value: formatValue(r.now, metric) };
}
export function regionalBrief(data, month) {
  const sum = (key, m) => {
    const values = GEOS.map((g) => at(data.provinces?.[g]?.[key], m));
    return values.every(finite) ? values.reduce((a, b) => a + b, 0) : null;
  };
  const work = sum('employment', month), prev = sum('employment', back(month, 1)), year = sum('employment', back(month, 12));
  const force = sum('labourForce', month), prevForce = sum('labourForce', back(month, 1));
  const ur = finite(work) && force > 0 ? (1 - work / force) * 100 : null;
  const prevUr = finite(prev) && prevForce > 0 ? (1 - prev / prevForce) * 100 : null;
  const monthly = finite(work) && finite(prev) ? people(work - prev) : null;
  const yearly = finite(work) && finite(year) ? people(work - year) : null;
  const urChange = finite(ur) && finite(prevUr) ? ur - prevUr : null;
  const headline = finite(monthly) && finite(urChange) ? `Employment ${monthly > 0 ? 'rose' : monthly < 0 ? 'fell' : 'held steady'}. Unemployment ${Math.abs(urChange) < 0.05 ? 'held steady' : urChange > 0 ? 'rose' : 'fell'}${Math.abs(urChange) < 0.05 ? '.' : ' too.'}` : 'The region, in focus.';
  return { monthly, yearly, ur, urChange, headline: headline.replace(/fell too\./, monthly < 0 ? 'fell too.' : 'fell.').replace(/rose too\./, monthly > 0 ? 'rose too.' : 'rose.') };
}
export function industryRows(data, state) {
  const prior = back(state.month, state.period === 'year' ? 12 : 1);
  return INDUSTRIES.map((name) => {
    const series = seriesFor(data, state.province, 'employment', name);
    const now = at(series, state.month), before = at(series, prior);
    return { name, label: INDUSTRY_SHORT[name] || name, now, change: finite(now) && finite(before) ? now - before : null, percent: pctChange(now, before) };
  });
}
export function sortedIndustries(data, state, search = '') {
  const key = state.sort === 'size' ? 'now' : state.basis === 'percent' ? 'percent' : 'change';
  const rows = industryRows(data, state).filter((row) => row.name.toLowerCase().includes(search.toLowerCase()));
  return rows.sort((a, b) => !finite(a[key]) ? !finite(b[key]) ? a.name.localeCompare(b.name) : 1 : !finite(b[key]) ? -1 : (state.sort === 'losses' ? a[key] - b[key] : b[key] - a[key]) || a.name.localeCompare(b.name));
}
export function hundredParts(data, state) {
  const employed = at(data.provinces?.[state.province]?.employmentRate, state.month);
  const participation = at(data.provinces?.[state.province]?.participationRate, state.month);
  if (!finite(employed) || !finite(participation) || participation < employed || participation > 100 || employed < 0) return null;
  const values = [employed, participation - employed, 100 - participation];
  const parts = values.map(Math.floor);
  let remaining = 100 - parts.reduce((a, b) => a + b, 0);
  values.map((v, i) => ({ i, remainder: v - parts[i] })).sort((a, b) => b.remainder - a.remainder).forEach(({ i }) => { if (remaining-- > 0) parts[i]++; });
  return parts;
}
export function reportInsights(data, state) {
  const work = measure(data, state.province, 'employment', state.month, state.period);
  const ur = measure(data, state.province, 'unemployment', state.month, state.period);
  const comparisonGeo = state.compare === 'none' ? state.province === 'CA' ? 'NS' : 'CA' : state.compare;
  const comparison = measure(data, comparisonGeo, 'unemployment', state.month, state.period);
  const gap = finite(ur.now) && finite(comparison.now) ? ur.now - comparison.now : null;
  const rows = industryRows(data, state).filter((r) => finite(r.change));
  const gain = [...rows].sort((a, b) => b.change - a.change)[0];
  const loss = [...rows].sort((a, b) => a.change - b.change)[0];
  const period = state.period === 'year' ? 'year' : 'month';
  const base = NAME[comparisonGeo];
  const labour = read(data.provinces?.[state.province]?.labourForce, state.month);
  const forceDelta = state.period === 'year' ? labour.y : labour.m;
  const recent = pctChange(work.now, at(seriesFor(data, state.province, 'employment'), back(state.month, 3)));
  let pace = finite(work.delta) ? work.delta === 0 ? `Employment was unchanged from a ${period} earlier.` : `${NAME[state.province]} had ${num(Math.abs(work.delta))} ${work.delta < 0 ? 'fewer' : 'more'} people working than a ${period} earlier (${work.deltaText}).` : 'There is not enough history to calculate the employment change.';
  if (work.delta > 0 && ur.delta > 0 && finite(forceDelta) && forceDelta > 0) pace = `Employment grew by ${num(work.delta)} over the ${period}, while the labour force grew by ${num(people(forceDelta))}. More people can be working even as the unemployment rate rises.`;
  else if (work.delta < 0 && ur.delta < 0 && finite(forceDelta) && forceDelta < 0) pace = `Employment fell by ${num(Math.abs(work.delta))} over the ${period}, while the labour force fell by ${num(Math.abs(people(forceDelta)))}. A lower unemployment rate does not always mean more people are working.`;
  else if (finite(recent)) pace += ` Across the most recent three months, employment changed by ${formatSigned(recent, 1, '%')}.`;
  return [
    { label: 'Employment in context', text: pace },
    { label: 'Wider context', text: finite(gap) ? `Unemployment is ${Math.abs(gap) < 0.05 ? 'the same as' : Math.abs(gap).toFixed(1) + ' percentage points ' + (gap > 0 ? 'above' : 'below')} ${base}’s rate. This is a broad market measure, not a measure of applicants for a specific job.` : 'A comparison rate is not available for this month.' },
    { label: 'Industry movement', text: gain?.change > 0 ? `${gain.label} had the largest employment gain over the ${period} (${signed(gain.change)} people)${loss?.change < 0 ? `; ${loss.label.toLowerCase()} had the largest decline (${signed(loss.change)})` : ''}. These are employment estimates, not vacancies.` : 'No measured industry recorded an employment gain for this comparison. Changes are survey estimates, not vacancy counts.' },
  ];
}

// SVG coordinates retain missing observations as gaps. The same month index drives the chart,
// keyboard/touch controls, readout and downloadable table.
export function chartModel(data, state, { width = 900, height = 310, industry = '' } = {}) {
  const metric = industry ? 'employment' : state.metric;
  const definition = METRICS[metric];
  const main = seriesFor(data, state.province, metric, industry);
  const other = state.compare === 'none' ? [] : seriesFor(data, state.compare, metric, industry);
  const months = Array.from({ length: state.range + 1 }, (_, i) => back(state.month, state.range - i))
    .filter((m) => main.some((p) => p.month === m) || other.some((p) => p.month === m));
  const a = months.map((m) => at(main, m)), b = months.map((m) => at(other, m));
  const firstA = a[0], firstB = b[0];
  const changing = state.mode === 'change';
  const convert = (values, first) => values.map((v) => !changing ? v : !finite(v) || !finite(first) ? null : definition.kind === 'rate' ? v - first : pctChange(v, first));
  const va = convert(a, firstA), vb = convert(b, firstB);
  const values = [...va, ...vb].filter(finite);
  const low = values.length ? Math.min(...values) : 0, high = values.length ? Math.max(...values) : 1;
  const span = high - low || Math.max(Math.abs(high) * 0.1, 1);
  const rough = span * 1.25 / 4, power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((v) => v * power).find((v) => v >= rough) || power * 10;
  const min = !changing ? Math.max(0, Math.floor((low - span * 0.1) / step) * step) : Math.floor((low - span * 0.1) / step) * step;
  const max = Math.max(min + step, Math.ceil((high + span * 0.1) / step) * step);
  const left = 62, right = 16, top = 18, bottom = height - 36;
  const x = (i) => left + (months.length > 1 ? i / (months.length - 1) : 0.5) * (width - left - right);
  const y = (v) => bottom - ((v - min) / (max - min)) * (bottom - top);
  const points = (v) => v.map((value, i) => finite(value) ? { x: x(i), y: y(value), value } : null);
  const pa = points(va), pb = points(vb);
  const path = (ps) => { let on = false; return ps.map((p) => { if (!p) { on = false; return ''; } const cmd = on ? 'L' : 'M'; on = true; return `${cmd}${p.x.toFixed(2)},${p.y.toFixed(2)}`; }).join(' ').trim(); };
  const area = (ps) => {
    const baseline = changing ? y(0) : bottom;
    const segments = []; let current = [];
    for (const point of [...ps, null]) { if (point) current.push(point); else if (current.length) { segments.push(`M${current[0].x},${baseline} ${current.map((p) => `L${p.x},${p.y}`).join(' ')} L${current.at(-1).x},${baseline}Z`); current = []; } }
    return segments.join(' ');
  };
  const unit = changing ? definition.kind === 'rate' ? 'Percentage-point change' : '% change' : definition.kind === 'money' ? 'CAD per hour' : definition.kind === 'rate' ? 'Rate (%)' : 'People working';
  const tick = (v) => changing ? `${Math.abs(v) < 0.00001 ? 0 : Number(v.toFixed(2))}${definition.kind === 'rate' ? '' : '%'}` : formatValue(v, metric, true);
  const ticks = Array.from({ length: Math.round((max - min) / step) + 1 }, (_, i) => min + i * step).map((v) => ({ value: tick(v), y: y(v) }));
  const labels = [...new Set([0, Math.round((months.length - 1) / 2), months.length - 1])].filter((i) => i >= 0 && months[i]).map((i) => ({ x: x(i), text: monthName(months[i], true), anchor: i === 0 ? 'start' : i === months.length - 1 ? 'end' : 'middle' }));
  return { width, height, left, right, top, bottom, months, a, b, va, vb, pa, pb, pathA: path(pa), pathB: path(pb), area: area(pa), ticks, labels, unit, metric, changing, title: `${industry || definition.title}: ${NAME[state.province]}${state.compare !== 'none' ? ' and ' + NAME[state.compare] : ''}`, start: months[0], end: months.at(-1) };
}
export function chartCsv(data, state) {
  const model = chartModel(data, state);
  const quote = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const rows = [['Month', 'Geography', 'Measure', 'Value', 'Unit', 'Seasonally adjusted', 'Source']];
  model.months.forEach((month, i) => {
    for (const [g, value] of [[state.province, model.a[i]], ...(state.compare === 'none' ? [] : [[state.compare, model.b[i]]])]) rows.push([month, NAME[g], METRICS[state.metric].title, value, METRICS[state.metric].unit, state.metric === 'wages' ? 'No' : 'Yes', 'Statistics Canada, Labour Force Survey']);
  });
  return '\uFEFF' + rows.map((row) => row.map(quote).join(',')).join('\r\n');
}
