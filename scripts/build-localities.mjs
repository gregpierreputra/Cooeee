// Builds the locality names BlackSky sets on the map disc in the "Whole way"
// view (BS_Enhancement-AC5): every Victorian locality from Vicmap Admin, each
// as one representative point. Writes public/data/localities-vic.json as
// [[name, lat, lon], ...], five decimals, sorted by name, and registers it in
// index.json so the snapshot-age gate watches it like every other snapshot.
// Run: npm run build:data:localities (only when the locality layer changes).
//
// The layer and its attributes were read from the service itself, not
// guessed: GetCapabilities lists open-data-platform:locality_polygon, and its
// DescribeFeatureType gives locality_name (the locality's name) and geom (a
// surface). The point is the polygon's area-weighted centroid, worked out
// here; a locality that curls round (a crescent) can have it just outside its
// own edge, which is close enough to set a name by at the dial's scale.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { isInsideVictoria } from '../src/core/constants.ts';

const WFS = 'https://opendata.maps.vic.gov.au/geoserver/wfs';
const LAYER = 'open-data-platform:locality_polygon';
const PAGE = 1000;

const SOURCE = {
  publisher: 'Department of Transport and Planning',
  dataset: 'Vicmap Admin, locality polygons (locality_polygon)',
  url: WFS,
  licence: 'CC BY 4.0',
};

function pageUrl(index) {
  const params = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: LAYER,
    outputFormat: 'application/json',
    srsName: 'EPSG:4326',
    propertyName: 'locality_name,geom',
    // A stable order, or a page boundary could fall differently on each request.
    sortBy: 'ufi',
    count: String(PAGE),
    startIndex: String(index * PAGE),
  });
  return `${WFS}?${params}`;
}

/** One page, tried twice before the build stops: a half-read layer must never
 *  be written as if it were the state. */
async function readPage(index) {
  let last;
  for (const attempt of [1, 2]) {
    try {
      const response = await fetch(pageUrl(index), { signal: AbortSignal.timeout(300_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json();
      if (!Array.isArray(body.features)) throw new TypeError('features must be an array');
      return body;
    } catch (error) {
      last = `${error} (try ${attempt})`;
    }
  }
  throw new Error(`locality layer page ${index} failed twice: ${last}`);
}

/** The signed area and area-weighted centre of one ring, by the shoelace
 *  formula in degrees: flat, which is plenty for a locality. */
function ring(points) {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let k = 0; k < points.length - 1; k++) {
    const [x0, y0] = points[k];
    const [x1, y1] = points[k + 1];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  return { area: area / 2, cx, cy };
}

/** The centroid of a Polygon or MultiPolygon: each outer ring adds its area,
 *  each hole takes its own away. Null for a geometry with no area. */
function centroid(geometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (const rings of polygons) {
    rings.forEach((points, i) => {
      const r = ring(points);
      // The outer ring counts positive and holes negative, whichever way round
      // the source happened to wind them.
      const sign = i === 0 ? Math.sign(r.area) : -Math.sign(r.area);
      area += sign * r.area;
      cx += sign * r.cx;
      cy += sign * r.cy;
    });
  }
  if (area === 0) return null;
  return { lon: cx / (6 * area), lat: cy / (6 * area) };
}

const started = Date.now();
const first = await readPage(0);
const total = first.totalFeatures ?? first.numberMatched;
if (!Number.isInteger(total) || total <= 0) throw new Error('the locality layer reported no feature count');
const pageCount = Math.ceil(total / PAGE);
console.log(`${LAYER}: ${total} features, ${pageCount} pages`);
const pages = [first];
for (let i = 1; i < pageCount; i++) pages.push(await readPage(i));

const seen = new Set();
const rows = [];
let skipped = 0;
for (const page of pages) {
  for (const feature of page.features) {
    if (seen.has(feature.id)) continue;
    seen.add(feature.id);
    const name = typeof feature.properties?.locality_name === 'string' ? feature.properties.locality_name.trim() : '';
    const point = feature.geometry ? centroid(feature.geometry) : null;
    if (!name || !point || !isInsideVictoria(point.lat, point.lon)) {
      skipped += 1;
      continue;
    }
    rows.push([name, Number(point.lat.toFixed(5)), Number(point.lon.toFixed(5))]);
  }
}
if (seen.size !== total) throw new Error(`read ${seen.size} features of ${total}: the pages are incomplete`);
rows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]));

// One row a line: a diff of the next refresh shows which localities changed.
const text = `[\n${rows.map((row) => JSON.stringify(row)).join(',\n')}\n]\n`;
const outputDir = new URL('../public/data/', import.meta.url);
writeFileSync(new URL('localities-vic.json', outputDir), text);

const retrievedAt = Date.now();
const indexUrl = new URL('index.json', outputDir);
const index = existsSync(indexUrl) ? JSON.parse(readFileSync(indexUrl, 'utf8')) : {};
index.localities = { file: 'localities-vic.json', retrievedAt, source: SOURCE };
writeFileSync(indexUrl, `${JSON.stringify(index, null, 2)}\n`);

const bytes = Buffer.byteLength(text);
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
console.log(
  `${rows.length} localities (${skipped} skipped: no name, no area or outside Victoria); ` +
    `localities-vic.json ${kb(bytes)} raw, ${kb(gzipSync(text, { level: 9 }).length)} gzip; ` +
    `${((Date.now() - started) / 1000).toFixed(0)} s`,
);
