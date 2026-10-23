import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { reportState, stateUrl, reportMonths, measure, regionalBrief, chartModel, chartCsv, hundredParts, sortedIndustries, reportInsights, formatValue, monthName } from '../src/lib/jobs-report.js';
const data = JSON.parse(await fs.readFile('src/data/lfs/latest.json', 'utf8'));
const base = reportState(data);
const tick = () => new Promise((resolve) => setTimeout(resolve, 30));

test('rate changes are points, employment changes are percent, and wages stay year over year', () => {
  const fixture = { provinces: { NS: {
    unemploymentRate: [{ month:'2025-09',value:4 },{ month:'2026-09',value:5 }],
    employment: [{ month:'2025-09',value:100 },{ month:'2026-09',value:110 }],
  } }, wages:{NS:{ averageHourly:[{month:'2025-09',value:20},{month:'2026-08',value:29},{month:'2026-09',value:30}] }} };
  assert.equal(measure(fixture,'NS','unemployment','2026-09','year').deltaText, '+1.0 pp');
  assert.equal(measure(fixture,'NS','employment','2026-09','year').comparison, '+10.0% vs Sep 25');
  const wage = measure(fixture,'NS','wages','2026-09','month');
  assert.equal(wage.change,50); assert.equal(wage.prior,'2025-09');
});

test('Atlantic unemployment is weighted by the combined labour force and missing data stays missing', () => {
  const provinces = {};
  for (const [g,employment,force] of [['NS',100,200],['NB',900,1000],['PE',100,125],['NL',100,125]]) provinces[g] = { employment:[{month:'2026-09',value:employment}],labourForce:[{month:'2026-09',value:force}] };
  const brief=regionalBrief({provinces},'2026-09');
  assert(Math.abs(brief.ur - (250/1450)*100)<0.0001);
  assert.equal(brief.monthly,null);
  provinces.PE.employment[0].value=null;
  assert.equal(regionalBrief({provinces},'2026-09').ur,null);
});

test('chart gaps, zero baselines and a small viewport never produce invented values or NaN paths', () => {
  const fixture=structuredClone(data);
  const series=fixture.provinces.NS.unemploymentRate;
  series[Math.floor(series.length/2)].value=null;
  const model=chartModel(fixture,{...base,compare:'none'},{width:320,height:260});
  assert.equal((model.pathA.match(/M/g)||[]).length,2,'a missing observation breaks the line');
  assert(!/NaN|Infinity/.test(model.pathA+model.area));
  assert(model.pa.filter(Boolean).every(p=>p.x>=0&&p.x<=320&&p.y>=0&&p.y<=260));
  fixture.provinces.NS.employment[0].value=0;
  const change=chartModel(fixture,{...base,metric:'employment',mode:'change',compare:'none'});
  assert(change.va.every(v=>v===null),'a percent change from zero is unavailable');
  assert.equal(change.pathA,'');
});

test('report URLs round-trip a historical comparison and reject unsupported state', () => {
  const search='?province=NB&compare=NL&metric=employment&mode=level&range=12&period=month&month='+reportMonths(data)[0]+'&sector=Manufacturing&basis=percent&sort=losses&audience=candidate';
  const state=reportState(data,search);
  const link=stateUrl('https://example.test/isl-sandbox/learn/tools/jobs-report/?utm_source=linkedin',state,data);
  assert.deepEqual(reportState(data,link.search),state); assert.equal(link.searchParams.get('utm_source'),'linkedin');
  const bad=reportState(data,'?province=XX&compare=NS&metric=made-up&month=2099-01&sector=unknown&range=500&mode=broken');
  assert.equal(bad.province,'NS'); assert.equal(bad.compare,'CA'); assert.equal(bad.month,data.month); assert.equal(bad.range,24); assert.equal(bad.metric,'unemployment');
});

test('CSV contains the actual chart observations, units and adjustment status, even in change mode', () => {
  const state={...base,metric:'wages',mode:'change',range:12};
  const csv=chartCsv(data,state), model=chartModel(data,state);
  assert.equal(csv.charCodeAt(0),0xfeff);
  assert(csv.includes('"CAD/hour","No","Statistics Canada, Labour Force Survey"'));
  assert(csv.includes('"'+model.a.at(-1)+'"'));
  assert.equal(csv.trim().split(/\r?\n/).length,1+model.months.length*2);
});

test('industry sorting uses the chosen denominator without double-counting sub-industries', () => {
  const fixture=structuredClone(data), month=data.month, prior=base.month.slice(0,4)-1+base.month.slice(4);
  fixture.industries.NS={
    Construction:[{month:prior,value:100},{month,value:110}],
    Manufacturing:[{month:prior,value:1},{month,value:2}],
    'Wholesale and retail trade':[{month:prior,value:20},{month,value:21}],
    'Wholesale trade':[{month:prior,value:10},{month,value:10.5}],
    'Retail trade':[{month:prior,value:10},{month,value:10.5}],
  };
  const people=sortedIndustries(fixture,{...base,basis:'people'});
  assert.equal(people[0].name,'Construction');
  const percent=sortedIndustries(fixture,{...base,basis:'percent'});
  assert.equal(percent[0].name,'Manufacturing');
  assert.equal(percent.length,16);
  assert(!percent.some(r=>r.name==='Retail trade'||r.name==='Wholesale trade'));
  assert.equal(sortedIndustries(fixture,base,'construction').length,1);
});

test('people composition always adds to 100 and insight copy identifies employment estimates', () => {
  for (const province of ['NS','NB','PE','NL','CA']) for(const month of reportMonths(data)) {
    const parts=hundredParts(data,{...base,province,month});
    assert.equal(parts.reduce((a,b)=>a+b,0),100);
    assert(parts.every(n=>Number.isInteger(n)&&n>=0));
  }
  assert(reportInsights(data,base)[2].text.includes('not vacancies'));
});

const bundle=await build({entryPoints:['src/scripts/jobs-report.js'],bundle:true,write:false,format:'iife',platform:'browser'});
const html=await fs.readFile('dist/learn/tools/jobs-report/index.html','utf8');
function setup(search='') {
  const dom=new JSDOM(html,{url:'https://example.test/isl-sandbox/learn/tools/jobs-report/'+search,runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window; w.matchMedia=()=>({matches:false});
  const downloads=[], copied=[], blobs=[];
  Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async value=>copied.push(value)}});
  w.Blob=Blob; w.URL.createObjectURL=blob=>{blobs.push(blob);return 'blob:https://example.test/test';};w.URL.revokeObjectURL=()=>{};
  w.HTMLAnchorElement.prototype.click=function(){downloads.push({href:this.href,filename:this.download});};
  w.SVGElement.prototype.getBoundingClientRect=function(){return {width:320,height:260,left:0,top:0,right:320,bottom:260};};
  w.fetch=()=>{throw new Error('The report must not call a remote API');};
  w.eval(bundle.outputFiles[0].text);
  const d=w.document;
  const change=(selector,value,type='change')=>{const input=d.querySelector(selector);input.value=value;input.dispatchEvent(new w.Event(type,{bubbles:true}));};
  return {dom,w,d,change,downloads,copied,blobs};
}

test('the live page script keeps province, month, cards, charts, insights and industries in sync', () => {
  const {dom,w,d,change}=setup('?province=NB&compare=NL&metric=employment&mode=change&period=month');
  try {
    assert.equal(d.querySelector('[data-focus-title]').textContent,'New Brunswick');
    assert(d.querySelector('[data-chart-unit]').textContent.includes('% change'));
    const month=reportMonths(data)[0];change('[data-report-month]',month);
    assert.equal(d.querySelector('[data-focus-date]').textContent.split(' · ')[0],monthName(month));
    assert.equal(d.querySelector('[data-card-value="employment"]').textContent,measure(data,'NB','employment',month,'month').value);
    assert.equal(d.querySelector('[data-timeline]').getAttribute('aria-valuetext'),monthName(month));
    assert(d.querySelector('[data-industry-context]').textContent.includes(monthName(month)));
    assert.equal(new URL(w.location.href).searchParams.get('month'),month);
    change('[data-timeline]',String(reportMonths(data).length-1),'input');
    assert.equal(d.querySelector('[data-latest]').hidden,true);
    d.querySelector('[data-province="NL"]').click();
    assert.equal(d.querySelector('[data-compare]').value,'CA','same-province comparison gets a valid replacement');
    d.querySelector('[data-metric="wages"]').click();
    assert.equal(d.querySelector('[data-card-delta="wages"]').textContent,measure(data,'NL','wages',data.month,'year').comparison);
    assert(d.querySelector('[data-chart-note]').textContent.includes('Not seasonally adjusted'));
    assert.equal(d.querySelector('[data-chart]').getAttribute('viewBox'),'0 0 320 260');
    assert(!/NaN|Infinity/.test(d.querySelector('[data-chart-primary]').getAttribute('d')));
    d.querySelector('[data-chart]').dispatchEvent(new w.MouseEvent('pointermove',{bubbles:true,clientX:100}));
    assert.equal(d.querySelector('[data-chart-cursor]').hasAttribute('hidden'),false);
    assert.equal(d.querySelector('[data-focus-date]').textContent.split(' · ')[0],monthName(data.month),'hover is not a committed report-month change');
  } finally {w.close();}
});

test('industry drill-down, share, export and history restoration use the actual selected view', async () => {
  const {dom,w,d,change,downloads,copied,blobs}=setup();
  try {
    change('[data-industry-search]','manufacturing','input');
    assert.equal(d.querySelectorAll('[data-sector]').length,1);
    d.querySelector('[data-sector="Manufacturing"]').click();
    assert.equal(d.querySelector('[data-sector-title]').textContent,'Manufacturing');
    d.querySelector('[data-basis="percent"]').click();
    assert.equal(d.querySelector('[data-industry-units]').textContent,'Change (%)');
    d.querySelector('[data-audience="candidate"]').click();
    assert.equal(new URL(d.querySelector('[data-context-link]').href).searchParams.get('province'),'NS');
    d.querySelector('[data-copy]').click();await tick();
    assert.equal(new URL(copied[0]).searchParams.get('sector'),'Manufacturing');
    assert.equal(new URL(copied[0]).searchParams.get('audience'),'candidate');
    d.querySelector('[data-download]').click();
    assert.equal(downloads.length,1);assert(downloads[0].filename.includes(data.month));
    assert((await blobs[0].text()).includes('Unemployment rate'));
    w.history.replaceState(null,'','?province=PE&metric=youth&range=12');w.dispatchEvent(new w.PopStateEvent('popstate'));
    assert.equal(d.querySelector('[data-focus-title]').textContent,'Prince Edward Island');
    assert.equal(d.querySelector('[data-comparison-title]').textContent,'Unemployment, ages 15–24');
    assert.equal(d.querySelector('[data-main-value]').textContent,measure(data,'PE','youth',data.month).value);
    change('[data-industry-search]','nothing-matches','input');
    assert.equal(d.querySelector('[data-industry-empty]').hidden,false);
    assert.equal(d.querySelector('[data-sector-select]').value,'Construction','history restores sector state too');
  } finally {w.close();}
});
