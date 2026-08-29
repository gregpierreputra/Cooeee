// EVERY user-facing string in the product. Components contain no inline literals.
// The mandated lines below are exact — punctuation and em dashes included — and
// tests/core/copy.test.ts asserts each one by exact match. Never reword them.

// ── Mandated literals ────────────────────────────────────────────────────────

export const SORTED_BY_DISTANCE = 'sorted by distance, not a safety ranking';

export const ORG_DECIDES = 'the responsible organisation decides who is eligible';

export const PAST_NOT_PREDICTION = 'Past events are not a prediction.';

export const NO_DESTINATION_PUBLISHED =
  'No official place of last resort is published for this area';

/** The absence row's own reason: the mandated line, plus the area it applies to. */
export const NO_DESTINATION_PUBLISHED_FOR = (area: string) =>
  `${NO_DESTINATION_PUBLISHED} — ${area}.`;

export const NO_ADDRESS_MATCH =
  'No matching address found - check the spelling or try the nearest cross street.';

export const NO_GPS = 'No GPS fix — showing your saved information.';

export const GPS_TOO_INACCURATE = (m: number) =>
  `GPS is too inaccurate here to trust a direction (± ${m} m).`;

export const OUTSIDE_AREAS = "You're outside the areas you've prepared";

export const OFFLINE_LINE = (date: string) => `Offline — showing your saved pack from ${date}.`;

export const NOT_RECENTLY_VERIFIED = (days: number) =>
  `Saved ${days} days ago — not recently verified`;

export const CHECK_DID_NOT_FINISH = (date: string) =>
  `The check did not finish — showing your saved copy from ${date}.`;

export const NO_DATA = 'Internet not reachable. Phone calls and SMS may still work.';

export const CANNOT_DETECT_SIGNAL =
  'may work if your phone shows signal — this app cannot detect phone signal';

// ── Shared vocabulary ────────────────────────────────────────────────────────

/** 16-point compass names, index 0 = north, one entry every 22.5 degrees.
 *  Read by core/geo.ts cardinal(). */
export const CARDINAL_POINTS = [
  'NORTH',
  'NORTH-NORTH-EAST',
  'NORTH-EAST',
  'EAST-NORTH-EAST',
  'EAST',
  'EAST-SOUTH-EAST',
  'SOUTH-EAST',
  'SOUTH-SOUTH-EAST',
  'SOUTH',
  'SOUTH-SOUTH-WEST',
  'SOUTH-WEST',
  'WEST-SOUTH-WEST',
  'WEST',
  'WEST-NORTH-WEST',
  'NORTH-WEST',
  'NORTH-NORTH-WEST',
] as const;

/** Distance ordinals, zero-based. Position in a distance-ordered list is not a
 *  ranking of worth, so there is no fourth label and no superlative anywhere. */
export const ORDINALS = ['nearest', 'second nearest', 'third nearest'] as const;

/** The needs vocabulary. Selections are held in memory only, never stored. */
export const NEED_LABELS = {
  stay: 'Somewhere to stay',
  money: 'Money for immediate needs',
  food: 'Food and essentials',
  property: 'Property and repairs',
  health: 'Health and wellbeing',
  documents: 'Help with documents',
} as const;

// ── Application shell ────────────────────────────────────────────────────────

export const APP_NAME = 'Cooeee';

export const HOME_TITLE = 'Your packs';

export const NO_PACKS_YET = 'No packs saved yet.';

export const NO_PACKS_HINT =
  'Build a pack while you have a connection, so it is on your phone when there is none.';

export const SAVED_DAYS_AGO = (days: number) => `Saved ${days} days ago`;

export const NEW_VERSION_READY =
  'A new version is ready. It is applied when you choose to reload — nothing changes until then.';

export const RELOAD_NOW = 'Reload now';

// ── E1-US1-AC1 address confirmation ─────────────────────────────────────────

export const CONFIRM_ADDRESS_QUESTION = 'Is this the place you want to save?';
export const PLACE_NAME_LABEL = 'Place name';
export const SAVE_THIS_PLACE = 'Save this place';
export const SEARCH_AGAIN = 'Search again';

// ── E1-US1-AC2–AC4 address search ──────────────────────────────────────────

export const BUILD_A_PACK = 'Build a pack';
export const ADDRESS_SEARCH_TITLE = 'Search for your address';
export const ADDRESS_FIELD_LABEL = 'Address';
export const SEARCH = 'Search';
export const SEARCH_IN_PROGRESS = 'Searching for addresses.';
export const ADDRESS_QUERY_TOO_SHORT = 'Enter at least 3 characters.';
export const CHOOSE_ADDRESS = 'Choose your address from the list.';
export const CANDIDATE_LIST_LABEL = 'Address candidates';
export const NONE_OF_THESE = 'None of these is my address';
export const SEARCH_COULD_NOT_RUN = 'We could not search for this address right now.';
export const SEARCH_FAILURE_MEANING =
  'This is not the same as saying the address is not there. Try again when you have a connection.';
export const TRY_AGAIN = 'Try again';

// ── E1-US1-AC5–AC7 bushfire-area check ─────────────────────────────

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
  'Follow CFA and emergency service instructions first.';
export const AREA_CHECK_COULD_NOT_RUN =
  'We could not check the bushfire area for this address right now.';
export const AREA_NOT_SAVED =
  'Nothing has been saved. Your address is still here — try again when you have a connection.';

// ── E1-US1-AC8 pack conflict ──────────────────────────────────────────

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

// ── E1-US1-AC9 pack offer and download ─────────────────────────────

export const READY_TO_DOWNLOAD = 'Ready to download';
export const PACK_SIZE_LINE = (textSize: string, tileSize: string) =>
  `Text ${textSize} · Map tiles ${tileSize} for about 10 km around this place`;
export const DOWNLOAD_BOTH = 'Download both';
export const TEXT_ONLY = 'Text only';
export const SAVING_PACK = 'Saving the pack.';
export const DOWNLOAD_STOPPED = 'The download stopped before it finished.';
export const PREVIOUS_PACK_UNTOUCHED =
  'Nothing has been changed. Your previous pack is untouched.';
export const SAVED_WITHOUT_MAP_TILES = 'Saved without map tiles';
export const MAPS_NOT_DOWNLOADED =
  'Maps were not downloaded. Everything else in this pack works offline.';
export const PLACE_SAVED = 'Place saved';
export const MAP_DOWNLOAD_UNAVAILABLE =
  'Map download is not available yet. Text only is still available.';

// ── E1-US2-AC1–AC5 pack provenance and offline source access ───────────────

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
export const SOURCE_IS_ON_WEB =
  'This source is on the web, so it cannot open while you are offline.';
export const STORED_PROVENANCE_REMAINS =
  'The publisher and the saved date below are stored on this device and stay readable.';
export const TRY_SOURCE_AGAIN = 'Try again when you have a connection';
export const OPEN_ORIGINAL_SOURCE = 'Open original source (web)';
export const CLOSE = 'Close';
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
