import { isInsideVictoria, MAX_TEXT_CHARS } from '../../src/core/constants.ts';
import { readJsonBounded } from '../../src/data/bounded-body.ts';
import type { Db } from '../db.ts';
import { runSync } from '../sources.ts';
import { type FacilityInput, rebuildNearestStatic, upsertFacilities } from './static.ts';

// Libraries, community centres and pools from Vicmap Features of Interest
// (DTP, CC BY 4.0): places a person can spend the hottest hours of a heat day.
// Listed as facilities only; no row is ever called a refuge or said to be open.
export const SOURCE_ID = 'vicmap_foi_cool';
const WFS_URL = 'https://opendata.maps.vic.gov.au/geoserver/wfs';
const FETCH_TIMEOUT_MS = 120_000;
const MAX_BODY_BYTES = 20 * 1_048_576;
const SUBTYPES = ['library', 'community centre', 'swimming pool'];

type Feature = {
  geometry?: { type?: string; coordinates?: unknown } | null;
  properties?: Record<string, unknown> | null;
};

/** One FOI point → one COOL facility, or null when it is not a usable place. */
export function toFacility(feature: Feature): FacilityInput | null {
  const props = feature.properties ?? {};
  const name = typeof props.name_label === 'string' ? props.name_label.trim().slice(0, MAX_TEXT_CHARS) : '';
  const ref = props.pfi;
  if (!name || (typeof ref !== 'number' && typeof ref !== 'string')) return null;
  // The filter is in the request, and checked again here: only the three kinds asked for.
  if (!SUBTYPES.includes(String(props.feature_subtype).toLowerCase())) return null;
  // The layer answers with a one-member MultiPoint; a plain Point is taken too.
  const geometry = feature.geometry;
  const coordinates =
    geometry?.type === 'MultiPoint' && Array.isArray(geometry.coordinates)
      ? (geometry.coordinates[0] as unknown)
      : geometry?.type === 'Point'
        ? geometry.coordinates
        : null;
  if (!Array.isArray(coordinates)) return null;
  const [lon, lat] = coordinates as unknown[];
  if (typeof lat !== 'number' || typeof lon !== 'number' || !isInsideVictoria(lat, lon)) return null;
  return { externalRef: String(ref), typeCode: 'COOL', name, address: null, lat, lon, lgaName: null };
}

export async function fetchCoolPlaces(
  fetcher: typeof fetch = fetch,
): Promise<{ rows: FacilityInput[]; skipped: number }> {
  const params = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: 'open-data-platform:foi_point',
    outputFormat: 'application/json',
    propertyName: 'pfi,name_label,feature_subtype,geom',
    CQL_FILTER: `feature_subtype IN (${SUBTYPES.map((s) => `'${s}'`).join(',')})`,
    count: '5000',
  });
  const response = await fetcher(`${WFS_URL}?${params}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Vicmap FOI layer returned HTTP ${response.status}`);
  const payload = (await readJsonBounded(response, MAX_BODY_BYTES)) as { features?: unknown; numberMatched?: unknown };
  if (!Array.isArray(payload.features)) throw new TypeError('Vicmap FOI layer: features must be an array');
  // A cut-off page would flag every row past the cut for review on the next run.
  if (typeof payload.numberMatched === 'number' && payload.numberMatched > payload.features.length) {
    throw new Error('Vicmap FOI layer: more rows matched than were returned');
  }
  const rows: FacilityInput[] = [];
  let skipped = 0;
  for (const feature of payload.features as Feature[]) {
    const row = toFacility(feature);
    if (row) rows.push(row);
    else skipped += 1;
  }
  return { rows, skipped };
}

export const syncCool = (db: Db, fetcher: typeof fetch = fetch): Promise<boolean> =>
  runSync(db, SOURCE_ID, async () => {
    const { rows, skipped } = await fetchCoolPlaces(fetcher);
    const counts = upsertFacilities(db, SOURCE_ID, rows);
    rebuildNearestStatic(db);
    return { ...counts, skipped };
  });
