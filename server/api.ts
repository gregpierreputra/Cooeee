import { createServer, type Server } from 'node:http';
import { FACILITY_SOURCE } from '../src/core/facility-sources.ts';
import type { DynamicSnapshot, FacilityType, SourceHealth, StaticBundle } from '../src/core/types.ts';
import { type Db, nowIso } from './db.ts';
import { findNearest, type Point } from './geo.ts';
import { dataHealth } from './sources.ts';

type Route = { status: number; body: unknown };
type Params = URLSearchParams;

const HOTLINE = 'Call the VicEmergency Hotline on 1800 226 226.';

const SOURCE_NAME: Record<string, string> = {
  cfa_nsp_arcgis: 'CFA Neighbourhood Safer Places list',
  cfr_static_list: 'Community Fire Refuge list',
  vicmap_admin_postcodes: 'Vicmap postcode list',
  vicemergency_feed: 'VicEmergency feed',
};

type TypeRow = { type_code: FacilityType; description: string; is_dynamic: number };
type FacilityRow = Point & {
  facility_id: number;
  name: string;
  address: string | null;
  designation_status: string;
  last_verified_at: string;
};
type ActivationRow = Point & {
  activation_id: number;
  name: string;
  address: string | null;
  status: string;
  source_updated_at: string;
};
type Query = { postcode: string | null; lat: number; lon: number };

const round1 = (km: number): number => Math.round(km * 10) / 10;

/** Where to search from. A four-digit postcode is looked up in the Victorian
 *  list; otherwise finite lat/lon within range. Anything else is refused. */
function parseQuery(db: Db, params: Params): { query: Query } | { error: Route } {
  const postcode = params.get('postcode');
  if (postcode !== null) {
    if (!/^\d{4}$/.test(postcode)) return { error: { status: 400, body: { error: 'postcode must be four digits' } } };
    const row = db
      .prepare('SELECT centroid_lat AS lat, centroid_lon AS lon FROM postcodes WHERE postcode = ?')
      .get(postcode) as Point | undefined;
    if (!row) return { error: { status: 404, body: { error: 'postcode not found in the Victorian list' } } };
    return { query: { postcode, lat: row.lat, lon: row.lon } };
  }
  const lat = Number(params.get('lat'));
  const lon = Number(params.get('lon'));
  const valid =
    params.has('lat') && params.has('lon') &&
    Number.isFinite(lat) && Number.isFinite(lon) &&
    Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  if (!valid) return { error: { status: 400, body: { error: 'provide postcode=NNNN, or lat and lon' } } };
  return { query: { postcode: null, lat, lon } };
}

/** Spec §5/§6: why a result is null, or why it cannot be trusted as current.
 *  A missing designation and an unreachable source are different sentences. */
function message(type: TypeRow, found: boolean, source: SourceHealth): string | null {
  const name = SOURCE_NAME[FACILITY_SOURCE[type.type_code]];
  if (source.status === 'degraded' || source.status === 'down') {
    return `Live data could not be confirmed: the ${name} is ${source.status} (last successful update: ${source.last_success_at ?? 'never'}). ${HOTLINE}`;
  }
  if (found) return null;
  if (source.status === 'unknown') return `The ${name} has not been loaded yet. ${HOTLINE}`;
  return type.is_dynamic
    ? `No ${type.description} is currently open according to the VicEmergency feed.`
    : `No ${type.description} is designated near this location. ${type.description}s apply to bushfire risk only.`;
}

function safeLocations(db: Db, params: Params): Route {
  const parsed = parseQuery(db, params);
  if ('error' in parsed) return parsed.error;
  const { query } = parsed;
  const health = dataHealth(db);
  const types = db.prepare('SELECT type_code, description, is_dynamic FROM facility_types').all() as unknown as TypeRow[];
  const precomputed = db.prepare(
    `SELECT n.distance_km, f.facility_id, f.name, f.address, f.lat, f.lon, f.designation_status, f.last_verified_at
     FROM postcode_nearest_static n LEFT JOIN facilities f ON f.facility_id = n.facility_id
     WHERE n.postcode = ? AND n.type_code = ?`,
  );

  const results = types.map((type) => {
    const source = health[FACILITY_SOURCE[type.type_code]] ?? { status: 'unknown', last_success_at: null };

    if (type.is_dynamic) {
      const nearest = findNearest<ActivationRow>(db, 'activations', query, type.type_code);
      return {
        type: type.type_code,
        facility: nearest
          ? { facility_id: null, activation_id: nearest.row.activation_id, name: nearest.row.name, address: nearest.row.address, lat: nearest.row.lat, lon: nearest.row.lon }
          : null,
        distance_km: nearest ? round1(nearest.distanceKm) : null,
        status: nearest?.row.status ?? null,
        source_updated_at: nearest?.row.source_updated_at ?? null,
        message: message(type, nearest !== null, source),
      };
    }

    // Postcode queries read the precomputed table (spec §3); a point query, or a
    // postcode not yet computed, runs the same search live.
    const cached = query.postcode
      ? (precomputed.get(query.postcode, type.type_code) as (FacilityRow & { distance_km: number | null }) | undefined)
      : undefined;
    const live = cached ? null : findNearest<FacilityRow>(db, 'facilities', query, type.type_code);
    const row = cached?.facility_id ? cached : live?.row ?? null;
    const distanceKm = cached ? cached.distance_km : live ? live.distanceKm : null;
    return {
      type: type.type_code,
      facility: row
        ? { facility_id: row.facility_id, name: row.name, address: row.address, lat: row.lat, lon: row.lon, designation_status: row.designation_status, last_verified_at: row.last_verified_at }
        : null,
      distance_km: distanceKm === null ? null : round1(distanceKm),
      message: message(type, row !== null, source),
    };
  });

  return { status: 200, body: { query, results, data_health: health } };
}

// Coordinates leave rounded to five decimals (about a metre): a smaller payload
// for every device, and no false precision.
function staticBundle(db: Db, params: Params): Route {
  const { version } = db
    .prepare("SELECT MAX(last_success_at) AS version FROM data_sources WHERE source_kind = 'static'")
    .get() as { version: string | null };
  // The client already holds this version: answer with the same shape and nothing to load.
  const unchanged = version !== null && params.get('since') === version;
  const body: StaticBundle = {
    version,
    generated_at: nowIso(),
    facilities: unchanged
      ? []
      : (db.prepare(
          `SELECT facility_id, type_code AS type, name, address, ROUND(lat, 5) AS lat, ROUND(lon, 5) AS lon,
                  lga_name, designation_status, last_verified_at
           FROM facilities WHERE designation_status IN ('designated', 'needs_review') ORDER BY facility_id`,
        ).all() as unknown as StaticBundle['facilities']),
    postcodes: unchanged
      ? []
      : (db.prepare(
          'SELECT postcode, ROUND(centroid_lat, 5) AS centroid_lat, ROUND(centroid_lon, 5) AS centroid_lon FROM postcodes ORDER BY postcode',
        ).all() as unknown as StaticBundle['postcodes']),
    data_health: dataHealth(db),
  };
  return { status: 200, body };
}

function dynamicSnapshot(db: Db): Route {
  const feed: SourceHealth = dataHealth(db).vicemergency_feed ?? { status: 'unknown', last_success_at: null };
  const body: DynamicSnapshot = {
    generated_at: nowIso(),
    source_status: feed.status,
    source_last_success_at: feed.last_success_at,
    activations: db.prepare(
      `SELECT activation_id, type_code AS type, name, address, ROUND(lat, 5) AS lat, ROUND(lon, 5) AS lon, source_updated_at
       FROM activations WHERE status = 'active' ORDER BY activation_id`,
    ).all() as unknown as DynamicSnapshot['activations'],
  };
  return { status: 200, body };
}

// Status and timestamps only. last_error carries upstream-authored text and
// endpoint_url the internal topology; both stay in the database for operators.
const health = (db: Db): Route => ({
  status: 200,
  body: {
    generated_at: nowIso(),
    sources: db.prepare(
      `SELECT source_id, name, source_kind, status, last_attempt_at, last_success_at, consecutive_failures
       FROM data_sources`,
    ).all(),
  },
});

/** The whole read-only API (spec §5), as a pure function of the request. */
export function route(db: Db, method: string, url: URL): Route {
  if (method !== 'GET' && method !== 'HEAD') return { status: 405, body: { error: 'method not allowed' } };
  switch (url.pathname) {
    case '/api/v1/safe-locations':
      return safeLocations(db, url.searchParams);
    case '/api/v1/sync/static-bundle':
      return staticBundle(db, url.searchParams);
    case '/api/v1/sync/dynamic-snapshot':
      return dynamicSnapshot(db);
    case '/api/v1/health':
      return health(db);
    default:
      return { status: 404, body: { error: 'not found' } };
  }
}

export function createApi(db: Db): Server {
  return createServer((request, response) => {
    const method = request.method ?? 'GET';
    let result: Route;
    try {
      result = route(db, method, new URL(request.url ?? '/', 'http://localhost'));
    } catch (error) {
      console.error('[api]', error);
      result = { status: 500, body: { error: 'internal error' } };
    }
    const payload = JSON.stringify(result.body);
    response.writeHead(result.status, {
      'content-type': 'application/json; charset=utf-8',
      'content-length': Buffer.byteLength(payload),
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...(result.status === 405 ? { allow: 'GET, HEAD' } : {}),
    });
    response.end(method === 'HEAD' ? undefined : payload);
  });
}

