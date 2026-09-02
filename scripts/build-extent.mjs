import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const WFS_URL = 'https://opendata.maps.vic.gov.au/geoserver/wfs';
// Safety margin above the current 76 features so the layer can grow.
const COUNT = 500;

function assertRecord(value, field) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object`);
  }
}

async function publishedBpaLgas() {
  const names = new Set();
  const params = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    outputFormat: 'application/json',
    typeNames: 'open-data-platform:bushfire_prone_area',
    propertyName: 'lga_name',
    count: String(COUNT),
  });
  const response = await fetch(`${WFS_URL}?${params}`);
  if (!response.ok) throw new Error(`BPA extent request returned HTTP ${response.status}`);
  if (!(response.headers.get('content-type') ?? '').includes('json')) {
    throw new Error(`BPA extent request returned non-JSON: ${(await response.text()).slice(0, 300)}`);
  }
  const payload = await response.json();
  assertRecord(payload, 'response');
  if (!Array.isArray(payload.features)) throw new TypeError('response.features must be an array');
  if (typeof payload.numberMatched === 'number' && payload.numberMatched > payload.features.length) {
    throw new Error(
      `layer has ${payload.numberMatched} features, more than count=${COUNT} — raise COUNT`,
    );
  }

  for (const [index, feature] of payload.features.entries()) {
    assertRecord(feature, `features[${index}]`);
    assertRecord(feature.properties, `features[${index}].properties`);
    if (typeof feature.properties.lga_name !== 'string') {
      throw new TypeError(`features[${index}].properties.lga_name must be a string`);
    }
    names.add(feature.properties.lga_name);
  }

  return [...names].sort();
}

const retrievedAt = Date.now();
const date = new Date(retrievedAt).toISOString().slice(0, 10);
const file = `layer-extent.v${date}.json`;
const outputDir = new URL('../public/data/', import.meta.url);
mkdirSync(outputDir, { recursive: true });

const snapshot = {
  version: `v${date}`,
  retrievedAt,
  source: {
    publisher: 'Department of Transport and Planning',
    url: WFS_URL,
    licence: 'CC BY 4.0',
  },
  layers: { BPA: { publishedIn: await publishedBpaLgas() } },
};

writeFileSync(new URL(file, outputDir), `${JSON.stringify(snapshot, null, 2)}\n`);
// index.json is shared with build-nsp.mjs: merge this script's key, keep the rest.
const indexUrl = new URL('index.json', outputDir);
const index = existsSync(indexUrl) ? JSON.parse(readFileSync(indexUrl, 'utf8')) : {};
index.layerExtent = { file, retrievedAt };
writeFileSync(indexUrl, `${JSON.stringify(index, null, 2)}\n`);

console.log(`extent: wrote ${snapshot.layers.BPA.publishedIn.length} BPA LGAs to ${file}`);
