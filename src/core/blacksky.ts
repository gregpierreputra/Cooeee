import {
  ACCURACY_MAX_M,
  FIX_STALE_MS,
  MARK_DRIFT_M_PER_S,
  MARK_START_ACCURACY_M,
} from './constants';
import { bearingDeg, distanceM } from './geo';
import type { Destination, Fix, Pack, PackWithPlaces } from './types';

export type PlacedDestination = { d: Destination; bearingDeg: number; distanceM: number };

/** A position the user marked themselves — a known point such as their front
 *  gate — and when they marked it. */
export type Mark = { lat: number; lon: number; at: number };

/**
 * The marked position as a synthetic Fix (E3-US1-AC4). Its uncertainty starts
 * at MARK_START_ACCURACY_M and grows at walking pace, because without motion
 * sensors the holder may have been walking since the mark. `at` is `now`: an
 * estimate is never "stale" — its decay IS the accuracy figure.
 *
 * Returns null once the uncertainty passes ACCURACY_MAX_M: the estimate cannot
 * be maintained, and a null fix hands the screen back to ACQUIRING — the AC2
 * reference state — rather than drawing a confident arrow.
 */
// ponytail: time-only drift, no sensors. Upgrade to accelerometer/gyro PDR only
// after the Iteration 1 drift spike validates it (card E3-US1-AC4).
export function estimateFix(mark: Mark, now: number): Fix | null {
  const accuracyM = Math.round(MARK_START_ACCURACY_M + ((now - mark.at) / 1000) * MARK_DRIFT_M_PER_S);
  if (accuracyM > ACCURACY_MAX_M) return null;
  return { lat: mark.lat, lon: mark.lon, accuracyM, at: now };
}

export type Screen =
  | { kind: 'NO_PACK' }
  | {
      kind: 'ACQUIRING';
      reason: 'no-fix' | 'stale' | 'denied';
      pack: Pack;
      places: Destination[];
    }
  | { kind: 'LOW_ACCURACY'; accuracyM: number; pack: Pack; places: Destination[] }
  | { kind: 'OUT_OF_AREA'; packs: { pack: Pack; distanceKm: number }[] }
  | {
      kind: 'IN_AREA';
      pack: Pack;
      places: PlacedDestination[];
      accuracyM: number;
      headingDeg?: number;
      absence?: Destination;
    };

const isGeocoded = (d: Destination): boolean =>
  typeof d.lat === 'number' && typeof d.lon === 'number';

// The chosen places, plus any absence row — which is never "chosen" but must
// always be rendered.
const shown = (places: Destination[]): Destination[] =>
  places.filter((d) => d.chosen === true || d.kind === 'absence');

/**
 * The whole BlackSky screen, derived from scratch on every fix, every accepted
 * heading sample and every TICK_MS tick. It is a DERIVATION, not a state machine:
 * "the arrow returns automatically when a fix arrives" needs no code, because it
 * is simply what the next derivation returns.
 *
 * PRECEDENCE — first match wins, and THE ORDER IS A SAFETY PROPERTY:
 *   1 NO_PACK  2 ACQUIRING  3 LOW_ACCURACY  4 OUT_OF_AREA  5 IN_AREA
 *
 * Accuracy is checked BEFORE area membership, so an inaccurate fix can never
 * place someone inside a pack area and draw a confident arrow from a position
 * that might be 800 m wrong.
 */
export function deriveState(
  now: number,
  packs: PackWithPlaces[],
  fix: Fix | null,
  permission: 'granted' | 'denied' | 'prompt',
  headingDeg: number | null,
): Screen {
  if (packs.length === 0) return { kind: 'NO_PACK' };

  // ponytail: with no usable fix there is nothing to choose a pack by, so this
  // is the caller's first pack — the packs are equals and carry no rank. Give
  // the user a pack switcher here if two-pack users report picking the wrong one.
  const fallback = packs[0];

  if (permission === 'denied')
    return {
      kind: 'ACQUIRING',
      reason: 'denied',
      pack: fallback.pack,
      places: shown(fallback.places),
    };

  if (!fix)
    return {
      kind: 'ACQUIRING',
      reason: 'no-fix',
      pack: fallback.pack,
      places: shown(fallback.places),
    };

  if (now - fix.at > FIX_STALE_MS)
    return {
      kind: 'ACQUIRING',
      reason: 'stale',
      pack: fallback.pack,
      places: shown(fallback.places),
    };

  if (fix.accuracyM > ACCURACY_MAX_M)
    return {
      kind: 'LOW_ACCURACY',
      accuracyM: fix.accuracyM,
      pack: fallback.pack,
      places: shown(fallback.places),
    };

  const byDistance = packs
    .map((p) => ({ ...p, metres: distanceM(fix, p.pack) }))
    .sort((a, b) => a.metres - b.metres);

  // Containment is INCLUSIVE: a point exactly on the radius is inside.
  const containing = byDistance.filter((p) => p.metres <= p.pack.radiusKm * 1000);

  if (containing.length === 0)
    return {
      kind: 'OUT_OF_AREA',
      packs: byDistance.map((p) => ({ pack: p.pack, distanceKm: p.metres / 1000 })),
    };

  const here = containing[0];
  const places = shown(here.places)
    .filter(isGeocoded)
    .map((d) => {
      const to = { lat: d.lat!, lon: d.lon! };
      return { d, bearingDeg: bearingDeg(fix, to), distanceM: distanceM(fix, to) };
    })
    .sort((a, b) => a.distanceM - b.distanceM);

  const absence = here.places.find((d) => d.kind === 'absence');

  return {
    kind: 'IN_AREA',
    pack: here.pack,
    places,
    accuracyM: fix.accuracyM,
    ...(headingDeg === null ? {} : { headingDeg }),
    ...(absence ? { absence } : {}),
  };
}
