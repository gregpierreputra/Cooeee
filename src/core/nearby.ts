import { DYNAMIC_SNAPSHOT_MAX_AGE_MS } from './constants';
import * as copy from './copy';
import { formatDistanceM } from './destination';
import { DYNAMIC_TYPES, FACILITY_SOURCE, STATIC_TYPES } from './facility-sources';
import { distanceM } from './geo';
import { formatSavedDate } from './provenance';
import type {
  BundleFacility,
  BundlePostcode,
  DataHealth,
  FacilityType,
  LatLon,
  SnapshotActivation,
  SourceStatus,
} from './types';

// The sync bookkeeping keys (spec §7.2 sync_meta), written by data/nearby.ts.
export type MetaKey =
  | 'static_version'
  | 'static_synced_at'
  | 'data_health'
  | 'dynamic_synced_at'
  | 'dynamic_generated_at'
  | 'dynamic_source_status'
  | 'dynamic_source_last_success_at';

/** Everything the screen has on the device, read from IndexedDB in one go. */
export type NearbyCache = {
  facilities: BundleFacility[];
  postcodes: BundlePostcode[];
  activations: SnapshotActivation[];
  meta: Partial<Record<MetaKey, string>>;
};

/** Which endpoints have synced in THIS page session — the line between live and cached. */
export type NearbySession = { staticSyncedNow: boolean; dynamicSyncedNow: boolean };

export type PlaceState = 'live' | 'cached' | 'unavailable';

export type NearbyRow = {
  type: FacilityType;
  title: string;
  place: { name: string; address: string | null; distance: string } | null;
  state: PlaceState;
  stateLabel: string;
  timestamp: string | null;
  note: string | null;
};
export type NearbyGroup = { heading: string; note: string; rows: NearbyRow[] };
export type NearbyView = { groups: NearbyGroup[]; health: string[] };

/** The device has something to answer from once either bundle has ever landed. */
export const hasNearbyData = (cache: NearbyCache): boolean =>
  cache.meta.static_synced_at !== undefined || cache.meta.dynamic_synced_at !== undefined;

export const parsePostcode = (text: string): string | null =>
  /^\d{4}$/.test(text.trim()) ? text.trim() : null;

export const postcodeOrigin = (cache: NearbyCache, postcode: string): LatLon | null => {
  const row = cache.postcodes.find((p) => p.postcode === postcode);
  return row ? { lat: row.centroid_lat, lon: row.centroid_lon } : null;
};

/** A linear scan — the cached list is a few hundred rows (spec §7.3). */
export function nearestOfType<T extends LatLon & { type: FacilityType }>(
  rows: T[],
  origin: LatLon,
  type: FacilityType,
): { row: T; distanceM: number } | null {
  let nearest: { row: T; distanceM: number } | null = null;
  for (const row of rows) {
    if (row.type !== type) continue;
    const metres = distanceM(origin, row);
    if (nearest === null || metres < nearest.distanceM) nearest = { row, distanceM: metres };
  }
  return nearest;
}

/** 'just now' → 'N min ago' → 'N h ago' → 'N days ago'. A future clock reads as now. */
export function ageLabel(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60_000);
  if (minutes < 1) return copy.JUST_NOW;
  if (minutes < 60) return copy.MINUTES_AGO(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return copy.HOURS_AGO(hours);
  return copy.ITEM_DAYS_AGO(Math.floor(hours / 24));
}

const melbourne = (options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat =>
  new Intl.DateTimeFormat('en-AU', { ...options, timeZone: 'Australia/Melbourne' });

/** '4:12 pm, 2 September' — a time of day for the dynamic "as of" line. */
export const formatMelbourneTime = (epochMs: number): string =>
  `${melbourne({ hour: 'numeric', minute: '2-digit' }).format(epochMs)}, ${melbourne({ day: 'numeric', month: 'long' }).format(epochMs)}`;

const parseHealth = (cache: NearbyCache): DataHealth => {
  try {
    return JSON.parse(cache.meta.data_health ?? '{}') as DataHealth;
  } catch {
    return {};
  }
};

const stateLabel = (state: PlaceState, ageMs: number): string =>
  state === 'live'
    ? copy.STATE_LIVE
    : state === 'cached'
      ? copy.STATE_CACHED(ageLabel(ageMs))
      : copy.STATE_UNAVAILABLE;

const withHotline = (line: string): string => `${line} ${copy.VICEMERGENCY_HOTLINE}`;

/** The line a struggling or never-read source earns on every row it answers for. */
const sourceNote = (status: SourceStatus, type: FacilityType): string | null => {
  const source = copy.SOURCE_NAMES[FACILITY_SOURCE[type]];
  if (status === 'degraded' || status === 'down') return withHotline(copy.SOURCE_UNCONFIRMED(source));
  if (status === 'unknown') return withHotline(copy.SOURCE_NOT_READ(source));
  return null;
};

const unavailableRow = (type: FacilityType, title: string): NearbyRow => ({
  type,
  title,
  place: null,
  state: 'unavailable',
  stateLabel: copy.STATE_UNAVAILABLE,
  timestamp: null,
  note: withHotline(copy.NOT_DOWNLOADED_YET(title)),
});

function staticRow(
  now: number,
  origin: LatLon,
  cache: NearbyCache,
  session: NearbySession,
  type: FacilityType,
): NearbyRow {
  const title = copy.FACILITY_TYPE_NAME[type];
  const syncedAt = cache.meta.static_synced_at;
  if (syncedAt === undefined) return unavailableRow(type, title);
  const status = parseHealth(cache)[FACILITY_SOURCE[type]]?.status ?? 'unknown';
  const nearest = nearestOfType(cache.facilities, origin, type);
  const state: PlaceState = session.staticSyncedNow && status === 'healthy' ? 'live' : 'cached';
  let note: string | null;
  if (nearest === null) note = copy.NONE_IN_LIST(title);
  else if (nearest.row.designation_status === 'needs_review') note = copy.NEEDS_REVIEW_NOTE;
  else note = sourceNote(status, type);
  return {
    type,
    title,
    place: nearest
      ? { name: nearest.row.name, address: nearest.row.address, distance: formatDistanceM(nearest.distanceM) }
      : null,
    state,
    stateLabel: stateLabel(state, now - Date.parse(syncedAt)),
    // Static data is trustworthy for longer, but always shows when it was last verified.
    timestamp: nearest ? copy.VERIFIED_ON(formatSavedDate(Date.parse(nearest.row.last_verified_at))) : null,
    note,
  };
}

function dynamicRow(
  now: number,
  origin: LatLon,
  cache: NearbyCache,
  session: NearbySession,
  type: FacilityType,
): NearbyRow {
  const title = copy.FACILITY_TYPE_NAME[type];
  const syncedAt = cache.meta.dynamic_synced_at;
  if (syncedAt === undefined) return unavailableRow(type, title);
  const status = (cache.meta.dynamic_source_status ?? 'unknown') as SourceStatus;
  // The honest age is the feed's own last success, not when this device copied it.
  const asOf = Date.parse(
    cache.meta.dynamic_source_last_success_at ?? cache.meta.dynamic_generated_at ?? syncedAt,
  );
  const ageMs = now - asOf;
  const stale = ageMs > DYNAMIC_SNAPSHOT_MAX_AGE_MS;
  const nearest = stale ? null : nearestOfType(cache.activations, origin, type);
  const state: PlaceState =
    session.dynamicSyncedNow && status === 'healthy' && !stale ? 'live' : 'cached';
  let note: string | null;
  if (stale) note = withHotline(copy.TOO_OLD_TO_SHOW);
  else if (sourceNote(status, type) !== null) note = sourceNote(status, type);
  else if (nearest === null) note = copy.NONE_LISTED_OPEN(title);
  else note = state === 'live' ? null : copy.MAY_BE_OUTDATED;
  return {
    type,
    title,
    place: nearest
      ? { name: nearest.row.name, address: nearest.row.address, distance: formatDistanceM(nearest.distanceM) }
      : null,
    state,
    stateLabel: stateLabel(state, ageMs),
    timestamp: copy.AS_OF(formatMelbourneTime(asOf)),
    note,
  };
}

function healthLines(now: number, cache: NearbyCache): string[] {
  const health = parseHealth(cache);
  // The dynamic snapshot carries a fresher reading of the feed than the static bundle.
  if (cache.meta.dynamic_source_status) {
    health.vicemergency_feed = {
      status: cache.meta.dynamic_source_status as SourceStatus,
      last_success_at: cache.meta.dynamic_source_last_success_at ?? null,
    };
  }
  return Object.entries(health).map(([id, source]) =>
    copy.HEALTH_LINE(
      copy.SOURCE_NAMES[id] ?? id,
      copy.SOURCE_STATUS_WORD[source.status],
      source.last_success_at ? ageLabel(now - Date.parse(source.last_success_at)) : copy.NEVER,
    ),
  );
}

/** Every facility type, always, each labelled on its own (spec §7.5). */
export function nearbyView(
  now: number,
  origin: LatLon,
  cache: NearbyCache,
  session: NearbySession,
): NearbyView {
  return {
    groups: [
      {
        heading: copy.GROUP_BUSHFIRE,
        note: copy.GROUP_BUSHFIRE_NOTE,
        rows: STATIC_TYPES.map((type) => staticRow(now, origin, cache, session, type)),
      },
      {
        heading: copy.GROUP_RELIEF,
        note: copy.GROUP_RELIEF_NOTE,
        rows: DYNAMIC_TYPES.map((type) => dynamicRow(now, origin, cache, session, type)),
      },
    ],
    health: healthLines(now, cache),
  };
}
