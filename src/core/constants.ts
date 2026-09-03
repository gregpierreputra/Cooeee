// Every named threshold in the product lives here; screens import them, never
// retype them. A published constant that disagrees with the implementation is
// a DoD Level 4 failure.

import type { HazardType } from './types';

export const PACK_RADIUS_KM = 6; // containment: distance <= radius, INCLUSIVE
// Iteration 1 builds bushfire packs only. Neighbourhood Safer Places are gated
// on this in core/nsp.ts, so a flood or heat pack can never be offered one.
export const PACK_HAZARD: HazardType = 'bushfire';
/** How many official places the pack wizard offers: the nearest, state-wide,
 *  however far. Every published site is offered to whoever is nearest it. */
export const PLACES_OFFERED = 5;
/** How many of the nearest official places BlackSky points at from the live
 *  fix, beyond the ones saved in the pack. */
export const NEARBY_PLACES = 3;
export const PACK_REFRESH_DAYS = 30; // label only; nothing expires
/** The longest personal note a pack takes. A bound on the user's own text,
 *  enforced where it is written, not a limit on the official content. */
export const NOTE_MAX_CHARS = 2000;

/** The number of last-resort places a pack holds. Two equal-status places, with
 * no ordering of worth between them. A hard cap, not a target: an area may
 * publish fewer. */
export const DESTINATIONS_MAX = 2;

/** Vicmap Address runtime search limits. Three characters avoids an overly
 * broad public-service query; ten is the approved candidate-list cap. */
export const ADDRESS_QUERY_MIN_CHARS = 3;
export const ADDRESS_RESULT_LIMIT = 10;
export const ADDRESS_SEARCH_TIMEOUT_MS = 10_000;

/** The pause after the last keystroke before the typed prefix leaves the device.
 *  The search runs while the user types, so with ADDRESS_QUERY_MIN_CHARS this is
 *  the only thing bounding request volume against a public service: a twenty
 *  character address costs one request, not eighteen.
 *
 *  250 ms is an engineering default, not a measured figure. It is long enough to
 *  collapse an ordinary typing burst into one request and short enough that the
 *  list still reads as a response to typing, given that the register's own search
 *  returned in 0.59 s when it was last verified. Change it on evidence, not on
 *  taste: raise it if observed requests per completed address are more than a
 *  handful, or if the service asks us to; lower it only if the list is observed
 *  to feel detached from the keystroke that caused it. */
export const ADDRESS_QUERY_DEBOUNCE_MS = 250;

/** Official area checks share one bounded request sequence. */
export const AREA_CHECK_TIMEOUT_MS = 10_000;
export const DTP_PUBLISHER = 'Department of Transport and Planning';
export const DTP_LICENCE = 'CC BY 4.0';
/** The publisher's own human-readable page for the designation dataset: title,
 * plain-English description, the CC BY 4.0 licence above, a last-updated date
 * and a map preview. One fixed URL describing the dataset itself, so it is what
 * a person is sent to — present or absent, every pack, every query. A stored
 * source.url stays the record of the exact query that was run; it answers to a
 * machine, in raw JSON, and is not a page to read. */
export const DTP_DATASET_URL =
  'https://discover.data.vic.gov.au/dataset/designated-bushfire-prone-area-bpa';

// The arrows are drawn from any fix; these decide when the screen says the fix
// is old or vague beside them, and when a marked-position estimate expires.
export const FIX_STALE_MS = 30_000;
export const ACCURACY_MAX_M = 100;

export const HOLD_MS = 2_000;
export const TICK_MS = 5_000;

// Marked-position estimate (E3-US1-AC4). How well a person standing at their
// own gate knows the spot, and how fast that knowledge decays — with no motion
// sensors, the holder may be walking the whole time. ACCURACY_MAX_M above is
// the ONE confidence threshold: an estimate is withdrawn at exactly the point a
// GPS fix would be called approximate.
export const MARK_START_ACCURACY_M = 25;
export const MARK_DRIFT_M_PER_S = 1.4;

/** Victoria's extent, with a margin. A coordinate outside it is an axis-order
 *  mistake or a bad record, never a place to go. Shared by the client parsers
 *  and the API server's ingest, so this file must stay a leaf module (no
 *  runtime imports) — the server loads it directly under Node. */
export const VIC_EXTENT = { minLat: -39.3, maxLat: -33.9, minLon: 140.9, maxLon: 150.1 };
export const isInsideVictoria = (lat: number, lon: number): boolean =>
  lat >= VIC_EXTENT.minLat && lat <= VIC_EXTENT.maxLat
  && lon >= VIC_EXTENT.minLon && lon <= VIC_EXTENT.maxLon;

export const SNAPSHOT_MAX_AGE_DAYS = 60;

/** The most the app will read from any one response. The largest reply today
 *  is a 151 KB source PDF; a body past this is a fault or an attack, not data. */
export const MAX_RESPONSE_BYTES = 10 * 1_048_576;

/** The most rows one synced collection may hold. Victoria has about 315
 *  facilities and 694 postcodes; a list past this is a fault, not data. */
export const MAX_SYNC_ROWS = 10_000;

// Exact publisher hosts, or an apex no wider than the publisher itself. The
// bare vic.gov.au apex is deliberately absent: it would admit every subdomain
// of a very large estate, and the app only ever stores these two of them.
export const OFFICIAL_DOMAINS = [
  'servicesaustralia.gov.au',
  'disasterassist.gov.au',
  'discover.data.vic.gov.au',
  'opendata.maps.vic.gov.au',
  'cfa.vic.gov.au',
  'emergency.vic.gov.au',
  'redcross.org.au',
  'ses.vic.gov.au',
] as const;

export const MS_PER_DAY = 86_400_000;

/** Unit constant. The metres↔kilometres display cutoff and divisor for
 * destination.formatDistanceM — not a safety threshold. */
export const METRES_PER_KM = 1_000;

/** E1-US1-AC0. The first-open acknowledgement lives in ONE browser storage
 * flag, not a database row: it is a fact about this browser profile, it must be
 * readable before any store opens, and clearing site data is the documented way
 * back to the first-open screen. The key is versioned so a future change to what
 * is being acknowledged asks again rather than inheriting an old answer. The
 * value is a marker and nothing else — no date, no identifier, no counter. */
export const ACKNOWLEDGEMENT_KEY = 'cooeee.acknowledgement.v1';
export const ACKNOWLEDGEMENT_VALUE = 'acknowledged';

/** Nearby places (spec §7). A dynamic snapshot whose feed is older than this is
 *  no longer shown as a place to go — only the stale notice and the hotline stay. */
export const DYNAMIC_SNAPSHOT_MAX_AGE_MS = 60 * 60_000;
export const NEARBY_SYNC_TIMEOUT_MS = 15_000;
export const NEARBY_RESYNC_MS = 5 * 60_000; // while the screen stays open and online
export const NEARBY_CLOCK_MS = 60_000; // how often the age labels are re-read
export const NEARBY_FIX_TIMEOUT_MS = 15_000;
export const NEARBY_FIX_MAX_AGE_MS = 60_000; // a position the OS already has is fine
