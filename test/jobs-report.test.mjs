import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { industryTakeaway } from '../src/lib/lfs-report.js';

const sourcePath = 'src/sites/isl/learn/tools/jobs-report.astro';
const htmlPath = 'dist/learn/tools/jobs-report/index.html';
const source = await fs.readFile(sourcePath, 'utf8');
const bundle = await build({ stdin: { contents: source.match(/<script>([\s\S]*?)<\/script>/)[1], loader: 'ts', resolveDir: path.resolve(path.dirname(sourcePath)) }, bundle: true, write: false, format: 'iife', platform: 'browser' });

async function setup(query = '', changeData) {
  const dom = new JSDOM(await fs.readFile(htmlPath, 'utf8'), { url: 'https://example.test/isl-sandbox/learn/tools/jobs-report/' + query, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  const fig = w.document.querySelector('[data-sm]');
  const d = JSON.parse(fig.dataset.sm);
  changeData?.(d);
  fig.dataset.sm = JSON.stringify(d);
  const svg = fig.querySelector('svg');
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: d.scale.width, height: d.scale.height });
  w.eval(bundle.outputFiles[0].text);
  const key = (value) => fig.dispatchEvent(new w.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }));
  const pointer = (target, type, clientX = 0, pointerType = 'touch') => {
    const e = new w.MouseEvent(type, { clientX, bubbles: true });
    Object.defineProperty(e, 'pointerType', { value: pointerType });
    target.dispatchEvent(e);
  };
  const x = (i) => d.scale.left + (i / (d.a.length - 1)) * (d.scale.width - d.scale.left - 4);
  return { dom, w, fig, svg, d, key, pointer, x, tip: fig.querySelector('[data-tip]'), status: fig.querySelector('[data-chart-status]') };
}

test('report taps keep the selected month visible; scrolling, hover and dismissal do not corrupt it', async () => {
  const { dom, w, svg, d, pointer, x, tip, status } = await setup();
  try {
    pointer(svg, 'pointermove', x(4));
    assert.equal(tip.hidden, true, 'a touch scroll does not activate the chart');
    pointer(svg, 'pointerdown', x(4));
    pointer(svg, 'click', x(4));
    pointer(svg, 'pointerleave', x(4));
    assert.equal(tip.hidden, false, 'the tapped month survives finger lift');
    assert.equal(tip.querySelector('.tip-m').textContent, d.short[4]);
    pointer(svg, 'pointermove', x(8), 'mouse');
    assert.equal(tip.querySelector('.tip-m').textContent, d.short[4], 'hover cannot overwrite a pinned month');
    assert(status.textContent.startsWith(d.m[4]));
    pointer(w.document.body, 'pointerdown');
    assert.equal(tip.hidden, true);
    assert.equal(status.textContent, '');
    pointer(svg, 'pointermove', x(8), 'mouse');
    assert.equal(tip.querySelector('.tip-m').textContent, d.short[8]);
    assert.equal(status.textContent, '', 'hover does not flood the live region');
    pointer(svg, 'pointerleave', x(8), 'mouse');
    assert.equal(tip.hidden, true);
  } finally { dom.window.close(); }
});

test('keyboard chart navigation announces full months and values, clamps dates and dismisses with Escape', async () => {
  const { dom, fig, d, key, tip, status } = await setup();
  try {
    fig.focus();
    assert(status.textContent.includes(d.n));
    assert(status.textContent.startsWith(d.m.at(-1)));
    key('Home'); key('ArrowLeft');
    assert.equal(tip.querySelector('.tip-m').textContent, d.short[0]);
    key('ArrowRight');
    assert.equal(status.textContent, `${d.m[1]}. ${d.n}: ${d.a[1].toFixed(1)}% unemployment. Canada: ${d.b[1].toFixed(1)}%.`);
    key('End'); key('ArrowRight');
    assert.equal(tip.querySelector('.tip-m').textContent, d.short.at(-1));
    key('Escape');
    assert.equal(tip.hidden, true);
    assert.equal(status.textContent, '');
  } finally { dom.window.close(); }
});

test('missing observations keep their dates and never borrow a neighbouring chart marker', async () => {
  const { dom, fig, d, key, x, status } = await setup('', (d) => { d.a[2] = null; d.b[3] = null; });
  try {
    fig.focus(); key('Home'); key('ArrowRight'); key('ArrowRight');
    assert(status.textContent.startsWith(d.m[2]));
    assert(status.textContent.includes(`${d.n}: not available`));
    assert.equal(fig.querySelector('.h-a').hasAttribute('hidden'), true);
    key('ArrowRight');
    assert(status.textContent.includes(`${d.n}: ${d.a[3].toFixed(1)}%`));
    assert.equal(fig.querySelector('.h-a').hasAttribute('hidden'), false);
    assert.equal(Number(fig.querySelector('.h-a').getAttribute('cx')), x(3));
    assert.equal(fig.querySelector('.h-b').hasAttribute('hidden'), true);
  } finally { dom.window.close(); }
});

test('industry takeaways follow shared province links and province buttons together with the bars', async () => {
  const { dom, w } = await setup('?province=NB&utm_source=client');
  try {
    const doc = w.document;
    const summary = doc.querySelector('[data-ind-summary]');
    const nb = doc.querySelector('[data-view="NB"]');
    assert.equal(nb.hidden, false);
    assert.equal(summary.textContent, nb.dataset.summary);
    assert(summary.textContent.includes('New Brunswick'));
    doc.querySelector('[data-pick="NL"]').click();
    const nl = doc.querySelector('[data-view="NL"]');
    assert.equal(nl.hidden, false);
    assert.equal(nb.hidden, true);
    assert.equal(summary.textContent, nl.dataset.summary);
    assert(summary.textContent.includes('Newfoundland and Labrador'));
    assert.equal(new URL(w.location.href).searchParams.get('province'), 'NL');
    assert.equal(new URL(w.location.href).searchParams.get('utm_source'), 'client');
  } finally { dom.window.close(); }
});

test('takeaways describe absolute gains and declines honestly, including ties and one-direction changes', () => {
  const row = (name, y) => ({ name, y });
  const summary = industryTakeaway([row('Construction', 400), row('Education', 700), row('Manufacturing', -200), row('Unknown', null)], 'Nova Scotia', 'September 2025');
  assert(summary.includes('education gained the most workers (+700)'));
  assert(summary.includes('manufacturing lost the most workers (−200)'));
  assert(!summary.includes('Unknown'));
  const tied = industryTakeaway([row('Construction', 500), row('Education', 500), row('Manufacturing', 0)], 'Canada', 'September 2025');
  assert(tied.includes('2 industries shared the largest gain (+500 people each)'));
  assert(tied.includes('no industry recorded a decline'));
  assert(industryTakeaway([row('Construction', -100)], 'Canada', 'September 2025').includes('no industry recorded a gain'));
  assert(industryTakeaway([row('Construction', 0)], 'Canada', 'September 2025').includes('employment was unchanged'));
  assert(industryTakeaway([row('Missing', null)], 'Canada', 'September 2025').includes('not available'));
});

test('the existing expandable numbers section includes every plotted monthly unemployment value', async () => {
  const dom = new JSDOM(await fs.readFile(htmlPath, 'utf8'));
  try {
    const doc = dom.window.document;
    const history = doc.querySelector('#unemployment-history');
    assert(history.closest('details.numbers'), 'monthly data stays inside the existing disclosure');
    const values = new Map([...history.querySelectorAll('tbody tr')].map((r) => [r.querySelector('th').textContent, [...r.querySelectorAll('td')].map((c) => c.textContent)]));
    for (const [index, fig] of [...doc.querySelectorAll('[data-sm]')].entries()) {
      const d = JSON.parse(fig.dataset.sm);
      d.m.forEach((month, i) => {
        assert.equal(values.get(month)[index], d.a[i] == null ? 'Not available' : `${d.a[i].toFixed(1)}%`);
        assert.equal(values.get(month)[4], d.b[i] == null ? 'Not available' : `${d.b[i].toFixed(1)}%`);
      });
    }
  } finally { dom.window.close(); }
});
