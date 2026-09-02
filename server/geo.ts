import type { Db } from './db.ts';

export type Point = { lat: number; lon: number };

const EARTH_RADIUS_KM = 6371.0088;
const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** Great-circle distance in kilometres (haversine). Shared by the per-postcode
 *  precompute and the live query path, so the two can never disagree. */
export function haversineKm(a: Point, b: Point): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

// Spec §4: widen the search box step by step, then look statewide.
const RADII_KM = [20, 50, 250, Infinity];
const KM_PER_DEGREE_LAT = 111.32;

type Box = { minLat: number; maxLat: number; minLon: number; maxLon: number };

function boundingBox(origin: Point, radiusKm: number): Box {
  if (!Number.isFinite(radiusKm)) return { minLat: -90, maxLat: 90, minLon: -180, maxLon: 180 };
  const dLat = radiusKm / KM_PER_DEGREE_LAT;
  const dLon = radiusKm / (KM_PER_DEGREE_LAT * Math.cos(toRadians(origin.lat)));
  return {
    minLat: origin.lat - dLat,
    maxLat: origin.lat + dLat,
    minLon: origin.lon - dLon,
    maxLon: origin.lon + dLon,
  };
}

// Only rows a person could go to: a decommissioned or merely candidate facility
// is never offered, and neither is a closed activation.
const CANDIDATES = {
  facilities: `
    SELECT f.* FROM facilities f JOIN facilities_rtree r ON r.id = f.facility_id
    WHERE r.max_lat >= ? AND r.min_lat <= ? AND r.max_lon >= ? AND r.min_lon <= ?
      AND f.type_code = ? AND f.designation_status IN ('designated', 'needs_review')`,
  activations: `
    SELECT a.* FROM activations a JOIN activations_rtree r ON r.id = a.activation_id
    WHERE r.max_lat >= ? AND r.min_lat <= ? AND r.max_lon >= ? AND r.min_lon <= ?
      AND a.type_code = ? AND a.status = 'active'`,
} as const;

export type Nearest<T> = { row: T; distanceKm: number };

/** The nearest row of one type, or null when the table holds none statewide —
 *  a normal answer, not an error. */
export function findNearest<T extends Point>(
  db: Db,
  table: keyof typeof CANDIDATES,
  origin: Point,
  typeCode: string,
): Nearest<T> | null {
  const query = db.prepare(CANDIDATES[table]);
  for (const radiusKm of RADII_KM) {
    const box = boundingBox(origin, radiusKm);
    const rows = query.all(box.minLat, box.maxLat, box.minLon, box.maxLon, typeCode) as unknown as T[];
    if (rows.length === 0) continue;
    let nearest: Nearest<T> | null = null;
    for (const row of rows) {
      const distanceKm = haversineKm(origin, row);
      if (nearest === null || distanceKm < nearest.distanceKm) nearest = { row, distanceKm };
    }
    return nearest;
  }
  return null;
}
