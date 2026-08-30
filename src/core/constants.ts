// Every named threshold in the product lives here, and ui/Sources.tsx renders
// these by importing them — never by retyping them. A published constant that
// disagrees with the implementation is a DoD Level 4 failure.

export const PACK_RADIUS_KM = 6; // containment: distance <= radius, INCLUSIVE
export const PACK_REFRESH_DAYS = 30; // label only; nothing expires

/** Vicmap Address runtime search limits. Three characters avoids an overly
 * broad public-service query; ten is the approved candidate-list cap. */
export const ADDRESS_QUERY_MIN_CHARS = 3;
export const ADDRESS_RESULT_LIMIT = 10;
export const ADDRESS_SEARCH_TIMEOUT_MS = 10_000;

/** Official area checks share one bounded request sequence. */
export const AREA_CHECK_TIMEOUT_MS = 10_000;
export const DTP_PUBLISHER = 'Department of Transport and Planning';
export const DTP_LICENCE = 'CC BY 4.0';

export const TILE_ZOOM_MIN = 10;
export const TILE_ZOOM_MAX = 15;
export const TILE_BYTES_CAP = 40 * 1024 * 1024;

export const FIX_STALE_MS = 30_000;
export const ACCURACY_MAX_M = 100;

export const HEADING_TIMEOUT_MS = 3_000;
export const HEADING_HYSTERESIS_DEG = 2;
// ponytail: one statewide value; compute a per-pack declination at build time if
// the compass ever needs better than a degree or two across Victoria.
export const DECLINATION_DEG = 12;

export const HOLD_MS = 2_000;
export const TICK_MS = 5_000;

export const PROBE_TIMEOUT_MS = 5_000;
export const PROBE_INTERVAL_MS = 60_000; // only while Recovery is mounted
export const RETRY_SCHEDULE_MS = [0, 30_000, 300_000] as const;

export const SNAPSHOT_MAX_AGE_DAYS = 60;

export const OFFICIAL_DOMAINS = [
  'servicesaustralia.gov.au',
  'disasterassist.gov.au',
  'vic.gov.au',
  'cfa.vic.gov.au',
  'emergency.vic.gov.au',
  'redcross.org.au',
  'ses.vic.gov.au',
  'openstreetmap.org',
  'protomaps.com',
] as const;

export const MS_PER_DAY = 86_400_000;
