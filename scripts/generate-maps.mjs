// Generates src/data/maps.js (the Atlantic Canada and Canada map shapes).
// You only need this if the map framing changes. To run it:
//   npm install --no-save sane-topojson topojson-client topojson-simplify d3-geo
//   node scripts/generate-maps.mjs

import fs from 'node:fs';
import { feature } from 'topojson-client';
import { presimplify, simplify, quantile } from 'topojson-simplify';
import { geoConicConformal, geoPath, geoArea } from 'd3-geo';

// Thin points in screen space: skip any point closer than minDist px to the last one kept.
function thinned(projection, minDist) {
  return {
    stream(out) {
      let lx = 0, ly = 0, first = true;
      const thin = {
        point(x, y) { if (first || Math.hypot(x - lx, y - ly) >= minDist) { out.point(x, y); lx = x; ly = y; first = false; } },
        lineStart() { first = true; out.lineStart(); },
        lineEnd() { out.lineEnd(); },
        polygonStart() { out.polygonStart(); },
        polygonEnd() { out.polygonEnd(); },
        sphere() { out.sphere && out.sphere(); },
      };
      return projection.stream(thin);
    },
  };
}

// Drop islands smaller than minArea (steradians) so the file stays small.
function dropSmall(f, minArea) {
  const g = f.geometry;
  if (g.type !== 'MultiPolygon') return f;
  const coords = g.coordinates.filter((poly) => geoArea({ type: 'Polygon', coordinates: poly }) > minArea);
  return { ...f, geometry: { type: 'MultiPolygon', coordinates: coords } };
}

function load(file, q) {
  let t = JSON.parse(fs.readFileSync(file));
  t = presimplify(t);
  t = simplify(t, quantile(t, q));
  const subs = feature(t, t.objects.subunits).features;
  return Object.fromEntries(subs.map(f => [f.id, f]));
}
const atlanticIds = ['NS', 'NB', 'PE', 'NL'];
const officesLL = [
  ['Halifax', -63.57, 44.67], ['Moncton', -64.78, 46.09], ['Saint John', -66.06, 45.27],
  ['Charlottetown', -63.13, 46.24], ["St. John's", -52.71, 47.56],
];

// Atlantic: 50m detail, light simplification, framed on the Maritimes + island of Newfoundland
const A = load('node_modules/sane-topojson/dist/north-america_50m.json', 0.35);
const W = 900, H = 820;
const frame = { type: 'MultiPoint', coordinates: [[-67.6, 43.2], [-52.4, 43.2], [-67.6, 51.9], [-52.4, 51.9]] };
const proj = geoConicConformal().parallels([45, 50]).rotate([60, 0]).fitExtent([[20, 20], [W - 20, H - 20]], frame);
const path = geoPath(thinned(proj, 1.5)).digits(0);
const provinces = atlanticIds.map(id => ({ id, d: path(dropSmall(A[id], 2e-7)) }));
const context = ['QC', 'ME', 'NH'].map(id => ({ id, d: path(A[id]) }));
const offices = officesLL.map(([city, lon, lat]) => { const [x, y] = proj([lon, lat]); return { city, x: Math.round(x), y: Math.round(y) }; });

// Canada: 110m is plenty at small size
const C = load('node_modules/sane-topojson/dist/north-america_50m.json', 0.985);
const caIds = ['BC','AB','SK','MB','ON','QC','NB','NS','PE','NL','YT','NT','NU'];
const caHave = caIds.filter(i => C[i]); console.log('110m has', caHave.join(' '));
const canada = { type: 'FeatureCollection', features: caHave.map(i => C[i]) };
const CW = 1000, CH = 620;
const cproj = geoConicConformal().parallels([49, 77]).rotate([96, 0]).fitExtent([[10, 10], [CW - 10, CH - 10]], canada);
const cpath = geoPath(thinned(cproj, 2.5)).digits(0);
const caProvinces = caHave.map(id => ({ id, d: cpath(dropSmall(C[id], 2.5e-4)), atlantic: atlanticIds.includes(id) }));
const caOffices = officesLL.map(([city, lon, lat]) => { const [x, y] = cproj([lon, lat]); return { city, x: Math.round(x), y: Math.round(y) }; });

const out = `// GENERATED map geometry. Do not edit by hand.
// Source: Natural Earth admin-1 boundaries (via the sane-topojson package), simplified with
// topojson-simplify and projected with d3-geo (Lambert conformal conic).

export const atlanticMap = ${JSON.stringify({ width: W, height: H, provinces, context, offices })};

export const canadaMap = ${JSON.stringify({ width: CW, height: CH, provinces: caProvinces, offices: caOffices })};
`;
fs.writeFileSync('src/data/maps.js', out);
console.log('bytes', out.length, JSON.stringify(offices));
