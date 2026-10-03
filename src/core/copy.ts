// EVERY user-facing string in the product.
// Components contain no inline literals.
// The mandated lines below are exact, punctuation included, and
// tests/core/copy.test.ts asserts each one by exact match. No user-facing
// string carries an em dash: scripts/banned-terms.mjs fails the build on one.
// Never reword them without updating the tests.

import { AREA_MAP_HALF_KM } from './constants';
import type { Destination, FacilityType, NeedKey, SourceStatus } from './types';

// Core Mandated Literals
export const SORTED_BY_DISTANCE = 'sorted by distance, not a safety ranking';

export const NO_ADDRESS_MATCH = 'No match. Check the spelling or try a cross street.';

export const NO_GPS = 'No GPS fix. Showing saved information.';

/** Said beside the arrows, never instead of them: a vague or old fix still
 *  points, with its error stated. */
export const GPS_APPROXIMATE = (m: number) => `GPS ± ${m} m here. Direction is approximate.`;
export const FIX_AGE = (s: number) => `GPS fix ${s} s old. Direction may have changed.`;

/** Said of the pack that is loaded, never of every pack: another saved pack
 *  may well cover this place, and the picker says so beside it. */
export const OUTSIDE_AREAS = "You're outside this pack's area";

export const NOT_RECENTLY_VERIFIED = (days: number) =>
  `Saved ${days} days ago, not recently verified`;

// Shared vocabulary
/** The eight compass points by name, index 0 = north, one every 45 degrees.
 *  Read by core/geo.ts cardinalPoint(). Names, not letters: a lone "E" beside
 *  the distance read as a stray letter on a real phone, and "NE" read aloud is
 *  two letters. The word is shown small; it is never abbreviated. */
export const CARDINAL_POINTS = [
  'North',
  'North-east',
  'East',
  'South-east',
  'South',
  'South-west',
  'West',
  'North-west',
] as const;
// Application shell
export const APP_NAME = 'Cooeee';
export const APP_TAGLINE =
  'Your offline-capable life-saver supporting you before, during, and after disasters.';
export const BACK = 'Back';

// Connection notice. States what the browser reports, nothing more — this app
// cannot detect phone signal, and never claims to.
export const ONLINE_NOTICE = 'Online';
export const OFFLINE_NOTICE = 'Offline. Packs still work.';
export const DISMISS_NOTICE = 'Dismiss connection notice';

export const NO_PACKS_HINT = 'Build one while you have a connection.';
/** "1 day", "3 days": a pack saved yesterday must not read "1 days ago". */
const dayCount = (days: number) => (days === 1 ? '1 day' : `${days} days`);
export const SAVED_DAYS_AGO = (days: number) => `Saved ${dayCount(days)} ago`;

// Deleting a saved pack — the cross opens an in-card confirmation; nothing is
// removed until the delete answer is chosen.
export const DELETE_PACK = 'Delete this pack';
export const PACK_SETTINGS = (name: string) => `Settings for ${name}`;
export const DELETE_PACK_QUESTION = 'Delete this pack?';
export const KEEP_THIS_PACK = 'Keep it';
export const CONFIRM_DELETE_PACK = 'Delete';

export const NEW_VERSION_READY = 'Update ready. Nothing changes until you reload.';
export const RELOAD_NOW = 'Reload';

// E1-US1-AC1 address confirmation
export const CONFIRM_ADDRESS_QUESTION = 'Is this the place?';
export const PLACE_NAME_LABEL = 'Place name';
export const SAVE_THIS_PLACE = 'Save this place';
export const SEARCH_AGAIN = 'Search again';

// E1-US1-AC2–AC4 address search
export const BUILD_A_PACK = 'New offline pack';
export const ADDRESS_SEARCH_TITLE = 'Your address';
export const ADDRESS_FIELD_LABEL = 'Street address';
export const ABOUT_ADDRESS = 'Why the exact address';
/** At the field itself: the street address is the point every official place
 *  of last resort is measured from, so it has to be the right one. */
export const ADDRESS_FIELD_HINT = 'Your official places of last resort are measured from it.';
/** Said before the search, so an address with no official place close by is
 *  never a surprise at the places step. */
export const ADDRESS_SEARCH_DISCLOSURE =
  'Some addresses have none close by, and some areas have none. Cooeee lists the nearest the Country Fire Authority publishes.';
/** Use my location on the address search. The position is sent to the address
 *  register, so the screen says so before the button is tapped. */
export const ADDRESS_LOCATE_DISCLOSURE = 'Sends your position to the Victorian address register. Not stored.';
export const ADDRESS_LOCATE_FOUND = 'Addresses nearest you';
export const ADDRESS_LOCATE_FAILED = 'Position unavailable. Type the address.';
export const ADDRESS_LOCATE_OUTSIDE = 'You are outside Victoria. Type a Victorian address.';
export const ADDRESS_LOCATE_NONE = 'No address near you. Type it instead.';
export const SEARCH_IN_PROGRESS = 'Searching…';
export const ADDRESS_QUERY_TOO_SHORT = 'Enter at least 3 characters.';
export const CANDIDATE_LIST_LABEL = 'Address candidates';
export const NONE_OF_THESE = 'Not my address';
/** The register describes one address at more than one point and does not say
 * which it means. Stated as the limit it is, never as a result. */
export const REFINE_ADDRESS_HINT = 'Add a unit or street number.';
/** The count agrees with the list on screen. A capped answer says so on its
 * own sentence, so the cap is never hidden. */
export const ADDRESS_RESULT_COUNT = (listed: number) =>
  `${listed} ${listed === 1 ? 'address' : 'addresses'} found`;
export const ADDRESS_RESULT_CAPPED = 'Type more to narrow it.';
export const SEARCH_COULD_NOT_RUN = 'Search is unavailable right now.';
export const SEARCH_FAILURE_MEANING = 'The address may still exist.';
export const TRY_AGAIN = 'Try again';

// E1-US1-AC5–AC7 bushfire-area check
export const AREA_CHECK_IN_PROGRESS = 'Checking the bushfire area…';
export const INSIDE_BPA_TERM = 'inside a Bushfire Prone Area';
export const INSIDE_BUSHFIRE_AREA = `This address is ${INSIDE_BPA_TERM}.`;
export const NOTHING_MAPPED_AT_ADDRESS =
  'No Bushfire Prone Area is mapped here.';
export const AREA_NOT_PUBLISHED =
  'No Bushfire Prone Area map is published here.';
/** UAT: people read an absence on the planning map as their place being out of
 *  a fire's way. The map sets building rules only, so every answer other than
 *  inside says so. */
export const AREA_MAP_IS_NOT_FIRE_REACH =
  'Fire can still reach you. This map only sets building rules.';
export const OFFICIAL_INSTRUCTIONS_FIRST =
  'Follow Country Fire Authority and emergency service instructions first.';
export const AREA_CHECK_COULD_NOT_RUN = 'The bushfire area check is unavailable right now.';
export const AREA_NOT_SAVED = 'Nothing saved. Your address is still here. Try again with a connection.';

// E1-US1-AC8 pack conflict: the confirmed address already has a saved pack
export const CHECKING_SAVED_PLACE = 'Checking this phone…';
export const PLACE_ALREADY_SAVED = 'This address already has a pack.';
export const SAVED_ADDRESS_LABEL = 'Saved address';
export const KEEP_SAVED_PACK = 'Keep saved pack';
export const REPLACE_SAVED_PACK = 'Replace with new';
export const SAVED_PLACE_CHECK_FAILED = 'This phone could not be checked.';
export const NOTHING_CHANGED = 'Nothing changed.';

// E1-US1-AC9 pack offer and download
export const READY_TO_DOWNLOAD = 'Ready to download';
export const PACK_SIZE_LINE = (size: string) => `This pack is ${size}`;
export const SAVE_PACK = 'Save this pack';
export const SAVING_PACK = 'Saving…';
export const DOWNLOAD_STOPPED = 'Download stopped.';
export const PREVIOUS_PACK_UNTOUCHED = 'Nothing changed. Your previous pack is untouched.';
export const PLACE_SAVED = 'Place saved';

// E1-US2-AC1–AC5 pack provenance and offline source access
/** The small ring every source sits behind (UAT: publisher lines crowded each card). */
export const SOURCE_LABEL = 'Source';
export const ABOUT_SOURCE = 'About the source';
// The labelled rows inside the Source ring.
export const SOURCE_PUBLISHED_BY = 'Published by';
export const SOURCE_SAVED = 'Saved';
export const SOURCE_LICENCE = 'Licence';
export const SOURCE_LIST_DATE = 'List date';
export const SOURCE_TODAY = 'Today';
export const PROVENANCE_LINE = (publisher: string, date: string) =>
  `Published by ${publisher} · Saved ${date}`;
export const ITEM_DAYS_AGO = (days: number) => `${dayCount(days)} ago`;
export const NOT_RECENTLY_VERIFIED_LABEL = 'Not recently verified';
export const STALE_PACK_STILL_WORKS = 'Still works. Refresh it when next online.';
export const ITEM_LEFT_OUT = 'One item left out';
export const ITEMS_LEFT_OUT = (count: number) => `${count} items left out`;
export const ITEM_LEFT_OUT_REASON = 'No publisher or date was given.';
export const PROVENANCE_STORAGE_RULE = 'Cooeee keeps only information with a source.';
export const SOURCE_IS_ON_WEB = 'Opens on the web';
/** The copy of the source page saved inside the pack: opens with no signal. */
export const OPEN_SOURCE_FILE = 'Saved PDF';
export const OPEN_ORIGINAL_SOURCE = 'Web page';

/** The map of the pack's area stored with it: the Department's own drawing of
 *  its designation layer, and one line on how to read the picture. */
export const AREA_MAP_LABEL = 'Map of the area';
export const AREA_MAP_ALT =
  'Map of the area around the saved place, with the Designated Bushfire Prone Area shaded';
/** The map's key, drawn as swatches beside these words rather than said. */
export const AREA_MAP_KEY = { inside: 'Bushfire Prone Area', outside: 'Outside it', place: 'Your place' } as const;
export const AREA_MAP_ACROSS = `${AREA_MAP_HALF_KM * 2} km across`;
export const AREA_MAP_SOURCE = (date: string) => `Department of Transport and Planning map, saved ${date}`;
export const EXTERNAL_SOURCE_NOTICE = 'May use your connection and leave Cooeee.';
export const CONTINUE_TO_ORIGINAL_SOURCE = 'Continue to the web page';
/** The citation a stored designation can state in the app itself: the gazetted
 * plan the check matched, in the planning scheme's own terms. It is the answer
 * to "what was checked"; the raw response behind it is then an extra, not the
 * only way to read the result. */
export const BPA_PLAN_CITATION = (
  planNumber: string,
  gazettedDate: string,
  lgaName: string,
  publisher: string,
) => `Bushfire Prone Area plan ${planNumber} · gazetted ${gazettedDate} · ${lgaName} · ${publisher}`;
/** Used in place of CONTINUE_TO_ORIGINAL_SOURCE once the citation above is on
 * screen: what is on the far end is the publisher's page for the dataset as a
 * whole, not the only readable statement of this result. */
export const CONTINUE_TO_DATASET_PAGE = "Continue to the publisher's dataset page";
export const CLOSE = 'Close';

// E1-US1-AC1/AC9 production pack-save wiring
export const PREPARING_PACK_OFFER = 'Preparing your pack…';
export const PACK_OFFER_FAILED = 'This pack could not be prepared right now.';
export const OPEN_SAVED_PACK = 'Open saved pack';

export const BACK_TO_HOME = 'Back to Home';

export const PACK_NOT_FOUND = 'This saved pack is not available on this device.';
export const NO_STORED_ITEMS = 'This pack has no stored information items to show.';
export const RECOVERY_ITEMS_UNVERIFIED =
  'Saved recovery references could not be verified, so they are not shown.';
export const PACK_ITEMS_UNVERIFIED = 'Saved items could not be verified, so they are not shown.';
export const PLACES_UNVERIFIED = 'Saved places could not be verified, so they are not shown.';
export const DESIGNATED_BUSHFIRE_PRONE_AREA = 'Designated Bushfire Prone Area';
export const BUSHFIRE_MANAGEMENT_OVERLAY = 'Bushfire Management Overlay';
export const LAND_SUBJECT_TO_INUNDATION_OVERLAY = 'Land Subject to Inundation Overlay';
export const FLOODWAY_OVERLAY = 'Floodway Overlay';
export const SPECIAL_BUILDING_OVERLAY = 'Special Building Overlay';
// A saved layer row states its stored result, not just the layer's name. The
// name alone read as a designation even when the stored status was an absence.
export const LAYER_NONE_MAPPED_HERE = (layer: string) =>
  `${layer}, none mapped at this address`;
export const LAYER_NOT_PUBLISHED = (layer: string) =>
  `${layer}, not published for this area`;
export const OFFICIAL_DESTINATION_INFORMATION = 'Official place of last resort information';
export const OFFLINE_BASEMAP = 'Offline basemap';

// ── E2-US1 official places of last resort ──────────────────────────────────

export const DESTINATIONS_STEP_TITLE = 'Official places of last resort';
export const NSP_COUNCIL_LABEL = (council: string) => `${council} council`;
export const NSP_LIST_AS_AT = (date: string) => `Country Fire Authority list, ${date}`;
export const NSP_DESIGNATED_ON = (date: string) => `Designated ${date}`;
export const NSP_UNLOCATED_HEADING = 'Listed, but not on the map';
export const OFFICIAL_LIST_UNAVAILABLE =
  'The official list could not be included for this area.';
export const NSP_BUSHFIRE_ONLY =
  'Neighbourhood Safer Places are for bushfire only. None are shown for this pack.';

// ── E2-US2 choose and save two ────────────────────────────────────────────

export const SAVE_LAST_RESORT_PLACES = 'Save last-resort places';
export const CHOOSE_PLACES_HINT = (n: number) => (n === 1 ? 'Choose one' : 'Choose two');
export const TWO_PLACES_ALREADY_CHOSEN = 'Untick to change';
/** The places step's short order line beside the hint. */
export const SORTED_SHORT = 'sorted by distance';
/** Read out for the counter ring beside Choose two. */
export const PLACES_CHOSEN_COUNT = (chosen: number, total: number) => `${chosen} of ${total} chosen`;
export const SAVING_LAST_RESORT_PLACES = 'Saving…';
export const LOADING_LAST_RESORT_PLACES = 'Reading the official list…';
export const LAST_RESORT_PLACES_SAVED = 'Last-resort places saved';
export const LAST_RESORT_SAVE_FAILED = 'Not saved. Your choice is still here. Try again.';

/** The mandated absence line, plus the area it applies to. */
export const NO_DESTINATION_PUBLISHED =
  'No official place of last resort is published for this area';
export const NO_DESTINATION_PUBLISHED_FOR = (area: string) =>
  `${NO_DESTINATION_PUBLISHED}, ${area}.`;

// ── Personal note ─────────────────────────────────────────────────────────
// The user's own words, in their pack. Asked for once, after the places step;
// changed any time from the pack screen; read back in BlackSky.

export const NOTE_STEP_TITLE = 'Your note';
export const NOTE_DISCLOSURE = 'Kept on this phone and opens with no signal, here and in BlackSky.';
/** UAT: the risk was lost at the end of the disclosure, so it stands alone as a caution. */
export const NOTE_NOT_PROTECTED = 'This note has no password. Anyone who unlocks the phone can read it.';
export const NOTE_LABEL = 'Your note';
/** The box is never blank: an example written for this place and, when one
 *  was chosen, its nearest official place of last resort. One point per
 *  paragraph, so it reads at a glance. Every word is the user's to change. */
export const NOTE_EXAMPLE = (placeName: string, chosen?: Destination) =>
  [
    `Leave ${placeName} early on a hot, windy day.`,
    chosen?.name
      ? `Place of last resort: ${chosen.name}${chosen.addressText ? `, ${chosen.addressText}` : ''}.`
      : '',
    'Take the medication box, water, phone chargers and the dog lead.',
    'Turn the gas off at the meter before leaving.',
  ].filter(Boolean).join('\n\n');
export const KEEP_NOTE = 'Keep this note';
export const SKIP_NOTE = 'Not now';

export const NOTES = 'Notes';
export const ADD_NOTE = 'Add a note';
export const SAVE_NOTE = 'Save';
export const DELETE_NOTE = 'Delete';
export const NOTE_SAVED = 'Note saved.';
export const NOTE_DELETED = 'Note deleted.';
export const NOTE_EMPTY = 'Write something before saving.';
export const NOTE_CHANGE_FAILED = 'That change was not saved. Try again.';

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

export const EYEBROW_MY_PACK = 'My pack';

/** The steps of building a pack, drawn as a strip of glyphs over each screen. */
export const FLOW_STEPS = [
  { glyph: 'found', label: 'Address' },
  { glyph: 'layer', label: 'Area' },
  { glyph: 'place', label: 'Places' },
  { glyph: 'note', label: 'Note' },
  { glyph: 'bag', label: 'Save' },
] as const;
export const FLOW_STEP_OF = (step: number, total: number, label: string) => `Step ${step} of ${total}, ${label}`;

// E3-US1-AC1 BlackSky prepared direction
export const BLACKSKY_TITLE = 'BlackSky';
export const HOLD_FOR_BLACKSKY = 'Hold for BlackSky';

export const ACCURACY_READOUT = (m: number) => `± ${m} m`;
/** UAT: the bare ± figure under the arrows was not understood, so it is named,
 *  and the detail sits behind an information ring. */
export const ACCURACY_LABEL = 'Your position';
export const ABOUT_ACCURACY = 'About your position';
export const ACCURACY_DETAIL = (m: number) =>
  `Your phone places you within ${m} m of where you stand. The arrows and distances can be off by about that much.`;

// The compass. iOS only hands the orientation sensor over after a tap.
export const TURN_ON_COMPASS = 'Turn on the compass';

// BS_Enhancement-AC1 one place on one compass dial
/** The small label above the main place: where it comes from. Written in
 *  capitals here, not by the stylesheet, so a screen reader and a test read
 *  the same words the eye does. */
export const YOUR_CHOSEN_PLACE = 'YOUR CHOSEN PLACE';
export const NEAREST_PLACE_OF_LAST_RESORT = 'NEAREST PLACE OF LAST RESORT';
/** A state-wide site picked with Show that is not the nearest one: calling it
 *  nearest would be untrue. */
export const PLACE_OF_LAST_RESORT = 'PLACE OF LAST RESORT';
/** The dial as words, for a screen reader: the same three facts the eye gets. */
export const DIAL_DESCRIPTION = (site: string, distance: string, point: string) =>
  `${site}, ${distance}, ${point}`;
/** Every other place folded into one line: how many, and the range they lie
 *  in, nearest to furthest. A range, not a list, because the line must stay one
 *  line on the narrowest phone and must never be cut off: a list of four
 *  distances could do neither. Every distance is still in the sheet the line
 *  opens. One other place has no range, and two at the same distance read as
 *  one figure, not as "2.13 km – 2.13 km". `distances` is nearest first. */
export const PLACES_SEPARATOR = ' · ';
export const OTHER_PLACES_COUNT = (count: number) =>
  count === 1 ? '1 other place' : `${count} other places`;
export const OTHER_PLACES = (distances: string[]) => {
  const nearest = distances[0];
  const furthest = distances[distances.length - 1];
  const range = nearest === furthest ? nearest : `${nearest} – ${furthest}`;
  return `${OTHER_PLACES_COUNT(distances.length)}${PLACES_SEPARATOR}${range}`;
};
export const OTHER_PLACES_TITLE = 'Other places';
export const SHOW_PLACE = 'Show';
/** The Show button's name for a screen reader, so five buttons are not all
 *  called Show. It starts with the visible word (WCAG 2.5.3). */
export const SHOW_PLACE_NAMED = (site: string) => `Show ${site}`;
export const CLOSE_OTHER_PLACES = 'Close';
/** A position, and nothing stored on the phone that can be pointed at. */
export const NO_PLACE_TO_POINT_AT =
  'No official place of last resort stored on this phone can be pointed at from here.';

// BS_Enhancement-AC2 say plainly when position or heading cannot be trusted
export const GPS_SIGNAL_LOST = 'GPS signal lost';
/** How old the position is, beside the bar's words: seconds, then minutes. */
export const LAST_POSITION_AGE = (s: number) =>
  s < 60 ? `last position ${s} s ago` : `last position ${Math.floor(s / 60)} min ago`;
/** The bar when the position is a mark the person made, not a fix. */
export const FROM_YOUR_SAVED_PLACE = 'from your saved place';
/** Before a distance measured from an old, vague or estimated position. */
export const ABOUT = 'about';
/** The tag on a dial that nothing is turning. */
export const NORTH_UP = 'North up';

// BS_Enhancement-AC5 roads inside the dial. The roads are there to be
// recognised, never followed: no word here names a road to take or a way to go.
/** The button under the dial while the map has been dragged away from the
 *  person: it puts them back at the centre. */
export const MAP_RETURN_BUTTON = 'Back to me';
/** The attribution the road layer's licence asks for, on the About screen. */
export const ROADS_ATTRIBUTION = 'Roads: Vicmap Transport, Department of Transport and Planning, CC BY 4.0';
/** The same for the locality names on the map disc, under the roads line. */
export const LOCALITIES_ATTRIBUTION = 'Localities: Vicmap Admin, Department of Transport and Planning, CC BY 4.0';

// BS_Enhancement-AC3 say the place, distance and side aloud
// Everything the phone speaks, and the caption shows the same words. Each
// sentence states where the place IS. None tells the person which way to
// travel, and none promises anything about the place.
/** The speaker button's name. One name for both states: aria-pressed says
 *  whether it is on. */
export const VOICE_BUTTON = 'Speak the distance aloud';
/** A distance in words a voice reads well: whole tens of metres under a
 *  kilometre, one decimal place of kilometres from there. */
export const spokenDistance = (m: number): string => {
  if (m < 995) return `${Math.max(10, Math.round(m / 10) * 10)} metres`;
  const km = (m / 1000).toFixed(1).replace(/\.0$/, '');
  return km === '1' ? '1 kilometre' : `${km} kilometres`;
};
/** Which side the place is on, as seen from the top of the phone. Where it is,
 *  never what to do about it. */
export const SPOKEN_SIDES = {
  ahead: 'Ahead of you',
  right: 'On your right',
  behind: 'Behind you',
  left: 'On your left',
} as const;
/** The repeat: distance, compass point, side. The side is left out when nothing
 *  is turning the dial, because then it is not known. A figure from an old,
 *  vague or estimated position is said with "about", as it is shown. */
export const VOICE_SHORT = (distance: string, point: string, side: string | null, about: boolean) =>
  `${about ? `About ${distance}` : distance}. ${point}.${side ? ` ${side}.` : ''}`;
/** The first message after the tap: the place by name, then the repeat. */
export const VOICE_LONG = (site: string, short: string) => `${site}, place of last resort. ${short}`;
export const VOICE_SIGNAL_LOST = 'GPS signal lost.';
export const VOICE_SIGNAL_BACK = (short: string) => `GPS signal is back. ${short}`;
/** Said once, close to the place. A distance, not a promise about the place. */
export const VOICE_AT_PLACE = (site: string, metres: number) => `${site} is within ${metres} metres.`;

/** "850 m" under a kilometre, "2.34 km" under ten, "12.3 km" from there. Ten
 *  metre steps within walking range, so the figure is seen to move on foot. */
export const distanceLabel = (m: number): string => {
  // The unit follows the rounded figure, so 999.6 m reads 1.00 km, not 1000 m.
  if (Math.round(m) < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m < 10_000 ? 2 : 1)} km`;
};

// E3-US1-AC4 marked-position estimate
export const MARK_HINT = 'At your saved place? Mark it to estimate bearings. Not GPS.';

export const MARK_AT_SAVED_PLACE = (address: string) => `I'm standing at ${address}`;

/** Always the word ESTIMATE, and the uncertainty stated as growing — a marked
 *  position must never read like a fix. */
export const ESTIMATE_READOUT = (m: number) => `ESTIMATE from your mark, ± ${m} m and growing`;

// E3-US2-AC1 outside the loaded pack's area
/** Distance to a pack area's EDGE — never presented as a direction. */
export const AREA_DISTANCE_LINE = (distance: string) => `${distance} to its area`;

// General official guidance, stored in the app itself so it is readable with
// zero network. The numbers are safety copy: exact-match tested, never retyped.
export const GENERAL_GUIDANCE_TITLE = 'General official guidance';
export const CALL_TRIPLE_ZERO = 'Call 000 (Triple Zero) for life-threatening emergencies.';
export const VICEMERGENCY_HOTLINE = 'VicEmergency hotline 1800 226 226.';
export const EMERGENCY_BROADCASTER = 'ABC local radio carries official emergency information.';
/** States what the app cannot detect — never a promise about the network. */
export const PHONE_MAY_WORK = 'Calls may work if your phone shows signal. This app cannot detect it.';

// E3-US2-AC2 no pack stored
export const NO_PACK_HERE = 'No saved pack covers this place.';

// Several saved packs: which one to load, asked at the top of the screen.
export const CHOOSE_PACK = 'Choose a pack';
export const CHOOSE_PACK_HINT = 'Loads its places and notes. The nearest official places show either way.';
/** Beside a pack whose area contains the position the arrows are drawn from. */
export const PACK_COVERS_HERE = 'Covers where you are';
/** With several packs, none chosen and no fix: the one thing the screen can say. */
export const NO_GPS_YET = 'No GPS fix yet.';

// Built-in static preparation guidance, readable on a fresh install that has
// never been online since setup.
export const PREPARATION_GUIDANCE_TITLE = 'Before an emergency';
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
export const HOLD_TO_ENTER = 'Hold to enter. Two seconds.';
export const HOLD_TO_LEAVE = 'Hold to leave. Two seconds.';
/** The label on the full-width Leave bar at the top of BlackSky. It says what
 *  to do, so the bar needs no second line of help. */
export const LEAVE_BLACKSKY = 'Hold to leave';
/** Said under BlackSky's top bar, never over anything else: the phone's back
 *  button was pressed, or the app opened here again because BlackSky was the
 *  last screen open. Both end with the one way out. */
export const BLACKSKY_BLOCKED = 'Not opened. Hold its button two seconds to enter.';
export const BACK_PRESSED = `Back does not leave BlackSky. Use ${LEAVE_BLACKSKY} at the top.`;
export const BLACKSKY_RESUMED = `Reopened where you left off. To exit, use ${LEAVE_BLACKSKY} at the top.`;

// ── E1-US2-AC6 returning-user home and the fixed header ────────────────────

/** The header's age line, inside the refresh window. Deliberately different
 *  wording from the pack card's SAVED_DAYS_AGO: the card reports when the pack
 *  was written, the header reports when its contents were last checked, and one
 *  sentence must never be mistaken for the other. */
export const CHECKED_DAYS_AGO = (days: number) => `Checked ${dayCount(days)} ago`;

/** The header's home control. The mark is decorative; this names it. */
export const HEADER_HOME_LABEL = 'Cooeee home';

/** The dismissed connection notice is a wordless strip, so its whole meaning
 *  has to live in its accessible name. It reports what the browser reports and nothing
 *  more — this app cannot detect phone signal, and never claims to. */
export const CONNECTION_ONLINE_LABEL = 'Connection: your browser reports a network.';
export const CONNECTION_OFFLINE_LABEL = 'Connection: your browser reports no network.';

export const NO_PACK_SAVED = 'No pack saved yet.';

export const NAV_LABEL = 'Main';
export const NAV_HOME = 'Home';
export const NAV_ABOUT = 'About';
export const NAV_RECOVER = 'Recover';
export const NAV_REHEARSE = 'Rehearse';

// E4 Recover: needs-first support matching, read from the pack's dated snapshot
export const RECOVER_QUESTION = 'What do you need?';
export const RECOVER_PRIVACY_LINE = 'Nothing leaves this phone. Only programs you keep are remembered.';
export const NEED_PHRASE: Record<NeedKey, string> = {
  stay: 'Somewhere to stay',
  money: 'Money for essentials',
  food: 'Food and water',
  property: 'Repairs to my home',
  health: 'Someone to talk to',
  documents: 'Replace lost documents',
};
export const RECOVER_MAY_MATCH =
  'These may match. The responsible organisation decides who is eligible.';
/** The two tiles over the needs. The programs are on the phone, not in one
 *  pack, and every saved pack carries the saved ones. */
export const ALL_PROGRAMS = 'All programs';
export const ALL_PROGRAMS_DETAIL = 'on this phone';
export const KEPT_PROGRAMS = 'Saved programs';
export const KEPT_PROGRAMS_DETAIL = 'in every pack';
/** Clearing the saved list asks once, as deleting a pack does, because every
 *  saved pack mirrors the saved list and drops the programs with it. */
export const CLEAR_KEPT = 'Clear all';
export const CLEAR_KEPT_QUESTION = 'Clear every saved program?';
export const CLEAR_KEPT_PACKS = 'Your saved packs stop carrying them too.';
export const KEEP_KEPT = 'Keep them';
export const KEPT_CLEARED = 'Nothing is saved now. Tap Save to save one again.';
export const KEEP = 'Save';
export const KEPT = 'Saved';
export const SHARE_LIST = 'Share this list';
export const COPIED_LINE = 'Copied. Paste it into a message.';
export const SHARE_UNAVAILABLE = 'Sharing is not available in this browser.';
export const SHARED_FROM = 'Shared from Cooeee. Programs change, and the organisation decides.';
export const RECOVER_STALE_LINE = 'Over three months old. Programs change, so check with the organisation.';
export const CALL_LINE = (number: string) => `Call ${number}`;
export const RECOVER_NO_MATCH_TITLE = 'This pack holds nothing for that need.';
export const RECOVER_NO_MATCH_LINE = 'Help may still exist. Try the official channel with a connection.';
export const OFFICIAL_CHANNEL = 'Official channel (web)';
export const RECOVER_NONE_TITLE = 'No support information is held on this phone.';
export const SAVED_PROGRAMS = 'Saved programs';
export const STORED_INFORMATION = 'Stored information';
export const SHOW = 'Show';
export const HIDE = 'Hide';
export const SHOW_SECTION = (title: string) => `Show ${title}`;
export const HIDE_SECTION = (title: string) => `Hide ${title}`;
export const NO_SAVED_PROGRAMS = 'None saved yet. Save them in';
export const KEPT_NOT_SAVED = (count: number) =>
  `${count} saved ${count === 1 ? 'program is' : 'programs are'} not in a pack yet`;
export const IN_YOUR_PACKS = 'In your packs';
export const CHOOSE_IN_RECOVER = 'Choose programs in Recover';
export const WHO_TO_CALL = 'Who to call';
export const HOTLINE_LABEL = 'VicEmergency hotline';
export const CALLS_LINE = 'Calls often work when data does not.';
export const PRINT_LIST = 'Print this list';
export const RECOVER_NONE_LINE = 'Build a pack online. It carries the programs, so they open with no signal.';

/** The eyebrow over the daily preparation line. Uppercased by `.kicker`, so it
 *  is written here in sentence case and read out as words, not as letters. */
export const PREPARATION_LABEL = "Today's reminder";

/** Eight preparation lines, each grounded in Country Fire Authority plan-and-
 *  prepare guidance. One is shown per day and named with its source on screen;
 *  none of them is advice about a particular place, and none of them says
 *  anything about what is happening outside. Each carries a second line for
 *  the reader the first was not written for: someone without a car, a garden,
 *  animals, tools or a household of their own. */
export const PREPARATION_SOURCE_RECOVERY = 'From the programs in your pack';
export const PREPARATION_LINES: readonly { text: string; context: string; source?: string }[] = [
  {
    text: 'Write your household bushfire plan down, and decide who does what.',
    context: 'If you live alone, the plan is still worth writing. Decide who you would call and where you would go.',
  },
  {
    text: 'Decide what would make you leave, and leave early on a hot, windy day.',
    context: 'Without a car, leaving early matters even more. Arrange a lift or check the public transport times the day before.',
  },
  {
    text: 'Clear the leaves from your gutters and cut long grass near the house.',
    context: 'If you rent or live in a unit, ask the owner or body corporate who does this. Without the tools, or if you cannot climb steadily, ask for help rather than doing it yourself.',
  },
  {
    text: 'Move woodpiles, mulch and outdoor furniture away from walls and windows.',
    context: 'On a balcony or in a courtyard, the same goes for doormats, pot plants and anything else that burns.',
  },
  {
    text: 'Put together a fire-ready kit: water, medications, a torch and a battery radio.',
    context: 'A charged phone can stand in for the radio. Add anything you cannot do without for a day, such as glasses or hearing aid batteries.',
  },
  {
    text: 'Decide now what you would take, such as identity documents, medicines and phone chargers.',
    context: 'Photograph the documents onto your phone as well, in case the originals are out of reach.',
  },
  {
    text: 'Plan how you would move pets, horses and other animals, and where they would go.',
    context: 'With no animals of your own, ask a neighbour who has them whether they have a plan.',
  },
  {
    text: 'Talk the plan through with everyone in the house before the fire season starts.',
    context: 'Include anyone who visits or cares for you regularly, and the neighbours you would check on.',
  },
  {
    text: 'Read the support programs saved in your pack, so the names are familiar later.',
    context: 'Open Recover from the bottom bar. Every program shows who runs it and when it was captured, and it opens with no signal.',
    source: PREPARATION_SOURCE_RECOVERY,
  },
  {
    text: 'Save the programs that fit your household, so they list first when you need them.',
    context: 'Tap Save on a program in Recover. Only the program is remembered, on this phone, and nothing about you.',
    source: PREPARATION_SOURCE_RECOVERY,
  },
];

/** Attribution, not citation: the lines above are Cooeee's own wording of
 *  Country Fire Authority plan-and-prepare guidance, so the byline credits the
 *  guidance rather than quoting it. Nothing here is ever shown in quotes. */
export const PREPARATION_SOURCE = 'Country Fire Authority guidance';
/** The ring beside the source: the line for a reader the first was not written for. */
export const PREPARATION_MORE = 'If this does not fit you';

/** The pack card's footer line. Appended to the card's own age wording rather
 *  than written into it: the age is a fact about the pack, and this is a fact
 *  about the pack's whole point — it is on the device, so it opens with the
 *  radios off. It states what the pack does, never what it protects you from. */

/** Under the hold control only while nothing is saved: the mode is reachable
 *  with no pack, which is the one thing a new user would not expect. */
export const BLACKSKY_WORKS_WITHOUT_PACK = 'No pack needed';

/** The About page: what Cooeee is, why, what it does and does not do, and
 *  where the information stays, each a glyph, a heading and one line. No
 *  colon, semicolon or dash anywhere. */
export const ABOUT_COOEEE = 'About Cooeee';
export const COOEEE_INFO_LINES = [
  { glyph: 'what', title: 'What it is', text: 'Official bushfire information for your places, kept on your phone.' },
  { glyph: 'why', title: 'Why it exists', text: 'In a fire, the power and the signal often go first.' },
  { glyph: 'does', title: 'What it does', text: 'Build packs, find official places, and hold for BlackSky when nothing else works.' },
  { glyph: 'not', title: 'What it does not do', text: 'It does not watch conditions or contact you. VicEmergency tells you when to act.' },
  { glyph: 'stays', title: 'Where your information stays', text: 'Your address stays on this phone. Cooeee runs no server that could keep it.' },
] as const;

// ── The guided tour ─────────────────────────────────────────────────────────
// One overlay, a stop per feature across every screen. The path is the screen
// the stop lives on; the target is what the spotlight surrounds.
export const TOUR_KICKER = 'Tour';
export const TOUR_HINT = 'Take the tour';
export const TOUR_BACK = 'Back';
export const TOUR_NEXT = 'Next';
export const TOUR_FINISH = 'Finish';
export const SKIP_TOUR = 'Skip tour';
/** One glyph and one line per stop, 12 words at most (tests hold the limit). */
export const TOUR_STEPS = [
  { path: '/', target: '.preparation', glyph: 'clock', title: "Today's reminder", line: 'One small preparation step a day, from Country Fire Authority guidance.' },
  { path: '/', target: '.home .card', glyph: 'layer', title: 'Your saved packs', line: 'Each card is a place, ready with no signal. Tap to open.' },
  { path: '/', target: '.home .main-action', glyph: 'plus', title: 'New offline pack', line: 'Add a pack for home, work, school or family.' },
  { path: '/', target: '.blacksky-hold-row', glyph: 'moon', title: 'Hold for BlackSky', line: 'Hold two seconds. Points to official places when the signal is gone.' },
  { path: '/', target: '.app-header-inner', glyph: 'clock', title: 'The header', line: "Tap Cooeee to go home. The pill shows your oldest pack's age." },
  { path: '/', target: '.bottom-nav-inner', glyph: 'all', title: 'The bottom bar', line: 'Every screen, one thumb away. BlackSky opens only by holding.' },
  { path: '/packs/new', target: '.search-form', glyph: 'found', title: 'The address search', line: 'Type a Victorian street address, then pick yours from the list.' },
  { path: '/nearby', target: '.nearby .hero', glyph: 'place', title: 'Nearby official places', line: 'Official places near you, by distance. Not a ranking.' },
  { path: '/rehearse', target: '.rehearsal-entry, .rehearsal-condition', glyph: 'rehearse', title: 'Rehearse', line: 'Practise the way to a saved place on a calm day.' },
  { path: '/recover', target: '.recover', glyph: 'kept', title: 'Recover', line: 'Say what you need and see support that may match.' },
  { path: '/about', target: '.about .card', glyph: 'what', title: 'About Cooeee', line: 'What Cooeee does, and what it does not do.' },
] as const;

/** The information ring beside the hold control, and the panel a tap on it
 *  opens: what BlackSky does, each line led by its glyph. */
export const ABOUT_BLACKSKY = 'About BlackSky';
export const BLACKSKY_INFO_LINES = [
  { glyph: 'go', text: 'Points to the nearest official places of last resort.' },
  { glyph: 'offline', text: 'Works with no signal. Your pack is already on this phone.' },
  { glyph: 'moon', text: 'Black and amber spare the battery and your night vision.' },
  { glyph: 'clock', text: 'Hold two seconds to enter or leave. A tap does nothing.' },
] as const;

// ── Welcome, before the disclosure ───────────────────────────────────────────
// Why the app is worth having, in three drawings and as few words as carry
// them. The glyphs are the ones the rest of the app already draws for the same
// ideas, so nothing here has to be learnt twice.

export const WELCOME_STEPS = [
  { glyph: 'layer', kicker: 'Before', line: 'Build a pack while you have signal.' },
  { glyph: 'go', kicker: 'During', line: 'BlackSky points the way with none.' },
  { glyph: 'kept', kicker: 'After', line: 'Find official support in plain words.' },
] as const;
export const WELCOME_FACTS = [
  { glyph: 'stays', line: 'Opens with no signal.' },
  { glyph: 'not', line: 'Nothing leaves your phone.' },
] as const;
export const SEE_HOW_IT_WORKS = 'See how it works';

// ── E1-US1-AC0 first open: understand what Cooeee is before using it ────────
// The four statements are the screen. They are literal on-screen text, never
// behind a link or an accordion, and each one is asserted by exact match in
// tests/core/copy.test.ts.

export const FIRST_OPEN_PURPOSE =
  'Get one address ready now, for bushfire information that still opens when the signal drops.';

export const DISCLOSURE_DOES_HEADING = 'What Cooeee does';
export const DISCLOSURE_DOES =
  'Saves preparation packs for the addresses you choose, on this phone. They open with no signal.';

export const DISCLOSURE_DOES_NOT_HEADING = 'What Cooeee does not do';
export const DISCLOSURE_DOES_NOT =
  'Does not watch conditions, and will never contact you. Nothing here tells you when to act.';

export const DISCLOSURE_ADDRESS_HEADING = 'Where your address goes';
export const DISCLOSURE_ADDRESS =
  'On this phone once saved. Checking your address uses Victorian Government data, and we run no server that could hold it.';

export const DISCLOSURE_POSITION_HEADING = 'When Cooeee asks for your position';
export const DISCLOSURE_POSITION =
  'Only asked inside BlackSky, the offline screen that points to your saved places. Stays on this device. You can refuse, and everything else still works.';

/** The quieter line under the four statements: who to go to for what Cooeee
 *  itself will never provide. */
export const OFFICIAL_CHANNELS_LINE =
  'During an incident, official updates come from VicEmergency. In an emergency, call Triple Zero (000).';

export const ACKNOWLEDGE_CHECKBOX =
  'I understand how Cooeee works, and what it does not do.';
export const CONTINUE = 'Continue';
export const BEFORE_YOU_CONTINUE = 'Before you continue';
export const ACKNOWLEDGE_HINT = 'Tick the box above to continue.';

// ── Development gate (feature 1) ────────────────────────────────────────────
export const GATE_TITLE = 'Password';
export const GATE_LINE = 'Cooeee is in development. Enter the password to continue.';
export const GATE_SUBMIT = 'Enter';
export const GATE_INCORRECT = (left: number) =>
  `Incorrect password. ${left} ${left === 1 ? 'try' : 'tries'} left.`;
export const GATE_LOCKED = (seconds: number) => `Try again in ${seconds} seconds.`;
export const GATE_OFFLINE = 'A connection is needed to check the password.';
export const GATE_UNAVAILABLE = 'The password cannot be checked right now.';

// ── Nearby places: the nearest official place of each kind ──────────────────
// Every row carries its own state (live / cached / unavailable) and its own
// timestamp; the page as a whole is never labelled current.

export const NAV_NEARBY = 'Nearby';
export const NEARBY_KICKER = 'Nearby places';
export const NEARBY_TITLE = 'Nearest official places';
export const ABOUT_GROUP = (group: string) => `About ${group}`;

export const USE_MY_LOCATION = 'Use my location';
export const LOCATING = 'Reading your position…';
export const LOCATION_FAILED = 'Your position could not be read. Enter a postcode instead.';
export const POSTCODE_LABEL = 'Type a postcode';
export const FIND_POSTCODE = 'Find';
export const POSTCODE_INVALID = 'Enter a four-digit postcode.';
export const POSTCODE_UNKNOWN = (postcode: string) =>
  `Postcode ${postcode} is not in the downloaded Victorian list.`;
export const FROM_POSITION = (accuracy: string) => `From your position, ${accuracy}`;
/** Followed on screen by the postcode itself, in the accent. */
export const FROM_POSTCODE = 'From the centre of postcode';
/** UAT: people could not tell how distances were worked out, so every screen
 *  that shows one says it is measured in a straight line. */
export const DISTANCES_NOTE = 'Straight-line distances, not by road.';
export const NOT_A_RANKING = 'Not a ranking.';
/** UAT: the words a person must not miss, coloured wherever they appear in a
 *  line passed through KeyTerms. Plain words only: they are joined into a regex. */
export const KEY_TERMS = ['Bushfire Prone Area', 'Fire can still reach you', 'no password', 'not by road'] as const;

export const DOWNLOADING_PLACES = 'Downloading the official places…';
export const FIRST_RUN_TITLE = 'Nothing downloaded yet';
export const FIRST_RUN_LINE = 'Connect once to download. Then it opens with no signal.';

export const GROUP_BUSHFIRE = 'Bushfire places of last resort';
export const GROUP_BUSHFIRE_NOTE = 'Designated by the Country Fire Authority for their own township. Bushfire only.';
export const GROUP_RELIEF = 'Relief and recovery';
/** The two tabs over the Nearby groups, short enough to sit side by side. */
export const TAB_BUSHFIRE = 'Bushfire places';
export const TAB_RELIEF = 'Relief centres';
export const NEARBY_TABS_LABEL = 'Kind of place';
export const GROUP_RELIEF_NOTE = 'Opened for one incident, and listed by VicEmergency only while it runs.';

export const FACILITY_TYPE_NAME: Record<FacilityType, string> = {
  NSP: 'Neighbourhood Safer Place',
  CFR: 'Community Fire Refuge',
  ERC: 'Emergency Relief Centre',
  RELIEF: 'Relief Centre',
  RECOVERY: 'Recovery Centre',
  ASSEMBLY: 'Assembly Area',
};

/** UAT: "Live" was read as the centre being open. The label is about the
 *  information, so it says when it was updated. */
export const STATE_LIVE = 'Updated just now';
export const STATE_CACHED = (age: string) => `Cached · ${age}`;
export const STATE_UNAVAILABLE = 'Unavailable';
export const JUST_NOW = 'just now';
export const MINUTES_AGO = (minutes: number) => `${minutes} min ago`;
export const HOURS_AGO = (hours: number) => `${hours} h ago`;
export const NEVER = 'never';

export const VERIFIED_ON = (date: string) => `Verified ${date}`;
export const SAVED_LINE = (date: string) => `Saved ${date}`;
export const AS_OF = (time: string) => `As of ${time}`;

export const NONE_IN_LIST = (kind: string) => `No ${kind} is in the downloaded list.`;
export const NONE_LISTED_OPEN = (kind: string) => `No ${kind} is listed as open by VicEmergency.`;
export const NOT_DOWNLOADED_YET = (kind: string) => `${kind} information has not been downloaded yet.`;
export const MAY_BE_OUTDATED = 'May be outdated. Check by radio or the hotline.';
export const TOO_OLD_TO_SHOW = 'Over an hour old, so no place is shown.';
export const SOURCE_UNCONFIRMED = (source: string) => `The ${source} was not reachable lately, so this is unconfirmed.`;
export const SOURCE_NOT_READ = (source: string) => `The ${source} has not been read yet, so nothing is confirmed.`;
export const NEEDS_REVIEW_NOTE = 'Missing from the latest Country Fire Authority list. Check before relying on it.';

export const DATA_SOURCES_LABEL = 'Data sources';
export const SOURCE_NAMES: Record<string, string> = {
  cfa_nsp_arcgis: 'Country Fire Authority Neighbourhood Safer Places list',
  cfr_static_list: 'Community Fire Refuge list',
  vicmap_admin_postcodes: 'Vicmap postcode list',
  vicemergency_feed: 'VicEmergency feed',
};
export const SOURCE_STATUS_WORD: Record<SourceStatus, string> = {
  healthy: 'reachable',
  degraded: 'struggling',
  down: 'unreachable',
  unknown: 'not yet read',
};
export const ABOUT_DATA_SOURCES = 'About the data sources';
export const HEALTH_TEXT = (status: string, when: string) =>
  `${status[0].toUpperCase()}${status.slice(1)} when last checked, ${when}.`;

// ── E5-US1-AC4 the rehearsal entry gate ───────────────────────────────────
// Four states, four screens. Each names what is missing from the PACK. None of
// them says anything about the reader: a pack that is not finished is a
// statement about a download, not about the person holding the phone.

export const REHEARSAL_LABEL = 'Rehearsal';
export const REHEARSE_THIS_PACK = 'Rehearse this pack';

// ── E5-US5 the rehearsal history on the pack page ─────────────────────────
// A list in time order, in the result's own words. A count of gaps is a
// count, never a score: nothing here totals, grades or ranks a rehearsal.
export const REHEARSALS = 'Rehearsals';
export const NOT_YET_REHEARSED = 'Not yet rehearsed.';
export const HISTORY_GAPS = (count: number) =>
  count === 0 ? 'No gaps found' : count === 1 ? '1 gap found' : `${count} gaps found`;
/** E5-US3-AC2 — asked when the bar's Rehearse is tapped and several packs are
 *  saved. Same question form as CHOOSE_CONDITION_HEADING. */
export const CHOOSE_PACK_TO_REHEARSE = 'Which pack are we rehearsing?';
export const CHOOSE_PACK_TO_REHEARSE_DETAIL = 'One rehearsal, one pack.';
/** The way back to the pack the user came from, offered only where there is a
 *  readable pack to go back to. */
export const BACK_TO_THIS_PACK = 'Back to this pack';

// The pack exists and its build never finished.
export const PACK_NOT_FINISHED = 'This pack was not finished';
/** Defensive at zero rather than trusting every caller to have checked. The
 *  gate only reaches this state with at least one unfinished build, but a
 *  sentence beginning "0 packs" is the kind of line that reaches a screen once
 *  a later caller forgets, so the singular wording covers it instead. */
export const PACK_NOT_FINISHED_DETAIL = (count: number) =>
  count > 1
    ? `${count} pack builds did not finish, so nothing was stored for them.`
    : 'A pack build did not finish, so nothing was stored for it.';
/** [DRAFT] pending Sharon's copy review. This is the only line across the four
 *  stopped states that tells the reader to do something rather than stating a
 *  fact about the pack, and it is the only one whose sentence does not use the
 *  action's own words the way the unreadable state's does. Shipped as-is. */
export const PACK_NOT_FINISHED_NEXT = 'Build it again with a connection to rehearse it.';

// The pack is finished and readable, and holds nothing a rehearsal runs from.
export const NOTHING_TO_REHEARSE = 'This pack holds nothing to rehearse';
/** Names no single hazard. One pack carries more than one, so a sentence that
 *  named bushfire alone would be wrong for the rest of what the pack holds. */
export const NOTHING_TO_REHEARSE_DETAIL = (name: string, savedOn: string) =>
  `${name}, saved ${savedOn}, has no area designation and no official place.`;
export const NOTHING_TO_REHEARSE_NEXT = 'A rehearsal needs one of them. Build the pack again once official information covers this address.';

// The pack could not be read back from the device.
export const PACK_COULD_NOT_BE_READ = 'This pack could not be read';
export const UNREADABLE_PART_NAMES: Record<string, string> = {
  'stored-items': 'the stored information items',
  'saved-places': 'the saved places',
  'the-whole-pack': 'the whole pack',
};
/** Joins the named parts into one readable phrase. */
export const AND_LIST = (items: string[]): string =>
  items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
export const PACK_COULD_NOT_BE_READ_DETAIL = (parts: string) =>
  `In this pack, ${parts} did not match what was saved, so they were not used.`;
export const PACK_STORE_UNREADABLE_DETAIL = 'The packs on this phone could not be opened.';
/** Says what would restore the pack in the words the action itself uses. It
 *  does NOT say "build this pack again": the build flow starts from an address
 *  search and does not carry this pack's address into it, so a sentence or a
 *  button promising to rebuild THIS pack would be a promise the next screen
 *  breaks. */
export const PACK_COULD_NOT_BE_READ_NEXT = 'A new pack for this address would restore it.';

// Nothing is stored at all.
export const NO_PACK_TO_REHEARSE = 'No pack saved yet';
export const NO_PACK_ELSEWHERE = 'That pack is not on this phone';
export const NO_PACK_TO_REHEARSE_DETAIL = 'A rehearsal runs from a saved pack.';
/** Defensive at zero for the same reason: the screen only asks for this line
 *  when another pack is saved, and "0 other packs are saved here" would be a
 *  false statement if that ever stopped being true. */
export const NO_PACK_OTHERS_DETAIL = (count: number) =>
  count > 1
    ? `${count} other packs are saved. Open one from Home.`
    : 'One other pack is saved. Open it from Home.';


// ── E5-US1-AC1 the disruption a rehearsal runs under ──────────────────────
// Two conditions, the same two whatever the pack holds. Written as the reader
// would say them, not as the state a developer would name: what is missing,
// then what that means when it is.

/** [DRAFT] pending Sharon's copy review (task UX-1 on the E5-US1-AC1 card).
 *  Two things are hers to settle and are shipped as defaults meanwhile: the
 *  question form, where EPIC 1's own list instructs instead ("Choose your
 *  address from the list."), which is likely why a list under a question reads
 *  less like something to choose from; and the "we", which is the only place in
 *  the product where the app speaks of itself in the first person. */
export const CHOOSE_CONDITION_HEADING = 'Rehearse without…';
export const CONDITION_NO_DATA = 'No mobile data';
export const CONDITION_NO_DATA_DETAIL = 'Only what is saved on the phone works.';
export const CONDITION_NO_FIX = 'No location fix';
/** Says what the phone cannot do, without naming the thing it would otherwise
 *  give you: the obvious phrasing uses words the wording scan forbids, and the
 *  plainer sentence is the better one anyway. */
export const CONDITION_NO_FIX_DETAIL = 'The phone cannot tell where it is.';
/** [DRAFT] pending Sharon's copy review. Each condition as it reads after the
 *  word "without". The row titles above answer "What are we rehearsing
 *  without?", so they already carry the "No". A sentence that put "without" in
 *  front of a title would say the opposite of what happened: "Rehearsed without
 *  No location fix" reads as a rehearsal that had one. */
export const CONDITION_NO_DATA_WITHOUT = 'mobile data';
export const CONDITION_NO_FIX_WITHOUT = 'a location fix';
// ── E5-US1-AC2 a rehearsal is never mistaken for the real thing ───────────
// The bar carries the word and the condition, on every screen of a run. Both
// are words: a colour or an icon says nothing in greyscale, and nothing at all
// to a reader who cannot see it.

/** Said once, plainly, on the run itself. [DRAFT] pending Sharon's copy review:
 *  the criterion forbids any wording implying something WAS sent, and says
 *  nothing about stating the opposite. Shipped as a default because a rehearsal
 *  of an emergency is exactly where a reader would wonder, and silence answers
 *  them less well than a sentence does. */
/** Ends the run. Leaving is the only way out, and it is always available. */
export const LEAVE_REHEARSAL = 'Leave the rehearsal';

// ── E5-US2-AC1 what a rehearsal found ─────────────────────────────────────
// A gap is a capability the reader could not rely on under the condition they
// chose. Nothing here counts, totals, scores or grades, and nothing here says
// anything about the reader: the pack is short of something, or the condition
// takes something away, and both are facts about the phone.

export const RESULT_HEADING = 'What this rehearsal found';
/** Takes the condition's without-form (conditionWithout), never its row title. */
export const RESULT_CONDITION_LINE = (without: string) => `Rehearsed without ${without}.`;
/** The hazard a gap belongs to, since one pack holds more than one. Total over
 *  the two rehearsable hazards, so no caller needs a fallback. */
export const HAZARD_NAME: Record<'bushfire' | 'heat', string> = {
  bushfire: 'Bushfire',
  heat: 'Extreme heat',
};
export const GAP_HAZARD_LINE = (hazard: string) => `${hazard} journey`;

// The two kinds, told apart by these words and by nothing else.
export const GAP_MEANING_PACK_CONTENT = 'Missing from your pack.';
/** The condition sentence in its two halves. The wording is unchanged and the
 *  joined sentence is byte-identical, so the result reads exactly as it did. */
export const GAP_MEANING_CONDITION_FACT = 'Not available under this condition.';
export const GAP_MEANING_CONDITION_NEXT = 'Do this instead.';
export const GAP_MEANING_CONDITION = `${GAP_MEANING_CONDITION_FACT} ${GAP_MEANING_CONDITION_NEXT}`;

// What could not be relied on.
export const GAP_DESIGNATION = 'The official area designation for this address';
export const GAP_PLACES = 'The official places saved with this pack';
export const GAP_PROVENANCE = 'The publisher and saved date on every stored item';
export const GAP_LIVE_DIRECTION = 'Live direction and distance to your saved places';

// UAT: a gap was named but not explained. Why each one was found, in one line.
export const GAP_REASON_LABEL = 'Why';
export const GAP_REASON_DESIGNATION = 'This pack holds no answer from the official map for this address.';
export const GAP_REASON_PLACES = 'No official place of last resort was saved with this pack.';
export const GAP_REASON_PROVENANCE = 'Some saved items do not show who published them or when.';
export const GAP_REASON_LIVE_DIRECTION = 'Without a location fix the phone cannot point the way or say how far.';

/** Behind the information ring on every row of the rehearsal list: what a gap
 *  is, then each gap that rehearsal found with its reason and action, or what
 *  was checked when it found none. A count, never a mark. */
export const ABOUT_GAPS = 'About gaps';
export const GAP_WHAT_IS = {
  lead: 'What a gap is.',
  text: 'One thing the rehearsal looked for and could not rely on that day, either because it was not in the pack or because the condition took it away.',
};
export const GAP_NONE_FOUND = {
  lead: 'None found.',
  text: `Everything the rehearsal looked for was on the phone that day. ${GAP_DESIGNATION}. ${GAP_PLACES}. ${GAP_PROVENANCE}. ${GAP_LIVE_DIRECTION}.`,
};
export const GAP_IS_A_COUNT = {
  lead: 'It is a count.',
  text: 'A number of things you can act on. Nothing here is a mark and nothing is ranked.',
};

// The one action for each. None of them says the capability has come back.
export const ACTION_BUILD_AGAIN_DESIGNATION = 'Build this pack again online to store the official area designation.';
export const ACTION_BUILD_AGAIN_PLACES = 'Build this pack again online to store the official places.';
export const ACTION_BUILD_AGAIN_PROVENANCE = 'Build this pack again online so every item has its publisher and date.';
/** Says what to do instead, and does not pretend the phone will find the way. */
export const ACTION_WRITE_THE_WAY_DOWN = 'Write down the way from your door to each saved place. Keep it with your kit.';

export const ACTION_LABEL = 'What to do';

/** A rehearsal that found nothing to act on. It says what was checked and what
 *  held. It does NOT say the reader is prepared, and it never will.
 *  [DRAFT] pending Sharon's copy review. Reachable only after a no-data run on a
 *  complete pack: under no location fix the contingency gap always fires. */
export const NO_GAPS_HEADING = 'Nothing was missing in this rehearsal';
/** Takes the condition's without-form (conditionWithout), never its row title. */
export const NO_GAPS_DETAIL = (without: string) =>
  `Everything checked was on the phone without ${without}. Checked on this pack today.`;

// ── E5-US2-AC1 the reader's own record of what they have done ─────────────
// [DRAFT] pending Sharon's copy review, all four.

export const MARK_ACTION_DONE = 'Mark this done';
/** Attributes the fact to the READER, not to the world. "Done" alone would read,
 *  on a gap the condition takes away, as the capability having come back. */
export const ACTION_DONE_ON = (date: string) => `You marked this done ${date}`;
/** The same control, tapped again. A reader correcting their own record. */
export const UNDO_ACTION_DONE = 'I have not done this';

/** Rule 0.1: "we could not keep this" and "this did not happen" are different
 *  statements. The rehearsal ran and its result is on screen; what failed is the
 *  keeping of it, and that is what is said. */
export const RUN_NOT_KEPT = 'Not kept on this phone. What it found is here now, but not later.';
/** No date is ever shown for a completion that did not store: a date would be
 *  the product asserting a record it does not hold. */
export const ACTION_NOT_KEPT = 'Not kept on this phone. Mark it again next time.';

// ── E5-US2-AC2/AC3/AC4 what has moved since the last rehearsal ────────────
// Words, never a figure. The three groups below are told apart by their
// headings, not by a colour, a dot or a badge: strip every colour out and the
// screen still says which list is which [WCAG 1.4.1]. All [DRAFT] for Sharon.

export const PROGRESS_HEADING = 'Since your last rehearsal like this';
export const EARLIER_REHEARSAL_ON = (date: string) => `Compared with ${date}`;
export const GROUP_NEWLY_DETECTED = 'Not found last time';
export const GROUP_STILL_OPEN = 'Still to do';
export const GROUP_DONE_SINCE = 'You have done since then';

/** AC3. A first rehearsal is a whole result. This says what is not there yet,
 *  and does not frame the run as incomplete or as a starting score. */
export const FIRST_REHEARSAL_HEADING = 'Your first rehearsal like this';
export const FIRST_REHEARSAL_DETAIL = 'Nothing earlier to compare with yet.';

/** AC4. States that the PACK changed, and keeps that separate from anything the
 *  reader did. Nothing here attributes the difference to them. */
export const PACK_CHANGED_ON = (date: string) =>
  `You rebuilt this pack on ${date}, so some changes come from the new pack, not only from you.`;
/** The honest third answer. Not a softer way of saying nothing changed. */
export const PACK_CHANGE_UNKNOWN = 'Whether the pack changed between them was not recorded.';

// ── E5-US1-AC5 the journey: a trip to know the way ────────────────────────
// The rehearsal is the journey itself. These words ask her to go to one of the
// official places saved with this pack, in calm conditions, with BlackSky open,
// and say what that is for: knowing the way. On the day she may go by car, so
// nothing here says on foot or walking. None of them treats a place as where
// she plans to go on the day, and none of them rates the trip:
// no time to beat, no fast or slow, nothing to pass. The place list reuses
// GAP_PLACES as its heading and GAP_MEANING_PACK_CONTENT when there is none; the
// hold reuses HOLD_FOR_BLACKSKY and HOLD_TO_ENTER; the day's priority reuses
// OFFICIAL_INSTRUCTIONS_FIRST. All new strings below are [DRAFT] pending
// Sharon's copy review.

/** [DRAFT] Before she goes. */
export const JOURNEY_BEFORE_HEADING = 'Rehearse the way there';
/** [DRAFT] Takes the condition's without-form (conditionWithout). */
export const JOURNEY_CONDITION_LINE = (without: string) => `This rehearsal is without ${without}.`;
// E5-US6 — make the condition real on the phone. One instruction per
// condition, in the phone's own words, and a plain statement of what the
// browser reports while she is out. Reported state only: the app cannot see
// phone signal, and the line never blocks, times or judges anything.
export const MAKE_IT_REAL = 'Make it real';
export const CONDITION_HOW_TO: Record<'no-data' | 'no-location-fix', string> = {
  'no-data': 'Turn on aeroplane mode and turn Wi-Fi off.',
  'no-location-fix': 'Turn location off in the phone settings.',
};
export const PHONE_IS_OFFLINE = 'Offline now, as on the day.';
// E5-US7 — the pack's notes on the journey, as BlackSky shows them on the day.
export const NO_NOTES_ON_JOURNEY = 'No notes in this pack.';
export const PHONE_STILL_ONLINE = 'Still online. Turn on aeroplane mode.';

/** [DRAFT] What a rehearsal is. */
export const JOURNEY_WHAT_IT_IS = 'A calm-day trip to a saved official place, with BlackSky open.';
export const ABOUT_REHEARSAL = 'What a rehearsal is';
/** [DRAFT] What it is for, and what it is not. */
export const JOURNEY_WHAT_IT_IS_FOR = 'Practice at knowing the way, how long it takes and which turns you take.';
/** [DRAFT] The one control before she goes. It is the commitment. */
export const I_AM_GOING_NOW = "I'm going now";
/** [DRAFT] While she is out. */
export const JOURNEY_RUNNING_HEADING = 'Practising the way';
/** [DRAFT] What to do while she is out. */
export const JOURNEY_RUNNING_DETAIL = 'Go with BlackSky open. Come back here to say how it ended.';
/** [DRAFT] The two endings on the journey screen, as the criterion names them. */
export const JOURNEY_ENDINGS_LABEL = 'When you are done';
export const ENDING_ARRIVED = 'I have arrived';
export const ENDING_WITHOUT_GOING = 'End without going';

// ── E5-US1-AC5 a started rehearsal is kept, and only she says how it ended ──
// A rehearsal started and never given an ending is asked about, never guessed
// at. None of these words says it was interrupted, abandoned, missed or left
// short: the app does not know, which is why it asks.

/** [DRAFT] pending Sharon's copy review. Asked on returning to a rehearsal that
 *  was started and has no ending. */
export const UNFINISHED_HEADING = 'How did this rehearsal end?';
/** [DRAFT] pending Sharon's copy review. Takes the condition's without-form
 *  (conditionWithout), never its row title. */
export const UNFINISHED_DETAIL = (without: string, date: string) =>
  `Started ${date}, without ${without}. Only you can say how it ended.`;
/** [DRAFT] pending Sharon's copy review. The two endings, as the criterion names
 *  them, each with what it means in her words. */
export const ENDING_WALKED = 'I went there';
export const ENDING_WALKED_DETAIL = 'I went to the place.';
export const ENDING_DRY_RUN = 'I did not go, a dry run';
export const ENDING_DRY_RUN_DETAIL = 'I ended it without going.';
/** [DRAFT] pending Sharon's copy review. A rehearsal recorded before the endings
 *  existed, in the shape PACK_CHANGE_UNKNOWN uses: not knowing is its own state,
 *  and never a default to either ending. */
export const ENDING_NOT_RECORDED = 'Whether you went there was not recorded.';

// ── E5-US1-AC5 the result says how the rehearsal ended ────────────────────
// Beside the condition line, a fact about this rehearsal. Her time is shown in
// whole minutes, never seconds, with nothing to measure it against: no target,
// no fast or slow, no best. A dry run is stated as the kind of rehearsal it is.
// A rehearsal with no ending recorded is stated by ENDING_NOT_RECORDED above.

/** [DRAFT] pending Sharon's copy review. A walked rehearsal, and how long it took her. */
export const RESULT_WALKED = (duration: string) => `You went there. It took you ${duration}.`;
/** [DRAFT] pending Sharon's copy review. A walked rehearsal whose time was not
 *  kept with it. Every walk ended on the journey screen keeps one; this covers a
 *  stored record that does not. */
export const RESULT_WALKED_NO_TIME = 'You went there.';
/** [DRAFT] pending Sharon's copy review. A dry run, stated plainly, as a kind of
 *  rehearsal and not a lesser one. */
export const RESULT_DRY_RUN = 'A dry run. You ended it without going.';
/** [DRAFT] pending Sharon's copy review. Her time, in whole minutes. */
export const DURATION_UNDER_A_MINUTE = 'less than a minute';
export const DURATION_MINUTES = (minutes: number) => (minutes === 1 ? '1 minute' : `${minutes} minutes`);

// ── E5-US1-AC5 her note about the way ─────────────────────────────────────
// Offered on the result after a walked rehearsal only, and never required. It
// is saved as an ordinary note in this pack, under the same rule as every note,
// so BlackSky reads it back without a connection. Saving reuses SAVE_NOTE,
// NOTE_SAVED, NOTE_EMPTY and NOTE_CHANGE_FAILED. All [DRAFT] pending Sharon's
// copy review.

/** [DRAFT] pending Sharon's copy review. */
export const WAY_NOTE_HEADING = 'What you learnt about the way';
/** [DRAFT] pending Sharon's copy review. Says it is optional, what it is for,
 *  and where it goes. */
export const WAY_NOTE_DETAIL = 'Optional. The turns, what you met, what you would change. BlackSky shows it offline.';
/** [DRAFT] pending Sharon's copy review. */
export const WAY_NOTE_LABEL = 'Your note about the way';

// ── E9 the drill ──────────────────────────────────────────────────────────
// A game played before the rehearsal. It has a clock and a score, which the
// rehearsal never has (E5-US2-AC2 keeps that rule for the rehearsal alone).
// Every number here is about the bag, never about the person.
export const DRILL_LABEL = 'Drill';
export const DRILL_INTRO_HEADING = 'One minute to leave';
export const DRILL_STAT_DETAIL =
  'This drill gives you one minute in a house. Pack ten things and be at the front door when the time ends. Then it says how ready your bag was.';
export const START_DRILL = 'Start the drill';
export const SKIP_DRILL = 'Skip the drill';
export const SKIP_CUTSCENE = 'Skip';
export const NEXT_STAGE = 'Next';
export const LEAVE_DRILL = 'Leave the drill';
export const DRILL_TILE_TITLE = 'Play the drill';
export const DRILL_TILE_DETAIL = 'One minute to pack ten things and reach the front door.';
/** The facts shown over the fire as it worsens, each with its publisher and
 *  the phrases set in the accent colour. Every
 *  line was checked against the page it is credited to (21 September 2026). */
export const DRILL_FACTS = [
  { text: 'Grassfires can travel 25 kilometres an hour. Faster than you can run.', key: ['25 kilometres an hour'], source: 'Country Fire Authority' },
  { text: 'On Black Saturday, embers lit fires more than 30 kilometres ahead.', key: ['30 kilometres'], source: 'Country Fire Authority' },
  { text: 'Within minutes of starting, the Kilmore East fire could not be contained.', key: ['Within minutes'], source: '2009 Victorian Bushfires Royal Commission' },
  { text: 'A wind change turned its side into a front 50 kilometres wide.', key: ['50 kilometres wide'], source: 'Country Fire Authority' },
  { text: 'Black Saturday, 7 February 2009, took 173 lives.', key: ['7 February 2009', '173 lives'], source: '2009 Victorian Bushfires Royal Commission' },
];
/** The line once the film cuts inside the house, with the lights still on. */
export const DRILL_INSIDE_LINE = { text: 'Inside, the news is on. The light at the window turns orange.', key: ['turns orange'] };
/** The instructions, shown while the camera tours the dark house. */
export const DRILL_TOUR_LINES = [
  { text: 'The power is out. You have one minute.', key: ['one minute'] },
  { text: 'Find and pack ten things. Each one is outlined in yellow.', key: ['ten things', 'yellow'] },
  { text: 'Then get out the front door before the minute is up.', key: ['front door'] },
];
/** The last line, over the person, just before the clock starts. */
export const DRILL_READY = 'Get ready.';
export const EXIT_LABEL = 'EXIT';
export const CUTSCENE_LABEL = 'A home among gum trees as a bushfire arrives and grows, then a tour of every room inside it.';
export const DRILL_SCENE_LABEL = 'A house seen from above, with the person you are steering.';
export const DRILL_HINT = 'Be at the front door when the time ends.';
export const BAG_COUNT = (count: number, limit: number) => `Bag ${count} of ${limit}`;
export const PACK_ITEM = (name: string) => `Pack the ${name}`;
export const BAG_FULL = 'Bag full';
export const SECONDS_LEFT = (seconds: number) => `${seconds} seconds left`;
export const IN_ROOM = (room: string) => `In the ${room}`;
export const SOUND = 'Sound';
export const SOUND_ON = 'Sound on';
export const SOUND_OFF = 'Sound off';
export const STICK_LABEL = 'Move. Drag here, or use the arrow keys.';
export const DEBRIEF_SCORE = (score: number) => `${score} out of 100`;
export const OVER_HEADING = 'The minute ended away from the door';
export const OVER_DETAIL = 'Nothing counts if you are still inside.';
export const DRILL_SOURCE =
  'The points follow what the Country Fire Authority says to take with you, from its Fire Ready Kit.';
/** The debrief's word for a score, beside the ring. */
export const VERDICT = (score: number) => (score >= 80 ? 'Well packed' : score >= 50 ? 'Partly packed' : 'Poorly packed');
/** The four kinds of thing, as the debrief's colour key names them. */
export const KIND_LABELS = { essential: 'Essential', listed: 'Useful', neutral: 'No effect', bulky: 'Cost you' };
export const IN_YOUR_BAG = 'In your bag';
export const LEFT_BEHIND = 'Left behind';
export const OF_LIMIT = (count: number, limit: number) => `${count} of ${limit}`;
export const TAP_FOR_WHY = 'Tap a thing to see why.';
export const SIGNED_POINTS = (points: number) => (points > 0 ? `+${points}` : points < 0 ? `\u2212${-points}` : '0');
export const TILE_LABEL = (name: string, points: string) => `${name}, ${points}`;
export const HIGHEST_SO_FAR = (score: number) => `Your highest so far is ${score} out of 100.`;
export const PLAY_AGAIN = 'Play again';
export const GO_ON_TO_REHEARSAL = 'Go on to the rehearsal';
export const DRILL_UNAVAILABLE = 'This browser could not load the drill pictures, so the rehearsal opens instead.';
export const DRILLS = 'Drills';
export const NOT_YET_DRILLED = 'Not yet drilled.';
export const DRILL_ROW_DOOR = (score: number) => `At the door, ${score} out of 100`;
export const DRILL_ROW_AWAY = 'Away from the door when the minute ended';
export const DRILL_ROW_PACKED = (count: number) =>
  count === 1 ? '1 thing packed' : `${count} things packed`;
