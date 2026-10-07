import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import { gzipSync } from 'node:zlib';
import { isInsideVictoria } from '../src/core/constants.ts';
import { DYNAMIC_TYPES, FACILITY_SOURCE, STATIC_TYPES } from '../src/core/facility-sources.ts';
import type { DynamicSnapshot, FacilityType, SourceHealth, StaticBundle } from '../src/core/types.ts';
import { type Db, nowIso, statement } from './db.ts';
import { findNearest, type Point } from './geo.ts';
import { checkGate, readJson } from './gate.ts';
import { dataHealth } from './sources.ts';

export type Route = { status: number; body: unknown };
type Params = URLSearchParams;

const HOTLINE = 'Call the VicEmergency Hotline on 1800 226 226.';

const SOURCE_NAME: Record<string, string> = {
  cfa_nsp_arcgis: 'Country Fire Authority Neighbourhood Safer Places list',
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
 *  list; otherwise a plain decimal lat and lon inside Victoria. Anything else,
 *  hex or exponent forms included, is refused. */
function parseQuery(db: Db, params: Params): { query: Query } | { error: Route } {
  const postcode = params.get('postcode');
  if (postcode !== null) {
    if (!/^\d{4}$/.test(postcode)) return { error: { status: 400, body: { error: 'postcode must be four digits' } } };
    const row = statement(db, 'SELECT centroid_lat AS lat, centroid_lon AS lon FROM postcodes WHERE postcode = ?')
      .get(postcode) as Point | undefined;
    if (!row) return { error: { status: 404, body: { error: 'postcode not found in the Victorian list' } } };
    return { query: { postcode, lat: row.lat, lon: row.lon } };
  }
  const coordinate = (key: string): number => {
    const text = params.get(key)?.trim() ?? '';
    return /^-?\d{1,3}(\.\d{1,10})?$/.test(text) ? Number(text) : NaN;
  };
  const lat = coordinate('lat');
  const lon = coordinate('lon');
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { error: { status: 400, body: { error: 'provide postcode=NNNN, or lat and lon' } } };
  }
  if (!isInsideVictoria(lat, lon)) return { error: { status: 400, body: { error: 'lat and lon must be in Victoria' } } };
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
  // Only the types this code knows how to answer for, whatever else the table holds.
  const known = [...STATIC_TYPES, ...DYNAMIC_TYPES];
  const types = statement(
    db,
    `SELECT type_code, description, is_dynamic FROM facility_types
     WHERE type_code IN (${known.map(() => '?').join(', ')})`,
  ).all(...known) as unknown as TypeRow[];
  const precomputed = statement(db,
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
  // The newest of the last successful sync and the newest row: a sync that
  // changed rows but failed afterwards still gives a new version.
  const { version } = statement(
    db,
    `SELECT MAX(at) AS version FROM (
       SELECT MAX(last_success_at) AS at FROM data_sources WHERE source_kind = 'static'
       UNION ALL SELECT MAX(updated_at) FROM facilities
       UNION ALL SELECT MAX(updated_at) FROM postcodes
     )`,
  ).get() as { version: string | null };
  // The client already holds this version: answer with the same shape and nothing to load.
  const unchanged = version !== null && params.get('since') === version;
  const body: StaticBundle = {
    version,
    generated_at: nowIso(),
    facilities: unchanged
      ? []
      : (statement(db,
          `SELECT facility_id, type_code AS type, name, address, ROUND(lat, 5) AS lat, ROUND(lon, 5) AS lon,
                  lga_name, designation_status, last_verified_at
           FROM facilities
           WHERE designation_status IN ('designated', 'needs_review')
             AND type_code IN (${STATIC_TYPES.map(() => '?').join(', ')})
           ORDER BY facility_id`,
        ).all(...STATIC_TYPES) as unknown as StaticBundle['facilities']),
    postcodes: unchanged
      ? []
      : (statement(db,
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
    activations: statement(db,
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
    sources: statement(db,
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

// A per-address request budget. The API is public and every query runs
// synchronously on the one event loop, so one client must not be able to occupy
// it. A fixed one-minute window is enough for a read-only, device-cached feature.
const RATE_LIMIT_PER_MINUTE = 60;
const WINDOW_MS = 60_000;
const budgets = new Map<string, { count: number; windowStart: number }>();

// The per-address budget trusts the address the proxy reports, and a client that
// reaches this host directly can report a new one on every request (and so also
// reset every budget below). So requests are also counted across every address:
// past this many in a minute the API answers 429 until the minute is over,
// which caps the load no spoofed address can raise.
// ponytail: a flood can refuse honest users for up to a minute; raise the cap or
// key on a trusted proxy hop if real traffic ever comes near it.
const GLOBAL_REQUESTS_PER_MINUTE = 1_200;
let globalWindow = { start: 0, count: 0 };

/** Whether a request from this address is within its budget. Exported so the
 *  rule can be tested without binding a port. */
export function allowRequest(ip: string, now: number): boolean {
  if (now - globalWindow.start >= WINDOW_MS) globalWindow = { start: now, count: 0 };
  globalWindow.count += 1;
  if (globalWindow.count > GLOBAL_REQUESTS_PER_MINUTE) return false;
  // ponytail: clear every budget rather than expire each one; bounds memory under
  // address spoofing, and the global count above still holds. Swap for a
  // per-entry sweep if the map churns in practice.
  if (budgets.size > 10_000) budgets.clear();
  const entry = budgets.get(ip);
  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    budgets.set(ip, { count: 1, windowStart: now });
    return true;
  }
  entry.count += 1;
  return entry.count <= RATE_LIMIT_PER_MINUTE;
}

// Set by the Vercel middleware (middleware.ts) on every request it forwards:
// the secret both sides hold in PROXY_SECRET, and the client address Vercel
// measured itself, which a caller cannot write.
const PROXY_HEADER = 'x-cooeee-proxy';
const CLIENT_HEADER = 'x-cooeee-client';

const sha256 = (text: string): Buffer => createHash('sha256').update(text).digest();

/** Whether the request came through the Vercel middleware. Hashed first so the
 *  comparison takes the same time whatever was sent. */
function fromProxy(request: IncomingMessage, secret: string): boolean {
  const sent = request.headers[PROXY_HEADER];
  return typeof sent === 'string' && timingSafeEqual(sha256(sent), sha256(secret));
}

/** The address a request came from. Behind the middleware it is the address
 *  Vercel measured. Without a configured secret (local development) it is the
 *  first x-forwarded-for entry, which a caller can write; the socket itself is
 *  the proxy, and keying on it would give every user one shared budget. */
function clientAddress(request: IncomingMessage, proxied: boolean): string {
  const header = (name: string) => {
    const value = request.headers[name];
    return (Array.isArray(value) ? value[0] : value)?.split(',')[0].trim();
  };
  const address = proxied ? header(CLIENT_HEADER) : header('x-forwarded-for') || request.socket.remoteAddress;
  return addressKey(address || 'unknown');
}

/** The key a budget is kept under. One home or phone is handed a whole IPv6
 *  /64, so an IPv6 address is keyed on its first four groups: keyed whole, one
 *  client would have endless fresh budgets. Exported so it can be tested. */
export function addressKey(ip: string): string {
  if (!ip.includes(':') || ip.toLowerCase().startsWith('::ffff:')) return ip;
  const [head, tail] = ip.toLowerCase().split('%')[0].split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const groups = tail === undefined ? left : [...left, ...Array(8 - left.length - right.length).fill('0'), ...right];
  return `${groups.slice(0, 4).map((group) => group.replace(/^0+(?=.)/, '')).join(':')}::/64`;
}

const GATE_BODY_MAX_BYTES = 1024;

/** The one POST: the development gate. Read here, not in route(), so route()
 *  stays a pure function of the URL. */
async function gate(request: IncomingMessage, gatePassword: string | undefined, address: string): Promise<Route> {
  // JSON only: a plain-text post from another site skips the browser's
  // cross-origin check, and must not reach the password.
  if (!/^application\/json\b/i.test(request.headers['content-type'] ?? '')) {
    return { status: 415, body: { error: 'unsupported media type' } };
  }
  if (Number(request.headers['content-length']) > GATE_BODY_MAX_BYTES) {
    return { status: 413, body: { error: 'request too large' } };
  }
  let body: unknown;
  try {
    body = await readJson(request, GATE_BODY_MAX_BYTES);
  } catch {
    return { status: 400, body: { error: 'bad request' } };
  }
  const password = typeof body === 'object' && body !== null ? (body as { password?: unknown }).password : undefined;
  return checkGate(gatePassword, address, password, Date.now());
}

/** The request line as a URL, or null when it is not one. A request line such
 *  as "GET //" makes the URL constructor throw, and a throw outside the handler's
 *  own try would end the process: one malformed request must never do that.
 *  Exported so the rule can be tested without binding a port. */
export function parseRequestUrl(raw: string | undefined): URL | null {
  try {
    return new URL(raw ?? '/', 'http://localhost');
  } catch {
    return null;
  }
}

// A reply this large or larger is compressed when the client accepts it: the
// static bundle is about 150 KB of JSON, and a rural phone pays for every byte.
const COMPRESS_MIN_BYTES = 1024;

/** The API. With `proxySecret` set, as in production, only requests through
 *  the Vercel middleware are answered; the one exception is the health check,
 *  which a host may call directly and which costs no budget. */
export function createApi(db: Db, gatePassword: string | undefined, proxySecret?: string): Server {
  const server = createServer(async (request, response) => {
    const method = request.method ?? 'GET';
    const url = parseRequestUrl(request.url);
    const proxied = proxySecret ? fromProxy(request, proxySecret) : false;
    let result: Route;
    try {
      if (url === null) {
        result = { status: 400, body: { error: 'bad request' } };
      } else if (proxySecret && !proxied) {
        result = url.pathname === '/api/v1/health' ? route(db, method, url) : { status: 403, body: { error: 'forbidden' } };
      } else if (!allowRequest(clientAddress(request, proxied), Date.now())) {
        result = { status: 429, body: { error: 'too many requests' } };
      } else if (method === 'POST' && url.pathname === '/api/v1/gate') {
        result = await gate(request, gatePassword, clientAddress(request, proxied));
      } else {
        result = route(db, method, url);
      }
    } catch (error) {
      console.error('[api]', error);
      result = { status: 500, body: { error: 'internal error' } };
    }
    const json = Buffer.from(JSON.stringify(result.body));
    const gzip = json.length >= COMPRESS_MIN_BYTES && /\bgzip\b/.test(String(request.headers['accept-encoding']));
    const payload = gzip ? gzipSync(json) : json;
    response.writeHead(result.status, {
      'content-type': 'application/json; charset=utf-8',
      'content-length': payload.length,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      vary: 'accept-encoding',
      ...(gzip ? { 'content-encoding': 'gzip' } : {}),
      ...(result.status === 405 ? { allow: url?.pathname === '/api/v1/gate' ? 'POST' : 'GET, HEAD' } : {}),
      ...(result.status === 429 ? { 'retry-after': String(retryAfter(result.body)) } : {}),
      // A refused body was never read, so the connection is not reused.
      ...(result.status === 413 || result.status === 415 ? { connection: 'close' } : {}),
    });
    response.end(method === 'HEAD' ? undefined : payload);
  });
  // Every request is small and answered at once, so a slow one is cut off
  // instead of holding a connection open for minutes.
  server.headersTimeout = 5_000;
  server.requestTimeout = 10_000;
  server.maxConnections = 512;
  return server;
}

function retryAfter(body: unknown): number {
  const seconds = (body as { retryAfterSeconds?: unknown }).retryAfterSeconds;
  return typeof seconds === 'number' ? seconds : WINDOW_MS / 1000;
}
