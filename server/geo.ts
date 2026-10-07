import { type Db, statement } from './db.ts';

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
// The same earth as haversineKm, so the box never falls short of the radius.
const KM_PER_DEGREE_LAT = (EARTH_RADIUS_KM * Math.PI) / 180;
// Longitude degrees shrink unevenly across the box, so it is drawn a little wide.
const BOX_MARGIN = 1.01;

type Box = { minLat: number; maxLat: number; minLon: number; maxLon: number };

function boundingBox(origin: Point, radiusKm: number): Box {
  if (!Number.isFinite(radiusKm)) return { minLat: -90, maxLat: 90, minLon: -180, maxLon: 180 };
  const dLat = (radiusKm * BOX_MARGIN) / KM_PER_DEGREE_LAT;
  const dLon = (radiusKm * BOX_MARGIN) / (KM_PER_DEGREE_LAT * Math.cos(toRadians(origin.lat)));
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
  const query = statement(db, CANDIDATES[table]);
  for (const radiusKm of RADII_KM) {
    const box = boundingBox(origin, radiusKm);
    const rows = query.all(box.minLat, box.maxLat, box.minLon, box.maxLon, typeCode) as unknown as T[];
    if (rows.length === 0) continue;
    let nearest: Nearest<T> | null = null;
    for (const row of rows) {
      const distanceKm = haversineKm(origin, row);
      if (nearest === null || distanceKm < nearest.distanceKm) nearest = { row, distanceKm };
    }
    // The box is a square, so its corners reach further than its radius. A row
    // found out in a corner may be beaten by one just outside the box's side,
    // and only the next, wider box can see that one.
    if (nearest !== null && nearest.distanceKm <= radiusKm) return nearest;
  }
  return null;
}
