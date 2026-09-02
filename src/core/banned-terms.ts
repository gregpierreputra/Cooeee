// The wording scan. scripts/banned-terms.mjs reads these two lists, walks every
// string literal and template chunk under src/, strips ALLOWED phrases first,
// then matches BANNED word-boundary and case-insensitive. A hit fails the build.
//
// This file is the one file the scanner skips, because it necessarily contains
// every banned term as data.

export const BANNED = [
  'safe',
  'safest',
  'safety',
  'secure',
  'safe zone',
  "you'll be fine",
  'you are safe',
  'will save you',
  'best',
  'recommended',
  'preferred',
  'primary',
  'backup',
  'not designated',
  'no risk',
  'no hazard',
  'all clear',
  'low risk',
  'lower risk',
  'eligible',
  'entitled',
  'approved',
  'you will receive',
  'guaranteed',
  'guarantee',
  'route',
  'directions',
  'turn-by-turn',
  'ETA',
  'arrive by',
  'arrival',
  'alert',
  'danger',
  'current risk',
  'warning',
  'SQLite',
];

export const ALLOWED = [
  'Neighbourhood Safer Place',
  'Neighbourhood Safer Places',
  'sorted by distance — not a safety ranking',
  'Cooeee issues no warnings',
  'the responsible organisation decides who is eligible',
];
