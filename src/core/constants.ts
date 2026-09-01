// Every named threshold in the product lives here; screens import them, never
// retype them. A published constant that disagrees with the implementation is
// a DoD Level 4 failure.

export const PACK_RADIUS_KM = 6; // containment: distance <= radius, INCLUSIVE
export const PACK_REFRESH_DAYS = 30; // label only; nothing expires

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

export const FIX_STALE_MS = 30_000;
export const ACCURACY_MAX_M = 100;

export const HOLD_MS = 2_000;
export const TICK_MS = 5_000;

// Marked-position estimate (E3-US1-AC4). How well a person standing at their
// own gate knows the spot, and how fast that knowledge decays — with no motion
// sensors, the holder may be walking the whole time. ACCURACY_MAX_M above stays
// the ONE confidence threshold: an estimate is withheld at exactly the point a
// GPS fix would be.
export const MARK_START_ACCURACY_M = 25;
export const MARK_DRIFT_M_PER_S = 1.4;

export const SNAPSHOT_MAX_AGE_DAYS = 60;

export const OFFICIAL_DOMAINS = [
  'servicesaustralia.gov.au',
  'disasterassist.gov.au',
  'vic.gov.au',
  'cfa.vic.gov.au',
  'emergency.vic.gov.au',
  'redcross.org.au',
  'ses.vic.gov.au',
] as const;

export const MS_PER_DAY = 86_400_000;

/** Unit constant. The metres↔kilometres display cutoff and divisor for
 * destination.formatDistanceM — not a safety threshold. */
export const METRES_PER_KM = 1_000;
