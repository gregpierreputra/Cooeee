// EVERY user-facing string in the product. 
// Components contain no inline literals.
// The mandated lines below are exact, punctuation, and em dashes included — and
// tests/core/copy.test.ts asserts each one by exact match.
// The exact text literal that will be used in all of the main pages.
// Never reword them.

// Core Mandated Literals
export const SORTED_BY_DISTANCE = 'sorted by distance, not a safety ranking';

export const NO_ADDRESS_MATCH =
  'No matching address found — check the spelling or try the nearest cross street.';

export const NO_GPS = 'No GPS fix — showing your saved information.';

export const GPS_TOO_INACCURATE = (m: number) =>
  `GPS is too inaccurate here to trust a direction (± ${m} m).`;

export const OUTSIDE_AREAS = "You're outside the areas you've prepared";

export const NOT_RECENTLY_VERIFIED = (days: number) =>
  `Saved ${days} days ago — not recently verified`;

// Shared vocabulary
/** 16-point compass abbreviations, 
 * index 0 = north, one entry every 22.5 degrees. 
 * Read by core/geo.ts cardinalAbbr(). */
export const CARDINAL_ABBR = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
] as const;

/** Arrow glyphs for the 8 primary directions, index 0 = north, one every 45
 *  degrees. Read by core/geo.ts arrowGlyph(). A screen-relative glyph, not a
 *  compass needle: it points where the bearing sits on a north-up dial. */
export const ARROW_GLYPHS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'] as const;

// Application shell
export const APP_NAME = 'Cooeee';
export const HOME_TITLE = 'Your packs';
export const BACK = 'Back';

// Connection notice. States what the browser reports, nothing more — this app
// cannot detect phone signal, and never claims to.
export const ONLINE_NOTICE = 'Online — connected to a network.';
export const OFFLINE_NOTICE = 'Offline — saved packs still work.';
export const DISMISS_NOTICE = 'Dismiss connection notice';

export const NO_PACKS_YET = 'No packs saved yet.';
export const NO_PACKS_HINT =
  'Build a pack while you have a connection, so it is on your phone when there is none.';
export const SAVED_DAYS_AGO = (days: number) => `Saved ${days} days ago`;

export const NEW_VERSION_READY =
  'A new version is ready. It is applied when you choose to reload — nothing changes until then.';
export const RELOAD_NOW = 'Reload now';

// E1-US1-AC1 address confirmation
export const CONFIRM_ADDRESS_QUESTION = 'Is this the place you want to save?';
export const PLACE_NAME_LABEL = 'Place name';
export const SAVE_THIS_PLACE = 'Save this place';
export const SEARCH_AGAIN = 'Search again';

// E1-US1-AC2–AC4 address search
export const BUILD_A_PACK = 'Build a pack';
export const ADDRESS_SEARCH_TITLE = 'Search for your address';
export const ADDRESS_FIELD_LABEL = 'Address';
export const SEARCH = 'Search';
export const SEARCH_IN_PROGRESS = 'Searching for addresses.';
export const ADDRESS_QUERY_TOO_SHORT = 'Enter at least 3 characters.';
export const CHOOSE_ADDRESS = 'Choose your address from the list.';
export const CANDIDATE_LIST_LABEL = 'Address candidates';
export const NONE_OF_THESE = 'None of these is my address';
/** The register describes one address at more than one point and does not say
 * which it means. Stated as the limit it is, never as a result. */
export const ADDRESS_NOT_RESOLVED = 'One address could not be matched to a single map location.';
export const ADDRESSES_NOT_RESOLVED = (count: number) =>
  `${count} addresses could not be matched to a single map location.`;
export const ADDRESS_NOT_RESOLVED_REASON =
  'The address register holds multiple map locations for the same written address, so Cooeee cannot choose one.';
export const REFINE_ADDRESS_HINT =
  'Check or add a unit or street number, then search again.';
/** Both numbers, in one line. The lines on screen are the distinct addresses
 * the user can choose, which is what AC2 counts; the register's own record count
 * can be higher because retired records are excluded and records describing one
 * address at one point collapse. Stating only the second number would hide the
 * cap; stating only the first would disagree with the list. */
export const ADDRESS_RESULT_COUNT = (returned: number, listed: number) =>
  `The address register returned ${returned} ${returned === 1 ? 'record' : 'records'}; `
  + `${listed} distinct ${listed === 1 ? 'address is' : 'addresses are'} listed below.`;
export const ADDRESS_RESULT_CAPPED = (limit: number) =>
  `Cooeee asks the register for at most ${limit} records, so there may be more. `
  + 'Type more of the address to shorten the list.';
export const SEARCH_COULD_NOT_RUN = 'We could not search for this address right now.';
export const SEARCH_FAILURE_MEANING =
  'This is not the same as saying the address is not there. Try again when you have a connection.';
export const TRY_AGAIN = 'Try again';

// E1-US1-AC5–AC7 bushfire-area check
export const AREA_CHECK_IN_PROGRESS = 'Checking the published bushfire area.';
export const INSIDE_BUSHFIRE_AREA =
  'This address is inside a Designated Bushfire Prone Area.';
export const NOTHING_MAPPED_AT_ADDRESS =
  'No Designated Bushfire Prone Area is mapped at this address in the current planning scheme.';
export const AREA_NOT_PUBLISHED =
  'The Designated Bushfire Prone Area is not published for this area — Department of Transport and Planning.';
export const DTP_SAVED_DATE = (date: string) =>
  `Published by the Department of Transport and Planning, saved ${date}.`;
export const OFFICIAL_INSTRUCTIONS_FIRST =
  'Follow Country Fire Authority and emergency service instructions first.';
export const AREA_CHECK_COULD_NOT_RUN =
  'We could not check the bushfire area for this address right now.';
export const AREA_NOT_SAVED =
  'Nothing has been saved. Your address is still here — try again when you have a connection.';

// E1-US1-AC8 pack conflict
export const CHECKING_SAVED_PLACE = 'Checking the saved place on this device.';
export const PLACE_ALREADY_SAVED = 'You already have a saved place.';
export const SAVED_ADDRESS_LABEL = 'Saved address';
export const NEW_ADDRESS_LABEL = 'New address';
export const KEEP_SAVED_PLACE = 'Keep the saved place';
export const REPLACE_WITH_THIS_ONE = 'Replace it with this one';
export const SAVED_PLACE_CHECK_FAILED =
  'We could not check the saved place on this device.';
export const MULTIPLE_SAVED_PACKS =
  'More than one saved pack was found on this device.';
export const NOTHING_CHANGED = 'Nothing has been changed.';

// E1-US1-AC9 pack offer and download
export const READY_TO_DOWNLOAD = 'Ready to download';
export const PACK_SIZE_LINE = (size: string) => `This pack is ${size}`;
export const SAVE_PACK = 'Save this pack';
export const SAVING_PACK = 'Saving the pack.';
export const DOWNLOAD_STOPPED = 'The download stopped before it finished.';
export const PREVIOUS_PACK_UNTOUCHED =
  'Nothing has been changed. Your previous pack is untouched.';
export const PLACE_SAVED = 'Place saved';

// E1-US2-AC1–AC5 pack provenance and offline source access
export const YOUR_PACK = 'Your pack';
export const PROVENANCE_LINE = (publisher: string, date: string) =>
  `Published by ${publisher} · Saved ${date}`;
export const SAVED_TODAY = 'Saved today';
export const ITEM_DAYS_AGO = (days: number) => `${days} days ago`;
export const NOT_RECENTLY_VERIFIED_LABEL = 'Not recently verified';
export const STALE_PACK_STILL_WORKS =
  'This pack still works. Refresh it when you are next online.';
export const ITEM_LEFT_OUT = 'One item was left out of your pack.';
export const ITEMS_LEFT_OUT = (count: number) => `${count} items were left out of your pack.`;
export const ITEM_LEFT_OUT_REASON =
  'It did not name who published it or when it was published, so it was not saved.';
export const PROVENANCE_STORAGE_RULE =
  'Cooeee only stores information it can show you the source for.';
export const SOURCE_IS_ON_WEB = 'This source is on the web.';
export const STORED_PROVENANCE_REMAINS =
  'The publisher and the saved date below are stored on this device and stay readable.';
export const OPEN_ORIGINAL_SOURCE = 'Open original source (web)';
export const EXTERNAL_SOURCE_NOTICE =
  'Opening it may use your connection and leave Cooeee.';
export const CONTINUE_TO_ORIGINAL_SOURCE = 'Continue to original source (web)';
export const CLOSE = 'Close';

// E1-US1-AC1/AC9 production pack-save wiring
export const SEE_PACK_SIZE = 'See pack size';
export const PREPARING_PACK_OFFER = 'Preparing the pack offer.';
export const PACK_OFFER_FAILED = 'We could not prepare this pack right now.';
export const OPEN_SAVED_PACK = 'Open saved pack';

export const BACK_TO_YOUR_PACKS = 'Back to Your packs';
export const BACK_TO_HOME = 'Back to Home';

export const PACK_NOT_FOUND = 'This saved pack is not available on this device.';
export const NO_STORED_ITEMS = 'This pack has no stored information items to show.';
export const RECOVERY_ITEMS_UNVERIFIED =
  'Saved recovery references could not be verified, so they are not shown.';
export const DESIGNATED_BUSHFIRE_PRONE_AREA = 'Designated Bushfire Prone Area';
export const BUSHFIRE_MANAGEMENT_OVERLAY = 'Bushfire Management Overlay';
export const LAND_SUBJECT_TO_INUNDATION_OVERLAY = 'Land Subject to Inundation Overlay';
export const FLOODWAY_OVERLAY = 'Floodway Overlay';
export const SPECIAL_BUILDING_OVERLAY = 'Special Building Overlay';
export const OFFICIAL_DESTINATION_INFORMATION = 'Official place of last resort information';
export const OFFLINE_BASEMAP = 'Offline basemap';

// ── E2-US1 official places of last resort ──────────────────────────────────

export const DESTINATIONS_STEP_TITLE = 'Official places of last resort';
export const NSP_KIND_LABEL = 'Bushfire place of last resort';
export const NSP_COUNCIL_LABEL = (council: string) => `Responsible council: ${council}`;
export const NSP_LIST_AS_AT = (date: string) => `Country Fire Authority state-wide list as at ${date}`;
export const NSP_UNLOCATED_HEADING =
  'On the Country Fire Authority list but not located to a point on the map';
export const OFFICIAL_LIST_UNAVAILABLE =
  'The official list could not be included for this area.';
export const NSP_BUSHFIRE_ONLY =
  'Neighbourhood Safer Places are for bushfire only. None are shown for this pack.';

// ── E2-US2 choose and save two ────────────────────────────────────────────

export const SAVE_LAST_RESORT_PLACES = 'Save last-resort places';
export const CHOOSE_PLACES_HINT = (n: number) =>
  n === 1 ? 'Choose the place to save.' : 'Choose two places to save.';
export const TWO_PLACES_ALREADY_CHOSEN =
  'Two places are already chosen. Unchoose one to change your selection.';
export const SAVING_LAST_RESORT_PLACES = 'Saving your last-resort places.';
export const LAST_RESORT_PLACES_SAVED = 'Last-resort places saved';
export const LAST_RESORT_SAVE_FAILED =
  'Your places were not saved. Your selection is still here — try again.';

/** The mandated absence line, plus the area it applies to. */
export const NO_DESTINATION_PUBLISHED =
  'No official place of last resort is published for this area';
export const NO_DESTINATION_PUBLISHED_FOR = (area: string) =>
  `${NO_DESTINATION_PUBLISHED} — ${area}.`;

/** Position words for the distance-ordered list; beyond the third there is no
 *  label, because there is no ranking to extend. */
export const ORDINALS = ['nearest', 'second nearest', 'third nearest'] as const;

// Screen eyebrows
// The small label above each screen's heading, rendered as the hero kicker. 
// It names the step of the flow the user is in, so the label earns its place
// rather than repeating the mode.
// 
// Sentence case here, capitals on screen: .kicker carries text-transform, and
// the DOM carries an ordinary word. 
// 
// Some screen readers spell an all-caps string out letter by letter, 
// so the stored casing is an accessibility decision, not a styling one — 
// and keeping the transform meaningful stops it silently diverging
// from what is stored. tests/core/copy.test.ts locks all five by exact match.

export const EYEBROW_SET_UP_YOUR_PLACE = 'Set up your place';
export const EYEBROW_CONFIRM_ADDRESS = 'Confirm address';
export const EYEBROW_AREA_RESULT = 'Area result';
export const EYEBROW_SAVE_YOUR_PACK = 'Save your pack';
export const EYEBROW_MY_PACK = 'My pack';

// E3-US1-AC1 BlackSky prepared direction
export const BLACKSKY_TITLE = 'BlackSky';
export const HOLD_FOR_BLACKSKY = 'Hold for BlackSky';

export const ACCURACY_READOUT = (m: number) => `± ${m} m`;

/** "850 m" under a kilometre, "1.1 km" from there. The precision a person on
 *  foot can act on — never more. */
export const distanceLabel = (m: number): string =>
  m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;

/** The whole bearing-and-distance figure: "NE ↗ · 1.1 km". This is the display
 *  in full — never a route, an ETA or an arrival promise. */
export const BEARING_FIGURE = (point: string, glyph: string, distance: string) =>
  `${point} ${glyph} · ${distance}`;

// E3-US1-AC4 marked-position estimate
export const MARK_HINT =
  'If you are standing at your saved place, mark it — bearings can be estimated from there. This is not GPS.';

export const MARK_AT_SAVED_PLACE = (address: string) => `I'm standing at ${address}`;

/** Always the word ESTIMATE, and the uncertainty stated as growing — a marked
 *  position must never read like a fix. */
export const ESTIMATE_READOUT = (m: number) =>
  `ESTIMATE from your marked position — ± ${m} m and growing`;

// E3-US2-AC1 outside every pack area
/** Distance to a pack area's EDGE — never presented as a direction. */
export const AREA_DISTANCE_LINE = (distance: string) => `${distance} to its area`;

// General official guidance, stored in the app itself so it is readable with
// zero network. The numbers are safety copy: exact-match tested, never retyped.
export const GENERAL_GUIDANCE_TITLE = 'General official guidance';
export const CALL_TRIPLE_ZERO = 'Call 000 (Triple Zero) for life-threatening emergencies.';
export const VICEMERGENCY_HOTLINE = 'VicEmergency hotline 1800 226 226.';
export const EMERGENCY_BROADCASTER =
  'Australian Broadcasting Corporation local radio broadcasts official emergency information.';
/** States what the app cannot detect — never a promise about the network. */
export const PHONE_MAY_WORK =
  'Phone calls may work if your phone shows signal — this app cannot detect phone signal.';

// E3-US2-AC2 no pack stored
export const NO_PACK_HERE = 'No saved pack covers this place.';

// Built-in static preparation guidance, readable on a fresh install that has
// never been online since setup.
export const PREPARATION_GUIDANCE_TITLE = 'Preparing for an emergency';
export const PREP_KIT_LINE =
  'Keep water, medications, a torch and a battery radio where you can grab them.';
export const PREP_PLAN_LINE = 'Decide where you would go and how, before you need to.';

// E3-US2-AC3 BlackSky never says safe
/** How every saved place is described, with its source. The term is the CFA's
 *  own — a place of LAST resort — and the wording promises nothing about it. */
export const PLACE_DESCRIPTOR = (publisher: string) =>
  `Official place of last resort · ${publisher}`;

// E3-US3-AC1 deliberate activation
/** Shown after a stray tap on the hold control — the tap itself does nothing. */
export const HOLD_TO_ENTER = 'Hold to enter — two seconds.';
export const LEAVE_BLACKSKY = 'Leave BlackSky';

// ── E1-US2-AC6 returning-user home and the fixed header ────────────────────

/** The header's age line, inside the refresh window. Deliberately different
 *  wording from the pack card's SAVED_DAYS_AGO: the card reports when the pack
 *  was written, the header reports when its contents were last checked, and one
 *  sentence must never be mistaken for the other. */
export const CHECKED_DAYS_AGO = (days: number) => `Checked ${days} days ago`;

/** The header's home control. The mark is decorative; this names it. */
export const HEADER_HOME_LABEL = 'Cooeee home';

/** The connection dot carries no words on screen, so its whole meaning has to
 *  live in its accessible name. It reports what the browser reports and nothing
 *  more — this app cannot detect phone signal, and never claims to. */
export const CONNECTION_ONLINE_LABEL = 'Connection: your browser reports a network.';
export const CONNECTION_OFFLINE_LABEL = 'Connection: your browser reports no network.';

export const NO_PACK_SAVED = 'No pack is saved on this device.';
export const OPEN_PACK = 'Open';
export const SAVED_PLACE_LABEL = 'Saved place';

export const NAV_LABEL = 'Main';
export const NAV_HOME = 'Home';
export const NAV_MY_PACK = 'My pack';

/** Eight preparation lines, each grounded in Country Fire Authority plan-and-
 *  prepare guidance. One is shown per day and named with its source on screen;
 *  none of them is advice about a particular place, and none of them says
 *  anything about what is happening outside. */
export const PREPARATION_LINES = [
  'Write your household bushfire plan down, and decide who does what.',
  'Decide what would make you leave, and leave early on a hot, windy day.',
  'Clear the leaves from your gutters and cut long grass near the house.',
  'Move woodpiles, mulch and outdoor furniture away from walls and windows.',
  'Put together a fire-ready kit: water, medications, a torch and a battery radio.',
  'Decide now what you would take — identity documents, medicines, phone chargers.',
  'Plan how you would move pets, horses and other animals, and where they would go.',
  'Talk the plan through with everyone in the house before the fire season starts.',
] as const;

export const PREPARATION_SOURCE = 'Country Fire Authority — plan and prepare guidance.';

/** The pack card's footer line. Appended to the card's own age wording rather
 *  than written into it: the age is a fact about the pack, and this is a fact
 *  about the pack's whole point — it is on the device, so it opens with the
 *  radios off. It states what the pack does, never what it protects you from. */
export const OPENS_WITHOUT_SIGNAL = ' · opens without signal';

/** Under the hold control. Two lines, chosen by whether a pack is saved, both
 *  saying what BlackSky IS rather than urging anyone into it: it is a separate
 *  mode entered on purpose, and it is reachable with nothing saved. */
export const BLACKSKY_SEPARATE_FROM_EVERYDAY = 'SEPARATE FROM EVERYDAY USE';
export const BLACKSKY_WORKS_WITHOUT_PACK = 'WORKS WITHOUT A SAVED PACK';
