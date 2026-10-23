import { ALL_GEOS, GEOS, NAME, METRICS, reportMonths, reportState, stateUrl, measure, regionalBrief, chartModel, chartCsv, formatValue, formatSigned, monthName, hundredParts, reportInsights, industryRows, sortedIndustries } from '../lib/jobs-report.js';
import { signed, num, rate, back } from '../lib/lfs-math.js';

export function mountReport(root, data) {
  const $ = (selector) => root.querySelector(selector);
  const $$ = (selector) => [...root.querySelectorAll(selector)];
  const el = (tag, text, cls) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (cls) node.className = cls; return node; };
  const svgEl = (tag, attributes = {}, text) => { const node = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k, v] of Object.entries(attributes)) node.setAttribute(k, String(v)); if (text != null) node.textContent = text; return node; };
  const text = (selector, value) => { const node = $(selector); if (node) node.textContent = String(value); };
  const pressed = (selector, key, value) => $$(selector).forEach((button) => button.setAttribute('aria-pressed', String(button.dataset[key] === String(value))));
  const months = reportMonths(data);
  let state = reportState(data, location.search), expanded = false, industrySearch = '', model, chartWidth = 0, announceTimer;
  const chartSvg = $('[data-chart]');

  function announce(message) { clearTimeout(announceTimer); announceTimer = setTimeout(() => text('[data-report-status]', message), 200); }
  function commit(patch, sync = true) {
    state = reportState(data, new URLSearchParams({ ...state, ...patch }));
    if (sync) history.replaceState(null, '', stateUrl(location.href, state, data));
    render();
    announce(`${NAME[state.province]}, ${monthName(state.month)}. ${METRICS[state.metric].title}: ${measure(data, state.province, state.metric, state.month, state.period).value}.`);
  }
  function formatPoint(value) {
    if (!model.changing) return formatValue(value, state.metric);
    return formatSigned(value, 1, METRICS[state.metric].kind === 'rate' ? ' pp' : '%');
  }
  function readout(index, cursor = false) {
    if (!model.months.length) return;
    const i = Math.max(0, Math.min(model.months.length - 1, index));
    text('[data-readout-month]', monthName(model.months[i]));
    text('[data-main-value]', formatPoint(model.va[i]));
    text('[data-compare-value]', formatPoint(model.vb[i]));
    const hair = $('[data-chart-cursor]');
    if (cursor) hair.removeAttribute('hidden'); else hair.setAttribute('hidden', '');
    if (!cursor) return;
    const point = model.pa[i] || model.pb[i];
    if (!point) { hair.setAttribute('hidden', ''); return; }
    const line = $('[data-cursor-line]');
    for (const [key, value] of Object.entries({ x1: point.x, x2: point.x, y1: model.top, y2: model.bottom })) line.setAttribute(key, String(value));
    for (const [selector, p] of [['[data-cursor-primary]', model.pa[i]], ['[data-cursor-compare]', model.pb[i]]]) {
      const dot = $(selector); dot.hidden = !p;
      if (p) { dot.removeAttribute('hidden'); dot.setAttribute('cx', String(p.x)); dot.setAttribute('cy', String(p.y)); }
      else dot.setAttribute('hidden', '');
    }
  }
  function renderChart() {
    chartWidth = Math.max(300, Math.round(chartSvg.getBoundingClientRect().width || 900));
    model = chartModel(data, state, { width: chartWidth, height: chartWidth < 550 ? 260 : 310 });
    chartSvg.setAttribute('viewBox', `0 0 ${model.width} ${model.height}`);
    text('#report-chart-title', model.title);
    text('#report-chart-description', `${model.title}, ${monthName(model.start)} to ${monthName(model.end)}. ${model.unit}${model.changing ? ' since ' + monthName(model.start) : ''}. Missing observations are gaps. The table lists the underlying monthly values.`);
    $('[data-chart-primary]').setAttribute('d', model.pathA);
    $('[data-chart-comparison]').setAttribute('d', model.pathB);
    $('[data-chart-area]').setAttribute('d', model.area);
    $('[data-chart-empty]').hidden = model.pa.some(Boolean);
    $('[data-chart-grid]').replaceChildren(...model.ticks.map((tick) => {
      const group = svgEl('g');
      group.append(svgEl('line', { x1: model.left, x2: model.width - model.right, y1: tick.y, y2: tick.y }), svgEl('text', { x: model.left - 12, y: tick.y + 4, 'text-anchor': 'end' }, tick.value));
      return group;
    }));
    $('[data-chart-months]').replaceChildren(...model.labels.map((label) => svgEl('text', { x: label.x, y: model.height - 8, 'text-anchor': label.anchor }, label.text)));
    text('[data-chart-unit]', model.unit + (model.changing ? ' since ' + monthName(model.start, true) : ''));
    text('[data-main-name]', NAME[state.province]);
    text('[data-compare-name]', NAME[state.compare] || '');
    $('[data-compare-readout]').hidden = state.compare === 'none';
    text('[data-chart-note]', METRICS[state.metric].definition + (model.changing ? ` Change is measured from ${monthName(model.start)}. ${METRICS[state.metric].kind === 'rate' ? 'Rate changes are percentage points, not percent changes.' : ''}` : state.metric === 'employment' && state.compare !== 'none' ? ' Levels compare market size. Choose Change to compare growth.' : '') + (model.months.length < state.range + 1 ? ` Showing all ${model.months.length} available monthly observations in this window.` : ''));
    readout(model.months.length - 1);
    const head = el('tr'); head.append(el('th', 'Month'), el('th', NAME[state.province])); if (state.compare !== 'none') head.append(el('th', NAME[state.compare]));
    [...head.children].forEach((cell) => cell.scope = 'col'); $('[data-chart-table-head]').replaceChildren(head);
    $('[data-chart-table]').replaceChildren(...model.months.map((month, i) => {
      const row = el('tr'), label = el('th', monthName(month)); label.scope = 'row'; row.append(label, el('td', formatValue(model.a[i], state.metric))); if (state.compare !== 'none') row.append(el('td', formatValue(model.b[i], state.metric))); return row;
    }));
    text('[data-chart-caption]', model.title + '. Underlying monthly values; CSV uses these values too.');
  }
  function renderIndustries() {
    const focus = document.activeElement?.dataset?.sector;
    const rows = sortedIndustries(data, state, industrySearch);
    const visible = expanded || industrySearch ? rows : rows.slice(0, 6);
    const key = state.basis === 'percent' ? 'percent' : 'change';
    const max = Math.max(...rows.map((r) => Math.abs(r[key] || 0)), 1);
    $('[data-industry-list]').replaceChildren(...visible.map((row) => {
      const button = el('button', null, 'industry-row'); button.type = 'button'; button.dataset.sector = row.name; button.setAttribute('aria-pressed', String(row.name === state.sector));
      const label = el('span', row.label, 'industry-name'); label.append(el('small', row.now == null ? 'Not available' : num(row.now) + ' working'));
      const track = el('span', null, 'industry-bar-track'); track.setAttribute('aria-hidden', 'true'); const bar = el('span', null, 'industry-bar');
      const change = row[key]; bar.style.setProperty('--bar-width', `${change == null ? 0 : Math.abs(change) / max * 48}%`); bar.style.setProperty('--bar-side', change < 0 ? 'auto' : '50%'); bar.style.setProperty('--bar-right', change < 0 ? '50%' : 'auto'); bar.classList.toggle('is-negative', change < 0); track.append(bar);
      button.append(label, track, el('strong', change == null ? 'Not available' : state.basis === 'percent' ? formatSigned(change, 1, '%') : signed(change)));
      return button;
    }));
    $('[data-industry-empty]').hidden = rows.length > 0;
    $('[data-industry-more]').hidden = !!industrySearch || rows.length <= 6;
    text('[data-industry-more]', expanded ? 'Show fewer industries ↑' : `Show all ${rows.length} industries ↓`);
    text('[data-industry-units]', state.basis === 'percent' ? 'Change (%)' : 'Change in people');
    text('[data-industry-context]', `${NAME[state.province]} · ${monthName(state.month)} vs ${monthName(back(state.month, state.period === 'year' ? 12 : 1))}`);
    if (focus) $$('[data-sector]').find((button) => button.dataset.sector === focus)?.focus({ preventScroll: true });
    const sector = industryRows(data, state).find((row) => row.name === state.sector);
    $('[data-sector-select]').value = state.sector;
    text('[data-sector-title]', sector.label);
    text('[data-sector-value]', sector.now == null ? 'Not available' : num(sector.now));
    text('[data-sector-change]', sector.change == null ? 'Not available' : signed(sector.change));
    text('[data-sector-percent]', formatSigned(sector.percent, 1, '%'));
    text('[data-sector-prior]', state.period === 'year' ? 'over the year' : 'over the month');
    text('[data-sector-month]', monthName(state.month));
    const c = chartModel(data, { ...state, mode: 'level', compare: 'none' }, { industry: state.sector, width: 600, height: 170 });
    $('[data-sector-line]').setAttribute('d', c.pathA); $('[data-sector-area]').setAttribute('d', c.area);
    text('[data-sector-start]', monthName(c.start, true)); text('[data-sector-end]', monthName(c.end, true));
    $('[data-sector-chart]').setAttribute('aria-label', `${sector.label} employment in ${NAME[state.province]}: ${formatValue(c.a[0], 'employment')} in ${monthName(c.start)}, ${formatValue(c.a.at(-1), 'employment')} in ${monthName(c.end)}.`);
  }
  function render() {
    pressed('[data-province]', 'province', state.province); pressed('[data-map-geo]', 'mapGeo', state.province); pressed('[data-period]', 'period', state.period); pressed('[data-metric]', 'metric', state.metric); pressed('[data-card-metric]', 'cardMetric', state.metric); pressed('[data-range]', 'range', state.range); pressed('[data-mode]', 'mode', state.mode); pressed('[data-audience]', 'audience', state.audience); pressed('[data-basis]', 'basis', state.basis);
    $$('[data-map-geo]').forEach((path) => path.classList.toggle('is-selected', path.dataset.mapGeo === state.province));
    $$('[data-map-value]').forEach((label) => label.textContent = measure(data, label.dataset.mapValue, 'unemployment', state.month).value);
    $$('[data-month-label]').forEach((label) => label.textContent = monthName(state.month));
    text('[data-focus-title]', NAME[state.province]); text('[data-focus-date]', `${monthName(state.month)} · seasonally adjusted, except wages`);
    $('[data-report-month]').value = state.month;
    $('[data-timeline]').value = String(months.indexOf(state.month)); $('[data-timeline]').setAttribute('aria-valuetext', monthName(state.month));
    text('[data-timeline-month]', monthName(state.month)); $('[data-latest]').hidden = state.month === data.month;
    for (const key of ['unemployment', 'employment', 'wages', 'participation']) {
      const m = measure(data, state.province, key, state.month, state.period);
      text(`[data-card-value="${key}"]`, m.value); text(`[data-card-delta="${key}"]`, m.comparison);
    }
    const brief = regionalBrief(data, state.month);
    text('[data-regional-month]', monthName(state.month)); text('[data-regional-story]', brief.headline);
    text('[data-region-monthly]', brief.monthly == null ? 'Not available' : signed(brief.monthly)); text('[data-region-yearly]', brief.yearly == null ? 'Not available' : signed(brief.yearly)); text('[data-region-ur]', brief.ur == null ? 'Not available' : rate(brief.ur));
    const compare = $('[data-compare]');
    compare.replaceChildren(...ALL_GEOS.filter((g) => g !== state.province).map((g) => { const option = el('option', NAME[g]); option.value = g; return option; }), Object.assign(el('option', 'No comparison'), { value: 'none' })); compare.value = state.compare;
    text('[data-comparison-title]', METRICS[state.metric].title); text('[data-comparison-date]', monthName(state.month));
    const provinceValues = GEOS.map((geo) => measure(data, geo, state.metric, state.month, state.period));
    const max = Math.max(...provinceValues.map((m) => m.now || 0), 1);
    GEOS.forEach((geo, i) => {
      const button = $(`[data-snapshot-geo="${geo}"]`); const m = provinceValues[i]; button.setAttribute('aria-pressed', String(geo === state.province)); button.setAttribute('aria-label', `Explore ${NAME[geo]}. ${METRICS[state.metric].title}: ${m.value}, ${m.comparison}.`); button.querySelector('strong').textContent = m.value; button.querySelector('small').textContent = m.comparison; button.style.setProperty('--province-width', `${Math.max(0, (m.now || 0) / max * 100)}%`);
    });
    $('[data-insights]').replaceChildren(...reportInsights(data, state).map((insight) => { const article = el('article'); article.append(el('h3', insight.label), el('p', insight.text)); return article; }));
    const hiring = state.audience === 'employer';
    text('[data-audience-text]', hiring ? `Use ${NAME[state.province]}’s employment and pay trends to frame your plan, then check the role, work location and candidate availability. An industry gain does not tell you how many employers are hiring today.` : 'Industry growth can help you decide where to look, but it does not guarantee openings. Check current postings, required skills and the pay for the specific job.');
    const cta = $('[data-context-link]'), destination = new URL(hiring ? root.dataset.hireUrl : root.dataset.jobsUrl, location.origin);
    if (state.province !== 'CA') destination.searchParams.set(hiring ? 'where' : 'province', hiring ? NAME[state.province] : state.province);
    cta.href = destination.href; cta.textContent = hiring ? `Discuss a hire${state.province === 'CA' ? '' : ' in ' + NAME[state.province]} →` : `See open jobs${state.province === 'CA' ? '' : ' in ' + NAME[state.province]} →`;
    const parts = hundredParts(data, state); const dots = $('[data-hundred]');
    dots.setAttribute('aria-label', parts ? `Out of 100 people aged 15 and over in ${NAME[state.province]}: ${parts[0]} working, ${parts[1]} looking for work, ${parts[2]} outside the labour force.` : 'Figures not available for this month.');
    [...dots.children].forEach((dot, i) => dot.className = parts && i < parts[0] ? 'dot-work' : parts && i < parts[0] + parts[1] ? 'dot-look' : 'dot-out');
    for (let i = 0; i < 3; i++) text(`[data-hundred-count="${i}"]`, parts?.[i] ?? '–'); text('[data-hundred-geo]', NAME[state.province]);
    $('[data-industry-sort]').value = state.sort;
    renderIndustries(); renderChart();
    text('[data-all-month]', monthName(state.month));
    $('[data-all-table]').replaceChildren(...Object.entries(METRICS).map(([key, metric]) => { const row = el('tr'), label = el('th', metric.title); label.scope = 'row'; row.append(label, ...ALL_GEOS.map((g) => el('td', measure(data, g, key, state.month, state.period).value))); return row; }));
  }

  root.addEventListener('click', (event) => {
    const target = event.target.closest('button, [data-map-geo]'); if (!target || !root.contains(target)) return;
    const d = target.dataset;
    if (d.province || d.mapGeo || d.snapshotGeo) commit({ province: d.province || d.mapGeo || d.snapshotGeo });
    else if (d.metric || d.cardMetric) { const metric = d.metric || d.cardMetric; commit({ metric, mode: metric === 'employment' ? 'change' : 'level' }); }
    else for (const key of ['period', 'range', 'mode', 'audience', 'basis', 'sector']) if (d[key]) { commit({ [key]: d[key] }); break; }
  });
  $$('[data-map-geo]').forEach((path) => path.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); commit({ province: path.dataset.mapGeo }); } }));
  $('[data-report-month]').addEventListener('change', (event) => commit({ month: event.target.value }));
  $('[data-timeline]').addEventListener('input', (event) => commit({ month: months[Number(event.target.value)] }));
  $('[data-latest]').addEventListener('click', () => commit({ month: data.month }));
  $('[data-compare]').addEventListener('change', (event) => commit({ compare: event.target.value }));
  $('[data-industry-sort]').addEventListener('change', (event) => commit({ sort: event.target.value }));
  $('[data-sector-select]').addEventListener('change', (event) => commit({ sector: event.target.value }));
  $('[data-industry-search]').addEventListener('input', (event) => { industrySearch = event.target.value.trim().slice(0, 100); renderIndustries(); });
  $('[data-industry-more]').addEventListener('click', () => { expanded = !expanded; renderIndustries(); });
  chartSvg.addEventListener('pointermove', (event) => {
    const box = chartSvg.getBoundingClientRect(); if (!box.width || !model.months.length) return;
    const x = (event.clientX - box.left) / box.width * model.width;
    const index = Math.round((x - model.left) / (model.width - model.left - model.right) * (model.months.length - 1)); readout(index, true);
  });
  chartSvg.addEventListener('pointerleave', () => readout(model.months.length - 1));
  $('[data-copy]').addEventListener('click', async () => {
    const button = $('[data-copy]'), link = stateUrl(location.href, state, data).href;
    try { await navigator.clipboard.writeText(link); button.textContent = 'View link copied ✓'; announce('View link copied.'); setTimeout(() => button.textContent = 'Copy view link ↗', 2500); }
    catch { let input = $('[data-share-fallback]'); if (!input) { input = el('input'); input.readOnly = true; input.dataset.shareFallback = ''; input.setAttribute('aria-label', 'Link to this report view'); button.parentElement.append(input); } input.value = link; input.focus(); input.select(); announce('Copy the selected report link.'); }
  });
  $('[data-download]').addEventListener('click', () => {
    const blob = new Blob([chartCsv(data, state)], { type: 'text/csv;charset=utf-8' }); const link = el('a'); const blobUrl = URL.createObjectURL(blob); link.href = blobUrl; link.download = `atlantic-jobs-report-${state.province.toLowerCase()}-${state.metric}-${state.month}.csv`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(blobUrl), 1000); announce('Chart CSV downloaded. It contains the underlying monthly values.');
  });
  window.addEventListener('popstate', () => { state = reportState(data, location.search); industrySearch = ''; expanded = false; $('[data-industry-search]').value = ''; render(); });
  if ('ResizeObserver' in window) new ResizeObserver(() => { const width = Math.max(300, Math.round(chartSvg.getBoundingClientRect().width || 900)); if (Math.abs(width - chartWidth) > 2) renderChart(); }).observe(chartSvg.parentElement);
  render();
  root.dataset.ready = 'true';
  return { getState: () => ({ ...state }) };
}
const root = document.querySelector('[data-report]');
const payload = document.querySelector('#report-data');
if (root && payload) mountReport(root, JSON.parse(payload.textContent));
