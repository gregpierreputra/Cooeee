// Builds the precached CFA Neighbourhood Safer Places snapshot from the CFA's own
// public map layer — the state-wide official list, every site geocoded by the
// CFA. Writes public/data/nsp.v<date>.json and registers it in index.json.
// Run: npm run build:data:nsp (only when the CFA list changes).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// The CFA's own page for the list: the source a saved place opens. The layer
// behind it is what the script reads.
const SOURCE_URL =
  'https://www.cfa.vic.gov.au/plan-prepare/your-local-area-info-and-advice/neighbourhood-safer-places';
const LAYER_URL =
  'https://services-ap1.arcgis.com/vh59f3ZyAEAhnejO/ArcGIS/rest/services/MY_CFA_Data_Layers_V2/FeatureServer/2';
const PAGE_SIZE = 1000;

const text = (value) => (typeof value === 'string' && value.trim() ? value.trim() : '');
const isoDate = (epochMs) => new Date(epochMs).toISOString().slice(0, 10);

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`CFA NSP layer returned HTTP ${response.status}`);
  return response.json();
}

/** One ArcGIS feature → one NspSite, or null when it lacks an id, a name or a point. */
function toSite(feature) {
  const props = feature.properties ?? {};
  const id = text(props.nsp_id);
  const name = text(props.nsp_name);
  const municipality = text(props.lga);
  const coords = feature.geometry?.type === 'Point' ? feature.geometry.coordinates : null;
  if (!id || !name || !municipality || !Array.isArray(coords)) return null;
  const [lon, lat] = coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return {
    id: `nsp-${id}`,
    municipality,
    township: text(props.township),
    name,
    subLocation: text(props.location),
    street: text(props.address),
    geocode: 'exact',
    lat: Number(lat.toFixed(5)),
    lon: Number(lon.toFixed(5)),
    ...(typeof props.date_desig === 'number' ? { designatedAt: isoDate(props.date_desig) } : {}),
  };
}

/** Every page of the layer, following ArcGIS's exceededTransferLimit paging. */
async function fetchSites() {
  const sites = [];
  let skipped = 0;
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const params = new URLSearchParams({
      f: 'geojson',
      where: '1=1',
      outFields: 'nsp_id,nsp_name,township,location,address,lga,date_desig',
      resultOffset: String(offset),
      resultRecordCount: String(PAGE_SIZE),
    });
    const page = await getJson(`${LAYER_URL}/query?${params}`);
    if (!Array.isArray(page.features)) throw new TypeError('features must be an array');
    for (const feature of page.features) {
      const site = toSite(feature);
      if (site) sites.push(site);
      else skipped += 1;
    }
    if (page.features.length === 0 || !page.properties?.exceededTransferLimit) break;
  }
  return { sites, skipped };
}

const retrievedAt = Date.now();
const layer = await getJson(`${LAYER_URL}?f=json`);
const listAsAt = isoDate(layer.editingInfo?.dataLastEditDate ?? retrievedAt);
const { sites, skipped } = await fetchSites();
if (sites.length === 0) throw new Error('CFA NSP layer returned no usable sites');

const file = `nsp.v${isoDate(retrievedAt)}.json`;
const outputDir = new URL('../public/data/', import.meta.url);
mkdirSync(outputDir, { recursive: true });

const snapshot = {
  listAsAt,
  retrievedAt,
  source: {
    publisher: 'Country Fire Authority',
    url: SOURCE_URL,
    licence: 'CFA public map layer — licence to be confirmed',
    retrievedAt,
  },
  sites,
};
writeFileSync(new URL(file, outputDir), `${JSON.stringify(snapshot)}\n`);

// index.json is shared with build-extent.mjs: merge this script's key, keep the rest.
const indexUrl = new URL('index.json', outputDir);
const index = existsSync(indexUrl) ? JSON.parse(readFileSync(indexUrl, 'utf8')) : {};
index.nsp = { file, retrievedAt };
writeFileSync(indexUrl, `${JSON.stringify(index, null, 2)}\n`);

console.log(`nsp: wrote ${sites.length} sites (${skipped} skipped) as at ${listAsAt} to ${file}`);
