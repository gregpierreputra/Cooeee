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
  'No matching address found — check the spelling or try the nearest cross street.';

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
