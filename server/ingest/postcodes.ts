import { isInsideVictoria } from '../../src/core/constants.ts';
import { readJsonBounded } from '../../src/data/bounded-body.ts';
import { type Db, nowIso, transaction } from '../db.ts';
import { runSync, type SyncCounts } from '../sources.ts';
import { rebuildNearestStatic } from './static.ts';

export const SOURCE_ID = 'vicmap_admin_postcodes';
const WFS_URL = 'https://opendata.maps.vic.gov.au/geoserver/wfs';
const FETCH_TIMEOUT_MS = 120_000;
const MAX_BODY_BYTES = 20 * 1_048_576; // the full polygon layer is about 2 MB

type Ring = [number, number][];
type Feature = {
  geometry?: { type?: string; coordinates?: unknown } | null;
  properties?: Record<string, unknown> | null;
};
export type PostcodeInput = { postcode: string; lat: number; lon: number };

/** Area-weighted centroid of a ring (shoelace formula), with its absolute area. */
export function ringCentroid(ring: Ring): { lat: number; lon: number; area: number } {
  let twiceArea = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    const cross = x1 * y2 - x2 * y1;
    twiceArea += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  if (twiceArea === 0) return { lon: ring[0][0], lat: ring[0][1], area: 0 };
  return { lon: cx / (3 * twiceArea), lat: cy / (3 * twiceArea), area: Math.abs(twiceArea / 2) };
}

/** The centroid of the largest polygon of a (Multi)Polygon: a representative
 *  point for the postcode, nothing more. Null for a row that is not usable. */
export function toPostcode(feature: Feature): PostcodeInput | null {
  const postcode = feature.properties?.postcode;
  if (typeof postcode !== 'string' || !/^\d{4}$/.test(postcode)) return null;
  const geometry = feature.geometry;
  const polygons =
    geometry?.type === 'MultiPolygon'
      ? (geometry.coordinates as Ring[][])
      : geometry?.type === 'Polygon'
        ? [geometry.coordinates as Ring[]]
        : [];
  let largest: ReturnType<typeof ringCentroid> | null = null;
  for (const polygon of polygons) {
    const centroid = ringCentroid(polygon[0]); // the outer ring
    if (largest === null || centroid.area > largest.area) largest = centroid;
  }
  // A centroid outside Victoria is an axis-order mistake, not a place.
  if (largest === null || !isInsideVictoria(largest.lat, largest.lon)) return null;
  return { postcode, lat: largest.lat, lon: largest.lon };
}

export async function fetchPostcodes(
  fetcher: typeof fetch = fetch,
): Promise<{ rows: PostcodeInput[]; skipped: number }> {
  const params = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: 'open-data-platform:vmlite_postcode_polygon',
    outputFormat: 'application/json',
    count: '1000',
  });
  const response = await fetcher(`${WFS_URL}?${params}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Vicmap postcode layer returned HTTP ${response.status}`);
  const payload = (await readJsonBounded(response, MAX_BODY_BYTES)) as { features?: unknown };
  if (!Array.isArray(payload.features)) throw new TypeError('Vicmap postcode layer: features must be an array');
  const rows: PostcodeInput[] = [];
  let skipped = 0;
  for (const feature of payload.features as Feature[]) {
    const row = toPostcode(feature);
    if (row) rows.push(row);
    else skipped += 1;
  }
  return { rows, skipped };
}

/** Same rule as facilities: an empty run never touches the table.
 *  postcodes_rtree stays empty on purpose — nothing resolves a point back to a
 *  postcode yet. Fill it, and store boundaries, when that lookup is needed. */
export function upsertPostcodes(db: Db, rows: PostcodeInput[]): SyncCounts {
  if (rows.length === 0) throw new Error('upstream returned no postcodes — existing rows left untouched');
  const now = nowIso();
  const existing = db.prepare('SELECT 1 FROM postcodes WHERE postcode = ?');
  const upsert = db.prepare(
    `INSERT INTO postcodes (postcode, centroid_lat, centroid_lon, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(postcode) DO UPDATE SET
       centroid_lat = excluded.centroid_lat, centroid_lon = excluded.centroid_lon, updated_at = excluded.updated_at`,
  );
  return transaction(db, () => {
    let added = 0;
    let updated = 0;
    for (const row of rows) {
      if (existing.get(row.postcode)) updated += 1;
      else added += 1;
      upsert.run(row.postcode, row.lat, row.lon, now);
    }
    return { seen: rows.length, added, updated };
  });
}

export const syncPostcodes = (db: Db, fetcher: typeof fetch = fetch): Promise<boolean> =>
  runSync(db, SOURCE_ID, async () => {
    const { rows, skipped } = await fetchPostcodes(fetcher);
    const counts = upsertPostcodes(db, rows);
    rebuildNearestStatic(db);
    return { ...counts, skipped };
  });
