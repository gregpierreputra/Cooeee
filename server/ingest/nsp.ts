import { isInsideVictoria } from '../../src/core/constants.ts';
import type { Db } from '../db.ts';
import { runSync } from '../sources.ts';
import { type FacilityInput, rebuildNearestStatic, upsertFacilities } from './static.ts';

export const SOURCE_ID = 'cfa_nsp_arcgis';
const QUERY_URL =
  'https://services-ap1.arcgis.com/vh59f3ZyAEAhnejO/ArcGIS/rest/services/MY_CFA_Data_Layers_V2/FeatureServer/2/query';
const PAGE_SIZE = 1000;
const FETCH_TIMEOUT_MS = 30_000;

type Feature = {
  geometry?: { type?: string; coordinates?: unknown } | null;
  properties?: Record<string, unknown> | null;
};

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

/** One ArcGIS feature → one facility, or null when it lacks an id, a name or a point. */
export function toFacility(feature: Feature): FacilityInput | null {
  const props = feature.properties ?? {};
  const externalRef = text(props.nsp_id);
  const name = text(props.nsp_name);
  const coords = feature.geometry?.type === 'Point' ? feature.geometry.coordinates : null;
  if (!externalRef || !name || !Array.isArray(coords)) return null;
  const [lon, lat] = coords as unknown[];
  if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }
  if (!isInsideVictoria(lat, lon)) return null; // a transposed or foreign point is not a place to go
  return { externalRef, typeCode: 'NSP', name, address: text(props.address), lat, lon, lgaName: text(props.lga) };
}

/** Every page of the layer, following ArcGIS's exceededTransferLimit paging. */
export async function fetchNspFacilities(
  fetcher: typeof fetch = fetch,
): Promise<{ rows: FacilityInput[]; skipped: number }> {
  const rows: FacilityInput[] = [];
  let skipped = 0;
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const params = new URLSearchParams({
      f: 'geojson',
      where: '1=1',
      outFields: '*',
      resultOffset: String(offset),
      resultRecordCount: String(PAGE_SIZE),
    });
    const response = await fetcher(`${QUERY_URL}?${params}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`CFA NSP layer returned HTTP ${response.status}`);
    const page = (await response.json()) as {
      features?: unknown;
      properties?: { exceededTransferLimit?: boolean };
    };
    if (!Array.isArray(page.features)) throw new TypeError('CFA NSP layer: features must be an array');
    for (const feature of page.features as Feature[]) {
      const row = toFacility(feature);
      if (row) rows.push(row);
      else skipped += 1;
    }
    if (page.features.length === 0 || !page.properties?.exceededTransferLimit) break;
  }
  return { rows, skipped };
}

export const syncNsp = (db: Db, fetcher: typeof fetch = fetch): Promise<boolean> =>
  runSync(db, SOURCE_ID, async () => {
    const { rows, skipped } = await fetchNspFacilities(fetcher);
    const counts = upsertFacilities(db, SOURCE_ID, rows);
    rebuildNearestStatic(db);
    return { ...counts, skipped };
  });
