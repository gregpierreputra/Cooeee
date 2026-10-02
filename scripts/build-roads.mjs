// Builds the state-wide main-roads file that BlackSky draws inside the dial
// (BS_Enhancement-AC5): freeways, highways, arterials and collector roads from
// the Vicmap Transport road layer, joined into one line per road, simplified at
// 25 m and written on a 5 m grid. Writes public/data/roads-vic.bin, its sidecar
// public/data/roads-vic.json, and registers both in index.json so the
// snapshot-age gate watches it like every other snapshot.
// Run: npm run build:data:roads (only when the road layer should be refreshed).
//
//   --pages DIR   read the WFS pages saved in DIR (page_000.json, ...) instead
//                 of downloading them. This is how the file was checked byte for
//                 byte against the measurement script that proved its size.
//
// The join, the simplification and the format live in src/core/roads-format.ts,
// shared with the app's reader and the unit tests, so the writer and the reader
// cannot drift apart.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { decodeRoadFile, encodeRoads, joinByNameAndClass } from '../src/core/roads-format.ts';

const WFS = 'https://opendata.maps.vic.gov.au/geoserver/wfs';
const LAYER = 'open-data-platform:tr_road';
const CLASSES = [0, 1, 2, 3]; // freeway, highway, arterial, collector
const PAGE = 5000;
const PARALLEL = 4; // what the measurement run used; the server answered every page
// The simplification and the grid. 25 m keeps every bend a person would
// recognise at the dial's scale (1.5 km across 340 px is about 9 m a pixel) and
// was the size the team accepted. The origin is a round point near the state's
// middle, so the first point of every line is a small number.
const TOLERANCE_M = 25;
const FRAME = { gridM: 5, lon0: 145, lat0: -37 };

const SOURCE = {
  publisher: 'Department of Transport and Planning',
  dataset: 'Vicmap Transport, road network (tr_road)',
  url: WFS,
  licence: 'CC BY 4.0',
};

const pagesDir = (() => {
  const at = process.argv.indexOf('--pages');
  return at > 0 ? process.argv[at + 1] : null;
})();

function pageUrl(index) {
  const params = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: LAYER,
    outputFormat: 'application/json',
    srsName: 'EPSG:4326',
    propertyName: 'ezi_road_name_label,class_code,geom',
    cql_filter: `class_code IN (${CLASSES.join(',')})`,
    // A stable order, or a page boundary could fall differently on each request
    // and a feature could be read twice or never.
    sortBy: 'ufi',
    count: String(PAGE),
    startIndex: String(index * PAGE),
  });
  return `${WFS}?${params}`;
}

/** One page, from the saved folder or the server. A failed download is tried
 *  once more before the build stops: a half-read layer must never be written
 *  as if it were the state. */
async function readPage(index) {
  if (pagesDir) {
    const name = `${pagesDir}/page_${String(index).padStart(3, '0')}.json`;
    return JSON.parse(readFileSync(name, 'utf8'));
  }
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
  throw new Error(`road layer page ${index} failed twice: ${last}`);
}

const started = Date.now();
const first = await readPage(0);
const total = first.totalFeatures ?? first.numberMatched;
if (!Number.isInteger(total) || total <= 0) throw new Error('the road layer reported no feature count');
const pageCount = Math.ceil(total / PAGE);
console.log(`${LAYER}: ${total} features, ${pageCount} pages${pagesDir ? ` (from ${pagesDir})` : ''}`);

const pages = [first];
for (let next = 1; next < pageCount; next += PARALLEL) {
  const batch = [];
  for (let i = next; i < Math.min(next + PARALLEL, pageCount); i++) batch.push(readPage(i));
  pages.push(...(await Promise.all(batch)));
}

// Every piece, in page order, each feature once, multi-part lines split.
const seen = new Set();
const pieces = [];
const featuresPerClass = {};
for (const page of pages) {
  for (const feature of page.features) {
    if (seen.has(feature.id)) continue;
    seen.add(feature.id);
    const props = feature.properties ?? {};
    const cls = props.class_code;
    if (!CLASSES.includes(cls)) throw new Error(`feature ${feature.id} has class ${cls}`);
    featuresPerClass[cls] = (featuresPerClass[cls] ?? 0) + 1;
    const geom = feature.geometry;
    if (!geom) continue;
    const name = typeof props.ezi_road_name_label === 'string' ? props.ezi_road_name_label.trim() : '';
    const parts = geom.type === 'LineString' ? [geom.coordinates] : geom.coordinates;
    for (const part of parts) pieces.push({ cls, name, points: part.map((c) => [c[0], c[1]]) });
  }
}
if (seen.size !== total) throw new Error(`read ${seen.size} features of ${total}: the pages are incomplete`);

const joined = joinByNameAndClass(pieces);
const { bytes, lines, dropped, points } = encodeRoads(joined, TOLERANCE_M, FRAME);

// Read the file straight back: the sidecar describes what the app will decode,
// not what the writer meant to write.
const decoded = decodeRoadFile(bytes.buffer).lines;
const linesPerClass = {};
const bounds = { minLon: Infinity, minLat: Infinity, maxLon: -Infinity, maxLat: -Infinity };
for (const line of decoded) {
  linesPerClass[line.cls] = (linesPerClass[line.cls] ?? 0) + 1;
  for (let k = 0; k < line.lonLat.length; k += 2) {
    bounds.minLon = Math.min(bounds.minLon, line.lonLat[k]);
    bounds.maxLon = Math.max(bounds.maxLon, line.lonLat[k]);
    bounds.minLat = Math.min(bounds.minLat, line.lonLat[k + 1]);
    bounds.maxLat = Math.max(bounds.maxLat, line.lonLat[k + 1]);
  }
}
for (const key of Object.keys(bounds)) bounds[key] = Number(bounds[key].toFixed(5));

// Saved pages carry the server's own time stamp; a download is dated now.
const retrievedAt = pagesDir && first.timeStamp ? Date.parse(first.timeStamp) : Date.now();
const sidecar = {
  file: 'roads-vic.bin',
  snapshotDate: new Date(retrievedAt).toISOString().slice(0, 10),
  retrievedAt,
  source: SOURCE,
  classes: CLASSES,
  featuresPerClass,
  linesPerClass,
  lines,
  points,
  toleranceM: TOLERANCE_M,
  gridM: FRAME.gridM,
  bounds,
  bytes: bytes.length,
  gzipBytes: gzipSync(bytes, { level: 9 }).length,
};

const outputDir = new URL('../public/data/', import.meta.url);
mkdirSync(outputDir, { recursive: true });
writeFileSync(new URL('roads-vic.bin', outputDir), bytes);
writeFileSync(new URL('roads-vic.json', outputDir), `${JSON.stringify(sidecar, null, 2)}\n`);

const indexUrl = new URL('index.json', outputDir);
const index = existsSync(indexUrl) ? JSON.parse(readFileSync(indexUrl, 'utf8')) : {};
index.roads = { file: 'roads-vic.bin', sidecar: 'roads-vic.json', retrievedAt };
writeFileSync(indexUrl, `${JSON.stringify(index, null, 2)}\n`);

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(
  `${pieces.length} pieces joined into ${joined.length} lines; ${lines} kept, ${dropped} shorter than the grid; ${points} points`,
);
console.log(`roads-vic.bin: ${kb(bytes.length)} raw, ${kb(sidecar.gzipBytes)} gzip; ${((Date.now() - started) / 1000).toFixed(0)} s`);
