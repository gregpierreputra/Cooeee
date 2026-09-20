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
/** The register answers HTTP 400 to a request of about 10,000 characters and
 * accepts one of 6,700 (measured 18 September 2026). A filter grows by about a
 * quarter when it is written into a web address, so it is held to this length. */
export const ADDRESS_FILTER_MAX_CHARS = 5000;
/** The longest text read from the address field, and the longest single word.
 *  The longest written address in the register is under 100 characters and its
 *  longest word under 25, so neither limit touches a real address. They stop a
 *  huge paste from slowing the page or growing a filter past the register's limit. */
export const ADDRESS_QUERY_MAX_CHARS = 200;
export const ADDRESS_WORD_MAX_CHARS = 40;

/** Use my location asks the register for addresses this close to the fix, then
 * at each wider radius while it finds none. The register cannot sort by
 * distance and returns at most the fetch limit in no useful order, so the steps
 * are small: a radius that holds thousands of addresses would hand back fifty
 * of them at random, none of them the nearest. More records than the list cap
 * are fetched so the nearest ones can be picked on the device. */
export const ADDRESS_NEAR_METRES = [25, 60, 150, 400, 1000, 2500, 5000] as const;
export const ADDRESS_NEAR_FETCH_LIMIT = 50;

/** A word typed after a road's type, as the register's short code for it: a
 * direction, or one of its four rarer endings (extension, mall, connection,
 * deviation). Every code the register uses is listed. */
export const ROAD_DIRECTIONS: Readonly<Record<string, string>> = {
  N: 'N', NORTH: 'N', NTH: 'N', S: 'S', SOUTH: 'S', STH: 'S',
  E: 'E', EAST: 'E', W: 'W', WEST: 'W',
  EX: 'EX', EXT: 'EX', EXTENSION: 'EX', ML: 'ML', MALL: 'ML',
  CN: 'CN', CONNECTION: 'CN', DV: 'DV', DEVIATION: 'DV',
};

/** Short forms of road types, as the register spells the full word. A type
 * typed in full needs no entry here: any word may be a road type. */
export const ROAD_TYPES: Readonly<Record<string, string>> = {
  ALY: 'ALLEY', ARC: 'ARCADE', AVE: 'AVENUE', AV: 'AVENUE', BVD: 'BOULEVARD', BLVD: 'BOULEVARD',
  CSWY: 'CAUSEWAY', CH: 'CHASE', CCT: 'CIRCUIT', CIR: 'CIRCUIT', CL: 'CLOSE', CT: 'COURT', CRT: 'COURT',
  CRES: 'CRESCENT', CR: 'CRESCENT', CRS: 'CRESCENT', DR: 'DRIVE', DRV: 'DRIVE', ESP: 'ESPLANADE',
  FWY: 'FREEWAY', GLN: 'GLEN', GR: 'GROVE', GRV: 'GROVE', HTS: 'HEIGHTS', HWY: 'HIGHWAY', LN: 'LANE',
  PDE: 'PARADE', PKWY: 'PARKWAY', PL: 'PLACE', PROM: 'PROMENADE', RDGE: 'RIDGE', RD: 'ROAD',
  SQ: 'SQUARE', ST: 'STREET', STR: 'STREET', TCE: 'TERRACE', TER: 'TERRACE', TRK: 'TRACK', VW: 'VIEW',
  WK: 'WALK', WY: 'WAY',
};

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
/** The map of a pack's area is drawn on request by the Web Map Service, which
 *  takes a few seconds; past this the pack is built without it. */
export const AREA_MAP_TIMEOUT_MS = 20_000;
/** A file the app ships with itself is normally answered from the phone in
 *  milliseconds. On a first visit over a stalled connection it may never be
 *  answered, and a wizard must not wait on it for ever. */
export const BUNDLED_FILE_TIMEOUT_MS = 20_000;
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
/** The file name of the Web Map Service picture of a pack's area, stored with
 *  the pack's source copies. Named here so the pack page can find it without
 *  importing the module that fetches it. */
export const AREA_MAP_NAME = 'bushfire-prone-area-map.png';
/** How far that picture reaches each way from the saved place, in
 *  kilometres: 8 km across, close enough to read roads, creeks and place names.
 *  A picture size only; the pack's 6 km area rule is PACK_RADIUS_KM. */
export const AREA_MAP_HALF_KM = 4;

// The arrows are drawn from any fix; these decide when the screen says the fix
// is old or vague beside them, and when a marked-position estimate expires.
export const FIX_STALE_MS = 30_000;
export const ACCURACY_MAX_M = 100;

export const HOLD_MS = 2_000;
// How long the line saying BlackSky was not opened stays on screen.
export const BLOCKED_NOTICE_MS = 8_000;
export const TICK_MS = 5_000;
// A position this far from the one on screen is shown at once, not at the next
// tick. Smaller moves are sensor noise and wait, which saves the battery.
export const FIX_PUBLISH_M = 5;
// A position watch that has said nothing for this long is started again: some
// phones stop delivering positions without reporting any error.
export const WATCH_RESTART_MS = 15_000;

// The dial's heading (BS_Enhancement-AC2). A car body disturbs a phone's compass
// and most people leave a bushfire by car, so above this speed the direction of
// movement from GPS turns the dial instead. 10 km/h is faster than a walk, where
// the compass is the better reading, and slower than any driving. Exclusive: at
// exactly this speed the compass still drives.
export const HEADING_FROM_MOVEMENT_MPS = 10 / 3.6;
// A heading source that has said nothing for this long is treated as absent,
// and the dial is drawn north up: a dial frozen at its last angle would look
// live while it is not.
export const COMPASS_SILENT_MS = 3_000;

// Voice (BS_Enhancement-AC3). Every figure here is a starting value, to be
// tuned from the passenger-in-a-moving-car test, not a measured one.
/** The distances, in metres, at which the phone speaks as they are passed in
 *  either direction. Outermost first; the rule relies on that order. */
export const VOICE_MILESTONES_M = [10_000, 5_000, 2_000, 1_000, 500, 200, 100] as const;
/** Having passed a milestone, the distance must come back past it by this share
 *  of the milestone before it counts as passed the other way. Without it a
 *  position wandering either side of 5 km would say so every time. Starting value. */
export const VOICE_MILESTONE_MARGIN = 0.05;
/** Never two messages closer together than this, the GPS signal lost message
 *  and its return excepted. Starting value. */
export const VOICE_MIN_GAP_MS = 20_000;
/** While moving, this long with nothing said earns one message, so a driver
 *  knows the voice is still on. Starting value. */
export const VOICE_SILENCE_MS = 180_000;
/** The place must stay on its new side this long before the change is spoken:
 *  a glance over the shoulder or one bend in the road is not a change. Starting value. */
export const VOICE_SIDE_DWELL_MS = 5_000;
/** Closer than this the person is at the place, within what a phone's position
 *  can tell. Said once. Starting value. */
export const AT_PLACE_M = 50;
/** Where "ahead" ends and "behind" begins, in degrees either way from the top
 *  of the phone: ahead is within 45, behind is beyond 135, and the two sides lie
 *  between. Four equal quarters as a starting value. */
export const VOICE_SIDE_EDGES_DEG = { ahead: 45, behind: 135 } as const;
/** How often the voice rule is asked whether there is anything to say. It
 *  reads refs and renders nothing; a second is fine-grained enough for a
 *  five-second dwell. Starting value. */
export const VOICE_CHECK_MS = 1_000;

// Staying open (BS_Enhancement-AC4).
/** Faster than this the person is moving, and the screen is kept awake. A slow
 *  walk is about 1.4 m/s; a phone lying still reports 0 or nothing. Starting value. */
export const AWAKE_MOVING_MPS = 1;

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

/** The most the app will read from any one response. The largest replies
 *  today are a source PDF and the area map, a few hundred kilobytes each; a
 *  body past this is a fault or an attack, not data. */
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

/** Recovery programs change faster than places do, so the pack's recovery
 *  snapshot has its own window, separate from PACK_REFRESH_DAYS and the
 *  SNAPSHOT_MAX_AGE_DAYS build gate. Label only; the programs stay shown. */
export const RECOVERY_STALE_DAYS = 90;

/** The longest gap between "I'm going now" and "I went there" that is still
 *  read as the time the walk took. Past it the answer came later, looking back,
 *  and the result says she went without stating a time. */
export const REHEARSAL_TIMED_MAX_MS = 6 * 3_600_000;

/** The official channel named when the pack holds nothing for a need. Static
 *  pack content on OFFICIAL_DOMAINS, never fetched. */
export const NEED_CHANNELS = {
  stay: 'https://www.emergency.vic.gov.au/relief/',
  money: 'https://www.servicesaustralia.gov.au/natural-disaster-support',
  food: 'https://www.emergency.vic.gov.au/relief/',
  property: 'https://www.disasterassist.gov.au/find-a-disaster/australian-disasters?state=vic',
  health: 'https://www.redcross.org.au/emergencies/coping-after-a-crisis/',
  documents: 'https://www.servicesaustralia.gov.au/natural-disaster-support',
} as const;
export const GENERAL_CHANNEL_URL = 'https://www.disasterassist.gov.au/';
/** The VicEmergency hotline, the one number every call list opens with. */
export const HOTLINE_NUMBER = '1800 226 226';

/** Programs the user chose to keep: program ids only, on this phone, capped so
 *  the list can never grow without bound. */
export const KEPT_KEY = 'cooeee.kept.v1';
export const KEPT_MAX = 50;

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

/** Feature 1: the development password gate. Same rules as the acknowledgement,
 * one browser flag holding one marker, written only after the server has
 * accepted the password. */
export const GATE_KEY = 'cooeee.gate.v1';
export const GATE_VALUE = 'passed';

/** Which screen was open last. BlackSky sets this flag when it opens and only
 * the hold on Leave BlackSky clears it, so a visit that starts anywhere else is
 * sent back there. Same rules as the acknowledgement: one browser flag, a
 * versioned key, a bare marker for a value. */
export const BLACKSKY_LATCH_KEY = 'cooeee.blacksky.v1';
export const BLACKSKY_LATCH_VALUE = 'latched';
/** Which pack BlackSky loads when several are saved. Written when the person
 * chooses one, read on the next visit, and only ever compared against the
 * packs in the store, so a stale or foreign value simply matches nothing. */
export const BLACKSKY_PACK_KEY = 'cooeee.blacksky-pack.v1';

/** Nearby places (spec §7). A dynamic snapshot whose feed is older than this is
 *  no longer shown as a place to go — only the stale notice and the hotline stay. */
export const DYNAMIC_SNAPSHOT_MAX_AGE_MS = 60 * 60_000;
export const NEARBY_SYNC_TIMEOUT_MS = 15_000;
export const NEARBY_RESYNC_MS = 5 * 60_000; // while the screen stays open and online
export const NEARBY_CLOCK_MS = 60_000; // how often the age labels are re-read
export const NEARBY_FIX_TIMEOUT_MS = 15_000;
export const NEARBY_FIX_MAX_AGE_MS = 60_000; // a position the OS already has is fine
