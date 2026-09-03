import { isInsideVictoria, NEARBY_SYNC_TIMEOUT_MS } from '../core/constants';
import { STATIC_TYPES, DYNAMIC_TYPES } from '../core/facility-sources';
import type { NearbyCache, NearbySession } from '../core/nearby';
import type { DataHealth, DynamicSnapshot, StaticBundle, SyncMetaRow } from '../core/types';
import { db } from './db';

// Same-origin paths: Vite proxies /api in development and Vercel rewrites it in
// production, so the browser never talks to a second origin.
export const STATIC_BUNDLE_PATH = '/api/v1/sync/static-bundle';
export const DYNAMIC_SNAPSHOT_PATH = '/api/v1/sync/dynamic-snapshot';

const STATUSES = ['healthy', 'degraded', 'down', 'unknown'] as const;
const DESIGNATIONS = ['designated', 'needs_review'] as const;

// ── Asserting parsers. Anything the server sends is checked before it is stored;
//    a malformed payload throws and the previous cache stays as it was. ──────
function fail(message: string): never {
  throw new TypeError(`nearby sync: ${message}`);
}
function record(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) fail(`${field} must be an object`);
  return value as Record<string, unknown>;
}
function list(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) fail(`${field} must be an array`);
  return value as unknown[];
}
function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) fail(`${field} must be a non-empty string`);
  return value as string;
}
function nullableText(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  return text(value, field);
}
function finite(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${field} must be a number`);
  return value as number;
}
/** Two finite numbers that are also a place in Victoria. A transposed or
 *  foreign coordinate is refused here, never stored as somewhere to go. */
function point(lat: unknown, lon: unknown, latField: string, lonField: string) {
  const p = { lat: finite(lat, latField), lon: finite(lon, lonField) };
  if (!isInsideVictoria(p.lat, p.lon)) fail(`${latField}/${lonField} must be inside Victoria`);
  return p;
}
function integer(value: unknown, field: string): number {
  const n = finite(value, field);
  if (!Number.isInteger(n)) fail(`${field} must be an integer`);
  return n;
}
function oneOf<T extends string>(value: unknown, options: readonly T[], field: string): T {
  if (typeof value !== 'string' || !(options as readonly string[]).includes(value)) {
    fail(`${field} must be one of ${options.join(', ')}`);
  }
  return value as T;
}

function assertHealth(value: unknown): DataHealth {
  const raw = record(value, 'data_health');
  return Object.fromEntries(
    Object.entries(raw).map(([id, source]) => {
      const r = record(source, `data_health.${id}`);
      return [
        id,
        {
          status: oneOf(r.status, STATUSES, `data_health.${id}.status`),
          last_success_at: nullableText(r.last_success_at, `data_health.${id}.last_success_at`),
        },
      ];
    }),
  );
}

export function assertStaticBundle(value: unknown): StaticBundle {
  const raw = record(value, 'static bundle');
  return {
    version: nullableText(raw.version, 'version'),
    generated_at: text(raw.generated_at, 'generated_at'),
    facilities: list(raw.facilities, 'facilities').map((item, i) => {
      const r = record(item, `facilities[${i}]`);
      const at = (key: string) => `facilities[${i}].${key}`;
      return {
        facility_id: integer(r.facility_id, at('facility_id')),
        type: oneOf(r.type, STATIC_TYPES, at('type')),
        name: text(r.name, at('name')),
        address: nullableText(r.address, at('address')),
        ...point(r.lat, r.lon, at('lat'), at('lon')),
        lga_name: nullableText(r.lga_name, at('lga_name')),
        designation_status: oneOf(r.designation_status, DESIGNATIONS, at('designation_status')),
        last_verified_at: text(r.last_verified_at, at('last_verified_at')),
      };
    }),
    postcodes: list(raw.postcodes, 'postcodes').map((item, i) => {
      const r = record(item, `postcodes[${i}]`);
      const postcode = text(r.postcode, `postcodes[${i}].postcode`);
      if (!/^\d{4}$/.test(postcode)) fail(`postcodes[${i}].postcode must be four digits`);
      const centroid = point(
        r.centroid_lat, r.centroid_lon, `postcodes[${i}].centroid_lat`, `postcodes[${i}].centroid_lon`,
      );
      return { postcode, centroid_lat: centroid.lat, centroid_lon: centroid.lon };
    }),
    data_health: assertHealth(raw.data_health),
  };
}

export function assertDynamicSnapshot(value: unknown): DynamicSnapshot {
  const raw = record(value, 'dynamic snapshot');
  return {
    generated_at: text(raw.generated_at, 'generated_at'),
    source_status: oneOf(raw.source_status, STATUSES, 'source_status'),
    source_last_success_at: nullableText(raw.source_last_success_at, 'source_last_success_at'),
    activations: list(raw.activations, 'activations').map((item, i) => {
      const r = record(item, `activations[${i}]`);
      const at = (key: string) => `activations[${i}].${key}`;
      return {
        activation_id: integer(r.activation_id, at('activation_id')),
        type: oneOf(r.type, DYNAMIC_TYPES, at('type')),
        name: text(r.name, at('name')),
        address: nullableText(r.address, at('address')),
        ...point(r.lat, r.lon, at('lat'), at('lon')),
        source_updated_at: text(r.source_updated_at, at('source_updated_at')),
      };
    }),
  };
}

// ── IndexedDB ──────────────────────────────────────────────────────────────

/** Everything the screen renders from, in one read. */
export async function readNearbyCache(): Promise<NearbyCache> {
  const [facilities, postcodes, activations, meta] = await Promise.all([
    db.staticFacilities.toArray(),
    db.postcodes.toArray(),
    db.dynamicSnapshot.toArray(),
    db.syncMeta.toArray(),
  ]);
  return {
    facilities,
    postcodes,
    activations,
    meta: Object.fromEntries(meta.map((row) => [row.key, row.value])),
  };
}

async function getJson(fetcher: typeof fetch, path: string): Promise<unknown> {
  const response = await fetcher(path, {
    cache: 'no-store',
    signal: AbortSignal.timeout(NEARBY_SYNC_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  return response.json();
}

async function syncStatic(fetcher: typeof fetch, since: string | undefined): Promise<void> {
  const query = since ? `?since=${encodeURIComponent(since)}` : '';
  const bundle = assertStaticBundle(await getJson(fetcher, STATIC_BUNDLE_PATH + query));
  // The server answers a matching `since` with the same shape and nothing to load.
  const unchanged = bundle.version !== null && bundle.version === since && bundle.facilities.length === 0;
  const meta: SyncMetaRow[] = [
    { key: 'static_synced_at', value: new Date().toISOString() },
    { key: 'data_health', value: JSON.stringify(bundle.data_health) },
  ];
  await db.transaction('rw', db.staticFacilities, db.postcodes, db.syncMeta, async () => {
    if (!unchanged) {
      await db.staticFacilities.clear();
      await db.postcodes.clear();
      await db.staticFacilities.bulkAdd(bundle.facilities);
      await db.postcodes.bulkAdd(bundle.postcodes);
      if (bundle.version === null) await db.syncMeta.delete('static_version');
      else meta.push({ key: 'static_version', value: bundle.version });
    }
    await db.syncMeta.bulkPut(meta);
  });
}

async function syncDynamic(fetcher: typeof fetch): Promise<void> {
  const snapshot = assertDynamicSnapshot(await getJson(fetcher, DYNAMIC_SNAPSHOT_PATH));
  await db.transaction('rw', db.dynamicSnapshot, db.syncMeta, async () => {
    // Replaced wholesale, never merged (spec §7.2): a centre that left the feed leaves the device.
    await db.dynamicSnapshot.clear();
    await db.dynamicSnapshot.bulkAdd(snapshot.activations);
    await db.syncMeta.bulkPut([
      { key: 'dynamic_synced_at', value: new Date().toISOString() },
      { key: 'dynamic_generated_at', value: snapshot.generated_at },
      { key: 'dynamic_source_status', value: snapshot.source_status },
    ]);
    if (snapshot.source_last_success_at === null) await db.syncMeta.delete('dynamic_source_last_success_at');
    else await db.syncMeta.put({ key: 'dynamic_source_last_success_at', value: snapshot.source_last_success_at });
  });
}

/** Both endpoints, independently: one failing never blocks the other (spec §7.4).
 *  Reports which side succeeded so the screen can mark those rows live. */
export async function syncNearby(fetcher: typeof fetch = fetch): Promise<NearbySession> {
  const since = (await db.syncMeta.get('static_version'))?.value;
  const [staticResult, dynamicResult] = await Promise.allSettled([
    syncStatic(fetcher, since),
    syncDynamic(fetcher),
  ]);
  return {
    staticSyncedNow: staticResult.status === 'fulfilled',
    dynamicSyncedNow: dynamicResult.status === 'fulfilled',
  };
}
