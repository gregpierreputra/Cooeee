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

export const NO_ADDRESS_MATCH =
  'No matching address found. Check the spelling or try the nearest cross street.';

export const NO_GPS = 'No GPS fix. Showing your saved information.';

/** Said beside the arrows, never instead of them: a vague or old fix still
 *  points, with its error stated. */
export const GPS_APPROXIMATE = (m: number) =>
  `GPS is only accurate to ± ${m} m here. The direction is approximate and sharpens as the fix improves.`;
export const FIX_AGE = (s: number) => `Last GPS fix ${s} s ago. The direction may have changed.`;

/** Said of the pack that is loaded, never of every pack: another saved pack
 *  may well cover this place, and the picker says so beside it. */
export const OUTSIDE_AREAS = "You're outside this pack's area";

export const NOT_RECENTLY_VERIFIED = (days: number) =>
  `Saved ${days} days ago, not recently verified`;

// Shared vocabulary
/** The eight compass points by name, index 0 = north, one every 45 degrees.
 *  Read by core/geo.ts cardinalPoint(). Names, not letters: the point is read
 *  under the arrow at arm's length, and "NE" is an abbreviation. */
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
export const ONLINE_NOTICE = 'Online. Connected to a network.';
export const OFFLINE_NOTICE = 'Offline. Saved packs still work.';
export const DISMISS_NOTICE = 'Dismiss connection notice';

export const NO_PACKS_HINT =
  'Build a pack while you have a connection, so it is on your phone when there is none.';
export const SAVED_DAYS_AGO = (days: number) => `Saved ${days} days ago`;

// Deleting a saved pack — the cross opens an in-card confirmation; nothing is
// removed until the delete answer is chosen.
export const DELETE_PACK = 'Delete this pack';
export const DELETE_PACK_QUESTION = 'Are you sure you would like to delete this offline pack?';
export const KEEP_THIS_PACK = 'Keep this pack';
export const CONFIRM_DELETE_PACK = 'Yes, delete this pack';

export const NEW_VERSION_READY =
  'A new version is ready. It is applied when you choose to reload. Nothing changes until then.';
export const RELOAD_NOW = 'Reload now';

// E1-US1-AC1 address confirmation
export const CONFIRM_ADDRESS_QUESTION = 'Is this the place you want to save?';
export const PLACE_NAME_LABEL = 'Place name';
export const SAVE_THIS_PLACE = 'Save this place';
export const SEARCH_AGAIN = 'Search again';

// E1-US1-AC2–AC4 address search
export const BUILD_A_PACK = 'Build an offline pack';
export const ADDRESS_SEARCH_TITLE = 'Search for your address';
export const ADDRESS_FIELD_LABEL = 'Address';
/** At the field itself: the street address is the point every official place
 *  of last resort is measured from, so it has to be the right one. */
export const ADDRESS_FIELD_HINT =
  'Enter the street address of the place you are preparing for. Your official places of last resort are measured from it.';
/** Said before the search, so an address with no official place close by is
 *  never a surprise at the places step. */
export const ADDRESS_SEARCH_DISCLOSURE =
  'Not every address has an official place of last resort close by. Cooeee lists the nearest places the Country Fire Authority publishes. They may be some distance away, and for some areas there may be none.';
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
  'The Designated Bushfire Prone Area is not published for this area (Department of Transport and Planning).';
export const DTP_SAVED_DATE = (date: string) =>
  `Published by the Department of Transport and Planning, saved ${date}.`;
export const OFFICIAL_INSTRUCTIONS_FIRST =
  'Follow Country Fire Authority and emergency service instructions first.';
export const AREA_CHECK_COULD_NOT_RUN =
  'We could not check the bushfire area for this address right now.';
export const AREA_NOT_SAVED =
  'Nothing has been saved. Your address is still here. Try again when you have a connection.';

// E1-US1-AC8 pack conflict: the confirmed address already has a saved pack
export const CHECKING_SAVED_PLACE = 'Checking the saved place on this device.';
export const PLACE_ALREADY_SAVED = 'You already have a pack for this address.';
export const SAVED_ADDRESS_LABEL = 'Saved address';
export const KEEP_SAVED_PACK = 'Keep the saved pack';
export const REPLACE_SAVED_PACK = 'Replace it with a new one';
export const SAVED_PLACE_CHECK_FAILED =
  'We could not check the saved place on this device.';
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
/** The copy of the source page saved inside the pack: opens with no signal. */
export const OPEN_SOURCE_FILE = 'Open original source as a file';
export const SOURCE_FILE_LINE = (date: string) =>
  `A PDF copy of the page as at ${date}, stored on this phone.`;
export const OPEN_ORIGINAL_SOURCE = 'Open original source (web)';

/** The map of the pack's area stored with it: the Department's own drawing of
 *  its designation layer, and one line on how to read the picture. */
export const AREA_MAP_LABEL = 'Map of the area';
export const AREA_MAP_ALT =
  'Map of the area around the saved place, with the Designated Bushfire Prone Area shaded';
export const AREA_MAP_LINE = (date: string) =>
  `Yellow is the Designated Bushfire Prone Area. White is outside it. The ring marks your saved place, and the picture is ${AREA_MAP_HALF_KM * 2} km across. Department of Transport and Planning Web Map Service, saved ${date}.`;
export const EXTERNAL_SOURCE_NOTICE =
  'Opening it may use your connection and leave Cooeee.';
export const CONTINUE_TO_ORIGINAL_SOURCE = 'Continue to original source (web)';
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
export const CONTINUE_TO_DATASET_PAGE = "Continue to the publisher's dataset page (web)";
export const CLOSE = 'Close';

// E1-US1-AC1/AC9 production pack-save wiring
export const PREPARING_PACK_OFFER = 'Preparing the pack offer.';
export const PACK_OFFER_FAILED = 'We could not prepare this pack right now.';
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
export const NSP_KIND_LABEL = 'Bushfire place of last resort';
export const NSP_COUNCIL_LABEL = (council: string) => `Responsible council: ${council}`;
export const NSP_LIST_AS_AT = (date: string) => `Country Fire Authority state-wide list as at ${date}`;
export const NSP_DESIGNATED_ON = (date: string) => `Designated ${date}`;
export const NSP_UNLOCATED_HEADING =
  'On the Country Fire Authority list but not located to a point on the map';
export const OFFICIAL_LIST_UNAVAILABLE =
  'The official list could not be included for this area.';
export const NSP_BUSHFIRE_ONLY =
  'Neighbourhood Safer Places are for bushfire only. None are shown for this pack.';

// ── E2-US2 choose and save two ────────────────────────────────────────────

export const SAVE_LAST_RESORT_PLACES = 'Save last-resort places';
export const CHOOSE_PLACES_HINT = (n: number) =>
  n === 1 ? 'Choose the place to save' : 'Choose two places to save';
export const TWO_PLACES_ALREADY_CHOSEN =
  'Two places are already chosen. Unchoose one to change your selection.';
export const SAVING_LAST_RESORT_PLACES = 'Saving your last-resort places.';
export const LOADING_LAST_RESORT_PLACES = 'Reading the official list of places of last resort.';
export const LAST_RESORT_PLACES_SAVED = 'Last-resort places saved';
export const LAST_RESORT_SAVE_FAILED =
  'Your places were not saved. Your selection is still here. Try again.';

/** The mandated absence line, plus the area it applies to. */
export const NO_DESTINATION_PUBLISHED =
  'No official place of last resort is published for this area';
export const NO_DESTINATION_PUBLISHED_FOR = (area: string) =>
  `${NO_DESTINATION_PUBLISHED}, ${area}.`;

// ── Personal note ─────────────────────────────────────────────────────────
// The user's own words, in their pack. Asked for once, after the places step;
// changed any time from the pack screen; read back in BlackSky.

export const NOTE_STEP_TITLE = 'Add a personal note';
export const NOTE_DISCLOSURE =
  'This note is stored in your offline pack on this phone. It opens without signal, in your pack and in BlackSky, when it matters most. '
  + 'It is not protected by a passcode: anyone who can unlock this phone can read it.';
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

export const EYEBROW_SET_UP_YOUR_PLACE = 'Set up your place';
export const EYEBROW_CONFIRM_ADDRESS = 'Confirm address';
export const EYEBROW_AREA_RESULT = 'Area result';
export const EYEBROW_SAVE_YOUR_PACK = 'Save your pack';
export const EYEBROW_MY_PACK = 'My pack';

// E3-US1-AC1 BlackSky prepared direction
export const BLACKSKY_TITLE = 'BlackSky';
export const HOLD_FOR_BLACKSKY = 'Hold for BlackSky';

export const ACCURACY_READOUT = (m: number) => `± ${m} m`;

// The compass. Which way the arrow is to be read depends on whether the phone's
// orientation sensor is feeding it, so the screen always says which.
export const COMPASS_LIVE = 'The arrow turns with your phone.';
export const COMPASS_NORTH_UP = 'The arrow is drawn with north at the top of the screen.';
export const TURN_ON_COMPASS = 'Turn on the compass';

/** "850 m" under a kilometre, "1.1 km" from there. The precision a person on
 *  foot can act on — never more. */
export const distanceLabel = (m: number): string =>
  m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;

// E3-US1-AC4 marked-position estimate
export const MARK_HINT =
  'If you are standing at your saved place, mark it. Bearings can be estimated from there. This is not GPS.';

export const MARK_AT_SAVED_PLACE = (address: string) => `I'm standing at ${address}`;

/** Always the word ESTIMATE, and the uncertainty stated as growing — a marked
 *  position must never read like a fix. */
export const ESTIMATE_READOUT = (m: number) =>
  `ESTIMATE from your marked position, ± ${m} m and growing`;

// E3-US2-AC1 outside the loaded pack's area
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
  'Phone calls may work if your phone shows signal. This app cannot detect phone signal.';

// E3-US2-AC2 no pack stored
export const NO_PACK_HERE = 'No saved pack covers this place.';
export const NEAREST_OFFICIAL_PLACES = 'Nearest official places of last resort';

// Several saved packs: which one to load, asked at the top of the screen.
export const CHOOSE_PACK = 'Choose a pack to load';
export const CHOOSE_PACK_HINT =
  'Its places, notes and reminder load once it is chosen. The nearest official places of last resort are pointed at from your position regardless.';
/** Beside a pack whose area contains the position the arrows are drawn from. */
export const PACK_COVERS_HERE = 'Covers where you are';
/** With several packs, none chosen and no fix: the one thing the screen can say. */
export const NO_GPS_YET = 'No GPS fix yet.';

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
export const HOLD_TO_ENTER = 'Hold to enter. Two seconds.';
export const HOLD_TO_LEAVE = 'Hold to leave. Two seconds.';
export const LEAVE_BLACKSKY = 'Leave BlackSky';
/** Said above the Leave control, never over anything else: the phone's back
 *  button was pressed, or the app opened here again because BlackSky was the
 *  last screen open. Both end with the one way out. */
export const BACK_PRESSED =
  'You pressed back. BlackSky stays until you hold Leave BlackSky for two seconds.';
export const BLACKSKY_RESUMED =
  'BlackSky was open when you last left Cooeee, so it opened again. To leave, hold Leave BlackSky for two seconds.';

// ── E1-US2-AC6 returning-user home and the fixed header ────────────────────

/** The header's age line, inside the refresh window. Deliberately different
 *  wording from the pack card's SAVED_DAYS_AGO: the card reports when the pack
 *  was written, the header reports when its contents were last checked, and one
 *  sentence must never be mistaken for the other. */
export const CHECKED_DAYS_AGO = (days: number) => `Checked ${days} days ago`;

/** The header's home control. The mark is decorative; this names it. */
export const HEADER_HOME_LABEL = 'Cooeee home';

/** The dismissed connection notice is a wordless strip, so its whole meaning
 *  has to live in its accessible name. It reports what the browser reports and nothing
 *  more — this app cannot detect phone signal, and never claims to. */
export const CONNECTION_ONLINE_LABEL = 'Connection: your browser reports a network.';
export const CONNECTION_OFFLINE_LABEL = 'Connection: your browser reports no network.';

export const NO_PACK_SAVED = 'No pack is saved on this device.';
export const SAVED_PLACE_LABEL = 'Saved place';

export const NAV_LABEL = 'Main';
export const NAV_HOME = 'Home';
export const NAV_ABOUT = 'About';
export const NAV_RECOVER = 'Recover';
export const NAV_REHEARSE = 'Rehearse';

// E4 Recover: needs-first support matching, read from the pack's dated snapshot
export const RECOVER_QUESTION = 'What do you need?';
export const RECOVER_PRIVACY_LINE =
  'Nothing you choose here leaves this phone. Only a program you keep is remembered, on this phone.';
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
export const RECOVER_ORDER_LINE = 'Listed by organisation name, in alphabetical order.';
export const RECOVER_ORDER_LINE_KEPT = 'Kept programs first, then by organisation name.';
export const EVERY_PROGRAM = 'Every program in this pack';
export const KEPT_PROGRAMS = 'Kept programs';
export const KEEP = 'Keep';
export const KEPT = 'Kept';
export const SHARE_LIST = 'Share this list';
export const COPIED_LINE = 'Copied. Paste it into a message.';
export const SHARE_UNAVAILABLE = 'Sharing is not available in this browser.';
export const SHARED_FROM = 'Shared from Cooeee. Programs change, and the organisation decides.';
export const RECOVER_STALE_LINE =
  'This information was captured more than three months ago. Programs change, so check with the organisation.';
export const LICENCE_LINE = (licence: string) => `Licence · ${licence}`;
export const CALL_LINE = (number: string) => `Call ${number}`;
export const RECOVER_NO_MATCH_TITLE = 'This pack holds nothing for that need.';
export const RECOVER_NO_MATCH_LINE =
  'That is not the same as no help existing. Try the official channel when you have a connection.';
export const OFFICIAL_CHANNEL = 'Official channel (web)';
export const CHOOSE_ANOTHER_NEED = 'Choose another need';
export const RECOVER_NONE_TITLE = 'No support information is held on this phone.';
export const SAVED_PROGRAMS = 'Saved programs';
export const STORED_INFORMATION = 'Stored information';
export const SHOW = 'Show';
export const HIDE = 'Hide';
export const SHOW_SECTION = (title: string) => `Show ${title}`;
export const HIDE_SECTION = (title: string) => `Hide ${title}`;
export const NUDGE_KICKER = 'Not yet offline';
export const NO_SAVED_PROGRAMS =
  'No programs were kept when this pack was built. Keep programs in Recover, then build a pack to carry their pages.';
export const KEPT_NOT_SAVED = (count: number) =>
  `${count} kept ${count === 1 ? 'program is' : 'programs are'} not yet in an offline pack.`;
export const KEPT_NOT_SAVED_LINE = 'Build a pack to carry their pages, so they open with no signal.';
export const IN_YOUR_PACKS = 'In your packs';
export const PROGRAMS_STEP_KICKER = 'Support programs';
export const PROGRAMS_STEP_TITLE = 'Carry support programs in this pack?';
export const PROGRAMS_STEP_LINE =
  'The programs you tick travel in this pack with a copy of their official pages, so they open with no signal. Nothing about you is stored, and you can change this any day in Recover.';
export const CARRY_PROGRAMS = (count: number) =>
  count === 0 ? 'Keep none and continue' : `Carry ${count} ${count === 1 ? 'program' : 'programs'}`;
export const CHOOSE_LATER = 'Not now, choose in Recover later';
export const CHOOSE_IN_RECOVER = 'Choose programs in Recover';
export const WHO_TO_CALL = 'Who to call';
export const HOTLINE_LABEL = 'VicEmergency hotline';
export const CALLS_LINE = 'Voice calls often work when data does not. Each number is the organisation\'s own.';
export const PRINT_LIST = 'Print this list';
export const RECOVER_NONE_LINE =
  'Build a pack when you are online. It carries the official programs so they open with no signal.';

/** The eyebrow over the daily preparation line. Uppercased by `.kicker`, so it
 *  is written here in sentence case and read out as words, not as letters. */
export const PREPARATION_LABEL = "Today's reminder";

/** Eight preparation lines, each grounded in Country Fire Authority plan-and-
 *  prepare guidance. One is shown per day and named with its source on screen;
 *  none of them is advice about a particular place, and none of them says
 *  anything about what is happening outside. Each carries a second line for
 *  the reader the first was not written for: someone without a car, a garden,
 *  animals, tools or a household of their own. */
export const PREPARATION_SOURCE_RECOVERY = 'Based on the programs saved in your pack.';
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
    text: 'Keep the programs that fit your household, so they list first when you need them.',
    context: 'Tap Keep on a program in Recover. Only the program is remembered, on this phone, and nothing about you.',
    source: PREPARATION_SOURCE_RECOVERY,
  },
];

/** Attribution, not citation: the lines above are Cooeee's own wording of
 *  Country Fire Authority plan-and-prepare guidance, so the byline credits the
 *  guidance rather than quoting it. Nothing here is ever shown in quotes. */
export const PREPARATION_SOURCE = 'Based on Country Fire Authority guidance.';

/** The pack card's footer line. Appended to the card's own age wording rather
 *  than written into it: the age is a fact about the pack, and this is a fact
 *  about the pack's whole point — it is on the device, so it opens with the
 *  radios off. It states what the pack does, never what it protects you from. */
export const OPENS_WITHOUT_SIGNAL = ' · opens without signal';

/** Under the hold control only while nothing is saved: the mode is reachable
 *  with no pack, which is the one thing a new user would not expect. */
export const BLACKSKY_WORKS_WITHOUT_PACK = 'WORKS WITHOUT A SAVED PACK';

/** The About page, in the same shape as the BlackSky panel below: what Cooeee
 *  is, why it exists, what it does and does not do, and where the information
 *  stays. Plain sentences, with no colon, semicolon or dash anywhere. */
export const ABOUT_COOEEE = 'About Cooeee';
export const COOEEE_INFO_LINES = [
  {
    glyph: 'what',
    lead: 'What it is.',
    text: 'Cooeee is a small app for people who live where bushfires happen. It gathers official information about the places you choose and keeps it on your phone.',
  },
  {
    glyph: 'why',
    lead: 'Why it exists.',
    text: 'When a fire comes, the power and the signal often go first. Information that was only online is gone at the moment it matters most.',
  },
  {
    glyph: 'does',
    lead: 'What it does.',
    text: 'Build an offline pack for an address. Find the nearest official places from where you stand. Hold for BlackSky, the dark screen that points the way when nothing else works.',
  },
  {
    glyph: 'not',
    lead: 'What it does not do.',
    text: 'It does not watch conditions and it never contacts you. VicEmergency and emergency services tell you when to act.',
  },
  {
    glyph: 'stays',
    lead: 'Where your information stays.',
    text: 'On this phone. Your address is checked against Victorian Government data and Cooeee runs no server that could keep it.',
  },
] as const;

// ── The guided tour ─────────────────────────────────────────────────────────
// One overlay, nine stops across every screen. Each stop names a feature and
// says what it is, why it exists and what it does, in that order. The path is
// the screen the stop lives on; the target is what the spotlight surrounds.
export const TOUR_KICKER = 'Guided tour';
export const TOUR_HINT = 'Take the tour';
export const TOUR_BACK = 'Back';
export const TOUR_NEXT = 'Next';
export const TOUR_FINISH = 'Finish';
export const SKIP_TOUR = 'Skip tour';
export const TOUR_LEADS = ['What it is.', 'Why it exists.', 'What it does.'] as const;
export const TOUR_STEPS = [
  {
    path: '/',
    target: '.preparation',
    title: "Today's reminder",
    lines: [
      'One line of preparation advice, drawn from Country Fire Authority guidance.',
      'Preparation happens on ordinary days. A small reminder each day is easier to act on than a long list once.',
      'Shows a different line each day, with the reasoning beneath it. It never reports conditions.',
    ],
  },
  {
    path: '/',
    target: '.home .card',
    title: 'Your saved packs',
    lines: [
      'One card for each address you have prepared, or a note that none is saved yet.',
      'A pack is the information you will need when the signal is gone, gathered while you still have one.',
      'Tap a card to open its pack. The ring on the card deletes it after a second confirming tap.',
    ],
  },
  {
    path: '/',
    target: '.home .main-action',
    title: 'Build an offline pack',
    lines: [
      'The way to add a pack for another address.',
      'Home, work, the school and a relative can all need one. Each pack stands on its own.',
      'Starts a short flow. Search the address, confirm it, choose the nearest official places, add a note, then save.',
    ],
  },
  {
    path: '/',
    target: '.blacksky-hold-row',
    title: 'Hold for BlackSky',
    lines: [
      'The door into BlackSky, the dark screen for when the power and the signal are gone, with a ring beside it that explains the mode.',
      'A pocket press must never flip the phone into an emergency screen, so entering takes a deliberate two second hold.',
      'Hold to enter. Inside, arrows and distances point to the nearest official places of last resort from your GPS, and only a two second hold on Leave brings you back.',
    ],
  },
  {
    path: '/',
    target: '.app-header-inner',
    title: 'The header',
    lines: [
      'The Cooeee mark and, on the right, how long ago your oldest pack was checked.',
      'A pack ages. Knowing when it was last verified tells you whether to refresh it while you are online.',
      'Tap the name to return home from anywhere. The age pill reports and never blocks.',
    ],
  },
  {
    path: '/',
    target: '.bottom-nav-inner',
    title: 'The bottom bar',
    lines: [
      'Five places to go from any screen. Home, Nearby, Rehearse, Recover and About.',
      'A phone is used with one thumb, so the way around the app stays at the bottom, within reach.',
      'Home lists your packs. Nearby finds official places from where you are. Rehearse practises the way. Recover finds support. About says what Cooeee is. BlackSky is deliberately not here.',
    ],
  },
  {
    path: '/packs/new',
    target: '.search-form',
    title: 'The address search',
    lines: [
      'The first step of building a pack. Type a street address in Victoria and pick it from the matches.',
      'Official information is published for exact places, so a pack starts from an exact address.',
      'Looks the address up in the Victorian Government register while you type. The address stays on this phone once saved.',
    ],
  },
  {
    path: '/nearby',
    target: '.nearby .hero',
    title: 'Nearby official places',
    lines: [
      'The nearest official places, from your position or a postcode, while you have a connection.',
      'Before a pack exists, or away from home, you still need to know where the official places are.',
      'Lists relief centres and places of last resort with their distance, sorted by distance, not a safety ranking.',
    ],
  },
  {
    path: '/rehearse',
    target: '.rehearsal-entry, .rehearsal-condition',
    title: 'Rehearse',
    lines: [
      'A practice trip to one of the official places saved with a pack, on a calm day, without mobile data or without a location fix.',
      'The day is the wrong time to find out what the pack is missing or that the way is unfamiliar. A rehearsal finds it while there is time to fix it.',
      'Choose a pack and a condition, go with BlackSky open as on the day, and end it as you choose. What was missing becomes one written action each, never a score.',
    ],
  },
  {
    path: '/recover',
    target: '.recover',
    title: 'Recover',
    lines: [
      'The official support programs saved in your pack, found by saying what you need in plain words.',
      'After an event, people do not know what the schemes are called. Before it, they have time to read.',
      'Lists programs that may match a need with their publisher and saved date, keeps the ones you choose, and shares the list as text. Every result is a possible match, and the responsible organisation decides who is eligible.',
    ],
  },
  {
    path: '/about',
    target: '.about .card',
    title: 'About Cooeee',
    lines: [
      'One page that says what Cooeee is, why it exists, and what it does and does not do.',
      'Anyone can land here without knowing the app. The answer should be one tap away, always.',
      'Reached from the bottom bar on every screen. This tour can be started again from the ring beside the daily reminder.',
    ],
  },
] as const;

/** The information ring beside the hold control, and the panel a tap on it
 *  opens: what BlackSky is, why it exists, and three facts about using it,
 *  each line led by the one thing that matters. */
export const ABOUT_BLACKSKY = 'About BlackSky';
export const BLACKSKY_INFO_LINES = [
  {
    lead: 'What it is.',
    text: 'A separate screen for when the power and the signal are gone. It carries your saved pack and points to the nearest official places of last resort.',
  },
  {
    lead: 'Why it exists.',
    text: 'In a bushfire the phone may be the last tool left, used in the dark with wet hands and a dying battery. Black and amber spare the battery and your night vision, and everything works with one thumb.',
  },
  { lead: 'Works with no signal.', text: 'Everything it shows is already on this phone.' },
  {
    lead: 'Points the way.',
    text: "Arrows and distances to the nearest official places of last resort, from this phone's GPS, updated as you move.",
  },
  {
    lead: 'Two seconds to enter, two to leave.',
    text: 'Hold the control. A tap does nothing, and the back button does not leave it.',
  },
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
export const NEARBY_LEDE =
  'The nearest Neighbourhood Safer Place, Community Fire Refuge, and any relief or recovery centre listed as open, from your position or a postcode. Each row says how current it is.';

export const USE_MY_LOCATION = 'Use my location';
export const LOCATING = 'Reading your position…';
export const LOCATION_FAILED = 'Your position could not be read. Enter a postcode instead.';
export const POSTCODE_LABEL = 'Or a Victorian postcode';
export const FIND_POSTCODE = 'Find';
export const POSTCODE_INVALID = 'Enter a four-digit postcode.';
export const POSTCODE_UNKNOWN = (postcode: string) =>
  `Postcode ${postcode} is not in the downloaded Victorian list.`;
export const FROM_POSITION = (accuracy: string) => `From your position, ${accuracy}`;
export const FROM_POSTCODE = (postcode: string) => `From the centre of postcode ${postcode}`;
export const DISTANCES_NOTE = 'Straight-line distances. The nearest of each kind, not a ranking.';

export const DOWNLOADING_PLACES = 'Downloading the official places…';
export const FIRST_RUN_TITLE = 'Nothing downloaded yet';
export const FIRST_RUN_LINE =
  'Connect to the internet once to download the official places for your area. After that they open without signal.';

export const GROUP_BUSHFIRE = 'Bushfire places of last resort';
export const GROUP_BUSHFIRE_NOTE =
  'Designated by the Country Fire Authority for their own township, and for bushfire only.';
export const GROUP_RELIEF = 'Relief and recovery';
export const GROUP_RELIEF_NOTE =
  'Opened for a particular incident and listed by VicEmergency only while it runs.';

export const FACILITY_TYPE_NAME: Record<FacilityType, string> = {
  NSP: 'Neighbourhood Safer Place',
  CFR: 'Community Fire Refuge',
  ERC: 'Emergency Relief Centre',
  RELIEF: 'Relief Centre',
  RECOVERY: 'Recovery Centre',
  ASSEMBLY: 'Assembly Area',
};

export const STATE_LIVE = 'Live';
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
export const MAY_BE_OUTDATED = 'May be outdated. Confirm by radio or on the hotline if you can.';
export const TOO_OLD_TO_SHOW = 'This information is more than an hour old, so no place is shown.';
export const SOURCE_UNCONFIRMED = (source: string) =>
  `The ${source} could not be reached recently, so this could not be confirmed.`;
export const SOURCE_NOT_READ = (source: string) =>
  `The ${source} has not been read yet, so nothing can be confirmed.`;
export const NEEDS_REVIEW_NOTE =
  'Listed earlier by the Country Fire Authority but missing from its latest list, check before relying on it.';

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
export const DATA_SOURCES_PLAIN =
  'Where the places on this screen come from, and when each list was last checked.';
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
export const CHOOSE_PACK_TO_REHEARSE_DETAIL = 'One rehearsal runs from one saved pack.';
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
    ? `${count} packs were started on this device and their builds did not finish, so nothing was stored for them.`
    : 'One pack was started on this device and its build did not finish, so nothing was stored for it.';
/** [DRAFT] pending Sharon's copy review. This is the only line across the four
 *  stopped states that tells the reader to do something rather than stating a
 *  fact about the pack, and it is the only one whose sentence does not use the
 *  action's own words the way the unreadable state's does. Shipped as-is. */
export const PACK_NOT_FINISHED_NEXT =
  'Building it again while you have a connection is what would make a rehearsal possible.';

// The pack is finished and readable, and holds nothing a rehearsal runs from.
export const NOTHING_TO_REHEARSE = 'This pack holds nothing to rehearse';
/** Names no single hazard. One pack carries more than one, so a sentence that
 *  named bushfire alone would be wrong for the rest of what the pack holds. */
export const NOTHING_TO_REHEARSE_DETAIL = (name: string, savedOn: string) =>
  `${name}, saved ${savedOn}, holds no designation recorded for its address, and no official place saved with it.`;
export const NOTHING_TO_REHEARSE_NEXT =
  'A rehearsal runs from one of those two. Building this pack again, once the official information covers this address, is what would add them.';

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
  `Cooeee read this pack from the device, and ${parts} did not match what the pack recorded, so they were not used.`;
export const PACK_STORE_UNREADABLE_DETAIL =
  'The pack store on this device could not be opened, so nothing about this pack could be read.';
/** Says what would restore the pack in the words the action itself uses. It
 *  does NOT say "build this pack again": the build flow starts from an address
 *  search and does not carry this pack's address into it, so a sentence or a
 *  button promising to rebuild THIS pack would be a promise the next screen
 *  breaks. */
export const PACK_COULD_NOT_BE_READ_NEXT =
  'An offline pack built for this address again would restore it.';

// Nothing is stored at all.
export const NO_PACK_TO_REHEARSE = 'No pack is stored on this device';
export const NO_PACK_ELSEWHERE = 'That pack is not on this device';
export const NO_PACK_TO_REHEARSE_DETAIL =
  'A rehearsal runs from a saved pack: the official information for one address, kept on this phone so it opens without signal.';
/** Defensive at zero for the same reason: the screen only asks for this line
 *  when another pack is saved, and "0 other packs are saved here" would be a
 *  false statement if that ever stopped being true. */
export const NO_PACK_OTHERS_DETAIL = (count: number) =>
  count > 1
    ? `${count} other packs are saved here. Open one from Home to rehearse it.`
    : 'One other pack is saved here. Open it from Home to rehearse it.';


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
export const CHOOSE_CONDITION_HEADING = 'What are we rehearsing without?';
export const CONDITION_NO_DATA = 'No mobile data';
export const CONDITION_NO_DATA_DETAIL =
  'Nothing loads. Anything the phone did not already have is not there.';
export const CONDITION_NO_FIX = 'No location fix';
/** Says what the phone cannot do, without naming the thing it would otherwise
 *  give you: the obvious phrasing uses words the wording scan forbids, and the
 *  plainer sentence is the better one anyway. */
export const CONDITION_NO_FIX_DETAIL = 'The phone cannot work out where it is.';
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
export const GAP_MEANING_PACK_CONTENT = 'This information is missing from your pack.';
/** The condition sentence in its two halves. The wording is unchanged and the
 *  joined sentence is byte-identical, so the result reads exactly as it did. */
export const GAP_MEANING_CONDITION_FACT = 'This is not available under this condition.';
export const GAP_MEANING_CONDITION_NEXT = 'Here is what to do instead.';
export const GAP_MEANING_CONDITION = `${GAP_MEANING_CONDITION_FACT} ${GAP_MEANING_CONDITION_NEXT}`;

// What could not be relied on.
export const GAP_DESIGNATION = 'The official area designation for this address';
export const GAP_PLACES = 'The official places saved with this pack';
export const GAP_PROVENANCE = 'The publisher and saved date on every stored item';
export const GAP_LIVE_DIRECTION = 'Live direction and distance to your saved places';

/** What the gaps count on the pack page means, behind an information ring on
 *  every row of the rehearsal list. It lives here, beside the four things a
 *  rehearsal looks for, because it names them in their own words rather than
 *  describing them again. A count, never a mark. */
export const ABOUT_GAPS = 'About gaps';
export const GAPS_INFO_LINES = [
  {
    lead: 'What a gap is.',
    text: 'One thing the rehearsal looked for and could not rely on that day, either because it was not in the pack or because the condition took it away.',
  },
  {
    lead: 'What it looks for.',
    text: `${GAP_DESIGNATION}. ${GAP_PLACES}. ${GAP_PROVENANCE}. ${GAP_LIVE_DIRECTION}.`,
  },
  {
    lead: 'None found.',
    text: 'Everything the rehearsal looked for was on the phone that day. It says what was checked, and nothing about how ready you are.',
  },
  {
    lead: 'It is a count.',
    text: 'A number of things you can act on. Nothing here is a mark and nothing is ranked.',
  },
] as const;

// The one action for each. None of them says the capability has come back.
export const ACTION_BUILD_AGAIN_DESIGNATION =
  'Build this pack again while you have a connection, so the official designation for this address is stored with it.';
export const ACTION_BUILD_AGAIN_PLACES =
  'Build this pack again while you have a connection, so the official places for this area are stored with it.';
export const ACTION_BUILD_AGAIN_PROVENANCE =
  'Build this pack again while you have a connection, so every stored item carries its publisher and its saved date.';
/** Says what to do instead, and does not pretend the phone will find the way. */
export const ACTION_WRITE_THE_WAY_DOWN =
  'Write down how to reach each saved place from your front door, and keep it with the things you would take.';

export const ACTION_LABEL = 'What to do';

/** A rehearsal that found nothing to act on. It says what was checked and what
 *  held. It does NOT say the reader is prepared, and it never will.
 *  [DRAFT] pending Sharon's copy review. Reachable only after a no-data run on a
 *  complete pack: under no location fix the contingency gap always fires. */
export const NO_GAPS_HEADING = 'Nothing was missing in this rehearsal';
/** Takes the condition's without-form (conditionWithout), never its row title. */
export const NO_GAPS_DETAIL = (without: string) =>
  `Everything this rehearsal looked for was on the phone without ${without}. That is what was checked, on this pack, today.`;

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
export const RUN_NOT_KEPT =
  'This rehearsal could not be kept on this device. What it found is on this screen now, and will not be here later.';
/** No date is ever shown for a completion that did not store: a date would be
 *  the product asserting a record it does not hold. */
export const ACTION_NOT_KEPT =
  'This could not be kept on this device. Nothing was recorded, so it will still be here to mark next time.';

// ── E5-US2-AC2/AC3/AC4 what has moved since the last rehearsal ────────────
// Words, never a figure. The three groups below are told apart by their
// headings, not by a colour, a dot or a badge: strip every colour out and the
// screen still says which list is which [WCAG 1.4.1]. All [DRAFT] for Sharon.

export const PROGRESS_HEADING = 'Since you last rehearsed this pack this way';
export const EARLIER_REHEARSAL_ON = (date: string) => `Compared with your rehearsal of ${date}`;
export const GROUP_NEWLY_DETECTED = 'Not found last time';
export const GROUP_STILL_OPEN = 'Still to do';
export const GROUP_DONE_SINCE = 'You have done since then';

/** AC3. A first rehearsal is a whole result. This says what is not there yet,
 *  and does not frame the run as incomplete or as a starting score. */
export const FIRST_REHEARSAL_HEADING = 'This is your first rehearsal of this pack this way';
export const FIRST_REHEARSAL_DETAIL =
  'There is nothing earlier to compare it with yet. What it found is below, in full.';

/** AC4. States that the PACK changed, and keeps that separate from anything the
 *  reader did. Nothing here attributes the difference to them. */
export const PACK_CHANGED_ON = (date: string) =>
  `You built this pack again on ${date}, so the two rehearsals looked at different saved information. What changed between them is not only what you did.`;
/** The honest third answer. Not a softer way of saying nothing changed. */
export const PACK_CHANGE_UNKNOWN =
  'Whether the pack changed between these two rehearsals was not recorded, so it cannot be said either way.';

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
export const MAKE_IT_REAL = 'Make it real on this phone';
export const CONDITION_HOW_TO: Record<'no-data' | 'no-location-fix', string> = {
  'no-data': 'Turn on aeroplane mode and turn Wi-Fi off, so the phone has no data, as on the day.',
  'no-location-fix': 'Turn location off in the phone settings, so there is no fix, as on the day.',
};
export const PHONE_IS_OFFLINE = 'Your phone is offline now, as on the day.';
// E5-US7 — the pack's notes on the journey, as BlackSky shows them on the day.
export const NO_NOTES_ON_JOURNEY = 'No notes are saved with this pack.';
export const PHONE_STILL_ONLINE =
  'Your phone still has a connection. Aeroplane mode makes this rehearsal real.';

/** [DRAFT] What a rehearsal is. */
export const JOURNEY_WHAT_IT_IS =
  'A rehearsal is a trip to one of the official places saved with this pack, in calm conditions, with BlackSky open. Go the way you would on the day.';
/** [DRAFT] What it is for, and what it is not. */
export const JOURNEY_WHAT_IT_IS_FOR =
  'It is practice at knowing the way: how long it takes, and which turns you take.';
/** [DRAFT] The one control before she goes. It is the commitment. */
export const I_AM_GOING_NOW = "I'm going now";
/** [DRAFT] While she is out. */
export const JOURNEY_RUNNING_HEADING = 'Practising the way';
/** [DRAFT] What to do while she is out. */
export const JOURNEY_RUNNING_DETAIL =
  'Go to one of these places in calm conditions, with BlackSky open. When you stop, come back here and say how it ended.';
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
  `You started a rehearsal without ${without} on ${date}. Only you can say how it ended.`;
/** [DRAFT] pending Sharon's copy review. The two endings, as the criterion names
 *  them, each with what it means in her words. */
export const ENDING_WALKED = 'I went there';
export const ENDING_WALKED_DETAIL = 'I went to the place.';
export const ENDING_DRY_RUN = 'I did not go, a dry run';
export const ENDING_DRY_RUN_DETAIL = 'I ended it without going.';
/** [DRAFT] pending Sharon's copy review. A rehearsal recorded before the endings
 *  existed, in the shape PACK_CHANGE_UNKNOWN uses: not knowing is its own state,
 *  and never a default to either ending. */
export const ENDING_NOT_RECORDED =
  'Whether you went there or ended this rehearsal without going was not recorded, so it cannot be said either way.';

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
export const RESULT_DRY_RUN = 'This was a dry run: you ended it without going.';
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
export const WAY_NOTE_DETAIL =
  "If you like, write what the app cannot tell you: the turns, what you met on the way, what you would do differently. It is kept with this pack's notes, which BlackSky shows you without a connection.";
/** [DRAFT] pending Sharon's copy review. */
export const WAY_NOTE_LABEL = 'Your note about the way';
