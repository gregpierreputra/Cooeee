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
/** The longest personal note a pack takes. A bound on the user's own text,
 *  enforced where it is written, not a limit on the official content. */
export const NOTE_MAX_CHARS = 2000;
/** The longest name a pack takes when renamed. Long enough for "Mum and Dad's
 *  place in Ferny Creek", short enough to sit on one pack card. */
export const PACK_NAME_MAX_CHARS = 60;

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
 *  kilometres: 40 km across, the wider area to explore, zoomed in on the pack
 *  page to read roads, creeks and place names. A picture size only; the pack's
 *  6 km area rule is PACK_RADIUS_KM. */
export const AREA_MAP_HALF_KM = 20;
/** A pack's map widens past AREA_MAP_HALF_KM to take in the places of last
 *  resort chosen for it, with this much room past the farthest, up to the
 *  most it reaches each way: 120 km across, which holds both chosen places for
 *  nearly every Victorian locality while staying sharp enough to read. */
export const AREA_MAP_MARGIN_KM = 3;
export const AREA_MAP_MAX_HALF_KM = 60;
/** Nearby's map of the nearest bushfire places: the same 40 km square as a
 *  pack's map, at most this many Neighbourhood Safer Places on it, and the
 *  picture's half width in its own pixels, about half a phone's width. */
export const NEARBY_MAP_PLACES = 5;
/** Community Fire Refuges are few, so the nearest few within reach go on too. */
export const NEARBY_MAP_REFUGES = 3;
export const NEARBY_MAP_HALF_PX = 170;
/** The most a whole pack may take on the phone, map included. */
export const PACK_MAX_BYTES = 15 * 1_048_576;

// The arrows are drawn from any fix; these decide when the screen says the fix
// is old or vague beside them, and when a marked-position estimate expires.
export const FIX_STALE_MS = 30_000;
export const ACCURACY_MAX_M = 100;

export const HOLD_MS = 2_000;
// How long the tab bar's BlackSky button keeps its "hold" hint after a tap.
// The bar is on every screen, so a hint that stayed would never go away.
export const NAV_HOLD_HINT_MS = 4_000;
// How long a call card's Copy says Copied or Not copied before it reads Copy
// again. It reports a moment, not what the clipboard holds later.
export const COPY_CONFIRM_MS = 3_000;
// How often an age in words ("just now", "5 minutes ago") moves on while a
// screen stays open, so it never goes stale in front of the person.
export const AGE_CLOCK_MS = 60_000;
// How far outside the hold button a pointer may stray before the hold is
// cancelled. A finger held down for two seconds rolls and slides by several
// pixels, and a thumb near the button's edge slips just past it, so leaving
// the box by a hair must not cancel: that is what made the hold impossible on
// real phones. 24 px is about half a fingertip, and the smallest target WCAG
// 2.5.8 accepts: a pointer further off than that is no longer on this control.
export const HOLD_LEAVE_MARGIN_PX = 24;
// The buzz when a hold completes, where the phone has one: the cue for a finger
// that cannot see the control under it. Entering is a longer buzz, a door into
// another screen; leaving BlackSky a short one, so it is felt, not startling
// (from the phone test, 28 Sep).
export const HOLD_VIBRATE_MS = 100;
export const HOLD_LEAVE_VIBRATE_MS = 40;
// How long the line saying BlackSky was not opened stays on screen.
export const BLOCKED_NOTICE_MS = 8_000;
// BlackSky's clock: the fix's age, a small move and a marked estimate's growing
// uncertainty all catch up within one tick, so what is on screen is never more
// than a second behind a person who is walking.
export const TICK_MS = 1_000;
// A position this far from the one on screen is shown at once, not at the next
// tick. Smaller moves are sensor noise and wait for the tick.
export const FIX_PUBLISH_M = 5;
/** The readout's steadiness (28 Sep review): the distance and the compass point
 *  on screen change only when the place, as seen from the new position, has
 *  moved by more than the position's own error (its accuracy), and never for
 *  less than this. Below that the change is the fix wobbling, and a figure
 *  that flickers between 2.60 and 2.61 km while the phone lies still reads as
 *  movement that is not there. The voice keeps its own rule. */
export const READOUT_MIN_CHANGE_M = FIX_PUBLISH_M;
// A position watch that has said nothing for this long is started again: some
// phones stop delivering positions without reporting any error.
export const WATCH_RESTART_MS = 15_000;
/** A fix vaguer than this, and more than twice as vague as one taken within
 *  FIX_PREFER_PRECISE_MS, is the phone's coarse network guess while GPS
 *  restarts. The precise fix stays on screen instead of jumping away. */
export const FIX_COARSE_M = 100;
export const FIX_PREFER_PRECISE_MS = 10_000;

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
/** The screen stays awake this long after the last moving sample, so a pause
 *  at a crossing does not let the phone sleep and the distance freeze. */
export const AWAKE_HOLD_MS = 60_000;

// Roads inside the dial (BS_Enhancement-AC5). Every figure here is a starting
// value, to be tuned on a real phone and in user testing, not a measured one.
/** "Whole way": the view reaches the place and this share beyond it, so the pin
 *  sits inside the ring with some road around it. Starting value. */
export const ROADS_WHOLE_WAY_MARGIN = 0.15;
/** The smallest and largest radius the dial ever shows. Below 1.5 km a road
 *  map on a 340 px dial is a handful of lines; above 30 km even the main roads
 *  run together and nothing can be named. Starting values. */
export const ROADS_MIN_RADIUS_M = 1_500;
export const ROADS_MAX_RADIUS_M = 30_000;
/** "Near me": the ground a person on foot can see around them. Starting value. */
export const ROADS_NEAR_RADIUS_M = 1_500;
/** The map is drawn again once the person has moved more than this far from
 *  where it was last drawn, or more than ROADS_REDRAW_SHARE of the view's
 *  radius, whichever is larger (see redrawDistanceM in core/roads.ts). Below it
 *  the change is under a pixel or two, and a redraw per GPS sample would cost
 *  power for nothing. Starting value. */
export const ROADS_REDRAW_M = 50;
/** The share of the view's radius the person must move before a redraw. In the
 *  30 km view 50 m is a fifth of a pixel, and a redraw every 50 m in a car
 *  would redraw two thousand roads every two seconds; 1 % is about a pixel and
 *  a half at every view. Starting value. */
export const ROADS_REDRAW_SHARE = 0.01;
/** A freeway line shorter than this is an on or off ramp. Starting value. */
export const ROADS_RAMP_MAX_M = 1_000;
/** Ramps are drawn only in "Near me", thin, in the freeway's colours. In the
 *  whole way they were most of the lines drawn (593 of 804 round Clayton
 *  South) and turned every interchange into a knot. */
export const ROADS_RAMP_IN_WHOLE_WAY = false;
/** Which road classes the dial draws. Drawn all at one weight, the state's
 *  roads were an unreadable mesh on a phone (Samsung S26 test), so each view
 *  draws only the roads a person would recognise at its scale:
 *  - "Near me" draws every class, 0 to 3, collectors included;
 *  - "Whole way" never draws collectors: classes 0 to 2 up to and including
 *    `mainUpToM`, and beyond it freeways and highways (0 and 1) only, unless
 *    the ground is so empty of main roads that fewer than `sparseLines` lines
 *    of classes 0 to 2 are in view: then the arterials come back, or a country
 *    view would be nearly blank.
 *  Starting values. */
export const ROADS_CLASS_LIMITS = { mainUpToM: 10_000, sparseLines: 40 } as const;
/** Line widths in screen pixels, by kind and view: the whole width of a road,
 *  its casing. Wide enough in "Near me" to read as streets on the light disc;
 *  in the whole way the freeway stands well above the highway and the
 *  arterial, so the hierarchy reads at a glance. A freeway ramp is drawn in
 *  "Near me" only, at the collector width. Starting values. */
export const ROADS_WIDTH_PX = {
  whole: { freeway: 5.5, highway: 2.8, arterial: 1.6, collector: 1.2 },
  near: { freeway: 11, highway: 9, arterial: 6, collector: 4 },
} as const;
/** The centre arrow's size, as a share of the arrow first built for the plain
 *  dial: smaller, so it covers less of the map it sits on (at full size it hid
 *  the middle of the map, where the roads through the person run). Starting
 *  value. */
export const DIAL_ARROW_SCALE = 0.5;
/** The compass letters' size on the phone's dial: 13 px on the 328 px dial of
 *  a 360 px phone, the card's floor for any text a person must read there.
 *  The dial is drawn in its own units and scales, so the letters are sized as
 *  that share of the dial. */
export const DIAL_LETTER_PX = 13;
export const DIAL_PHONE_PX = 328;
/** The place's pin on the ring, tip to top, on the phone's dial: 30 px. At
 *  22 px, the size of the drop inside the disc, the ring pin read smaller than
 *  a compass letter on the phone (28 Sep), and it is what the person turns to
 *  bring under the notch. The drop inside the disc stays 22 px: there it sits
 *  on the map among the roads. */
export const DIAL_RING_PIN_PX = 30;
/** Looking around the map by dragging it. The map may be moved at most this
 *  far from the person: far enough to see the next suburb, not so far that the
 *  person loses the map (the view itself is 1.5 km round them). */
export const ROADS_PAN_MAX_M = 3_000;
/** A pointer that moves less than this before it lifts is a tap, and a tap on
 *  the map does nothing: a finger resting on a phone in a hand moves a few
 *  pixels. Screen pixels. Starting value. */
export const ROADS_PAN_TAP_PX = 6;
/** With the map moved and no touch for this long, it returns to the person by
 *  itself: someone who looked away and back must find themselves at the
 *  centre. Starting value. */
export const ROADS_PAN_RETURN_MS = 15_000;
/** The scale bar on the map disc: this many metres, a round figure a person
 *  can pace out, short enough to sit in the disc's corner in "Near me". */
export const ROADS_SCALE_BAR_M = 500;
/** Its label, in screen pixels: as quiet as the map's own names. Starting
 *  value. */
export const ROADS_SCALE_LABEL_PX = 11;
/** Each road is drawn twice, a darker casing at its full width and its fill on
 *  top; the fill is narrower by this edge on each side: a share of the width,
 *  never under `minPx`, so the edge shows on the thinnest road. Starting
 *  values. */
export const ROADS_CASING_EDGE = { share: 0.15, minPx: 0.6 } as const;
/** At most this many road names in view: more and the dial reads as a street
 *  map, which it is not. Starting value. */
export const ROADS_LABEL_COUNT = 4;
/** Road names, in screen pixels: over the card's 13 px floor, so they read at
 *  arm's length. The label rule fits names at this size and the dial draws
 *  them at it. Starting value. */
export const ROADS_LABEL_PX = 14;
/** A name may take up to this share of its line's visible length (the longest
 *  run in view), placed on the line's straightest stretches. Starting value. */
export const ROADS_LABEL_STRETCH = 0.9;
/** How straight a stretch is: the straight-line distance between its ends over
 *  its length, 1 for a straight line. Summing the turns instead counted every
 *  pixel's wobble, so a road that was plainly straight at the dial's scale
 *  scored as bent. Stretches within this much of the straightest count as
 *  equally straight, so a name can move off the arrow onto a stretch that is
 *  nearly as good. Starting value. */
export const ROADS_LABEL_STRAIGHT_SLACK = 0.02;
/** The least straightness the stretch under a name may have. Round a hairpin,
 *  or along a road that wiggles, a name reads as broken letters with part of
 *  it upside down (seen in the 20 km view): such a stretch is no room at all.
 *  Starting value. */
export const ROADS_LABEL_MIN_STRAIGHT = 0.9;
/** The room a name needs beyond its own width, each end, and the clear space
 *  between two names. Starting values. */
export const ROADS_LABEL_PAD_PX = 4;
export const ROADS_LABEL_GAP_PX = 3;
/** Locality names on the map disc, "Whole way" only: the suburbs and towns a
 *  person knows, so the far view says where the place lies among them.
 *  Upper case at this size in screen pixels, with this much letter-spacing.
 *  Starting values. */
export const ROADS_LOCALITY_PX = 9.5;
export const ROADS_LOCALITY_LETTER_SPACING_PX = 1;
/** At most this many locality names on the disc. Starting value. */
export const ROADS_LOCALITY_COUNT = 8;
/** A locality is not named closer than this to the centre, where the arrow is,
 *  nor this close to the disc's edge, where the name would be cut off, nor
 *  this close to a locality already named. Screen pixels. Starting values. */
export const ROADS_LOCALITY_CENTRE_PX = 46;
export const ROADS_LOCALITY_EDGE_PX = 30;
export const ROADS_LOCALITY_SPACING_PX = 62;
/** A locality name keeps this much clear round its own upright box, of road
 *  names and of the pin. Screen pixels. Starting value. */
export const ROADS_LOCALITY_PAD_PX = 4;

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
 *  snapshot has its own window, separate from the SNAPSHOT_MAX_AGE_DAYS build
 *  gate. Label only; the programs stay shown. */
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
/** Red Cross's register for letting family know you are safe, live during an emergency. */
export const REGISTER_FIND_REUNITE_URL = 'https://register.redcross.org.au/';
/** The VicEmergency hotline, the one number every call list opens with. */
export const HOTLINE_NUMBER = '1800 226 226';
export const TRIPLE_ZERO = '000';

/** Programs the user chose to keep: program ids only, on this phone, capped so
 *  the list can never grow without bound. */
export const KEPT_KEY = 'cooeee.kept.v1';
export const KEPT_MAX = 50;
/** R1: the roadmap steps ticked done, as step ids. */
export const ROADMAP_DONE_KEY = 'cooeee.roadmap.v1';

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
/** The unsaved words of a pack's note, one draft per pack, under this prefix
 *  and the pack id. Cleared by Save, Cancel and Delete, and with the pack. */
export const NOTE_DRAFT_KEY_PREFIX = 'cooeee.note-draft.v1:';

/** Nearby places (spec §7). A dynamic snapshot whose feed is older than this is
 *  no longer shown as a place to go — only the stale notice and the hotline stay. */
export const DYNAMIC_SNAPSHOT_MAX_AGE_MS = 60 * 60_000;
export const NEARBY_SYNC_TIMEOUT_MS = 15_000;
export const NEARBY_RESYNC_MS = 5 * 60_000; // while the screen stays open and online
export const NEARBY_CLOCK_MS = 60_000; // how often the age labels are re-read
export const NEARBY_FIX_TIMEOUT_MS = 15_000;
/** How long Nearby shows Searching… at least, so a search is always seen to happen. */
export const SEARCH_SHOW_MS = 500;
export const NEARBY_FIX_MAX_AGE_MS = 60_000; // a position the OS already has is fine
/** Use my location: a position vaguer than this cannot pick out one house, so
 *  the list says how rough it is. Vaguer than LOCATE_TOO_ROUGH_M the nearest
 *  addresses would be someone else's, so the position is not used. */
export const LOCATE_ROUGH_M = 50;
export const LOCATE_TOO_ROUGH_M = 1_000;
