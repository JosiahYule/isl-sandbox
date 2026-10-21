// PUTTING TOWNS ON THE ATLANTIC MAP
// The map (src/data/maps.js) is a drawing, not a geographic projection we can call. But we know
// each office's real longitude and latitude and where it sits on the drawing, so we fit the
// straight-line rule (x = a·lon + b·lat + c, and the same for y) that best links the two.
// Over an area this size the map's curvature is small, so towns land within a few pixels.
//
// project(lon, lat) -> { x, y } in the map's own units (0 to 900 across, 0 to 820 down)
import { atlanticMap as map } from '../data/maps.js';

export const OFFICE_LL = { Halifax: [-63.57, 44.67], Moncton: [-64.78, 46.09], 'Saint John': [-66.06, 45.27], Charlottetown: [-63.13, 46.24], "St. John's": [-52.71, 47.56] };

function fit(pick) {
  // Least squares for [a, b, c] from rows [lon, lat, 1] -> value (normal equations, 3x3)
  const rows = map.offices.map((o) => [...OFFICE_LL[o.city], 1, pick(o)]);
  const M = [0, 1, 2].map((i) => [0, 1, 2].map((j) => rows.reduce((t, r) => t + r[i] * r[j], 0)));
  const v = [0, 1, 2].map((i) => rows.reduce((t, r) => t + r[i] * r[3], 0));
  for (let i = 0; i < 3; i++) for (let k = i + 1; k < 3; k++) { const f = M[k][i] / M[i][i]; for (let j = i; j < 3; j++) M[k][j] -= f * M[i][j]; v[k] -= f * v[i]; }
  const x = [0, 0, 0];
  for (let i = 2; i >= 0; i--) x[i] = (v[i] - M[i].slice(i + 1).reduce((t, m, j) => t + m * x[i + 1 + j], 0)) / M[i][i];
  return x;
}
const [ax, bx, cx] = fit((o) => o.x), [ay, by, cy] = fit((o) => o.y);

export const project = (lon, lat) => ({ x: ax * lon + bx * lat + cx, y: ay * lon + by * lat + cy });
