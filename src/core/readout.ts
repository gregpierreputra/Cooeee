// The readout's steadiness (BS_Enhancement-AC5, from the 28 Sep review): the
// pure rule. What the distance row shows (the distance and the compass point)
// holds still while the position only wobbles within its own error.

import { READOUT_MIN_CHANGE_M } from './constants';

/** What the readout shows for one place: its distance and its bearing. */
export type ShownReadout = { placeId: string; distanceM: number; bearingDeg: number };

/** The readout to show now. The new figures replace the shown ones when the
 *  place is another one, or when the place as seen from here has moved by more
 *  than the fix's accuracy (READOUT_MIN_CHANGE_M at the least): along the line
 *  to it (the distance) or across it (the bearing, as metres at that
 *  distance). Otherwise the shown figures stand. */
export function steadyReadout(
  shown: ShownReadout | null,
  next: ShownReadout,
  accuracyM: number,
): ShownReadout {
  if (!shown || shown.placeId !== next.placeId) return next;
  const threshold = Math.max(accuracyM, READOUT_MIN_CHANGE_M);
  const along = Math.abs(next.distanceM - shown.distanceM);
  const turn = ((((next.bearingDeg - shown.bearingDeg) % 360) + 540) % 360) - 180;
  const across = next.distanceM * Math.abs((turn * Math.PI) / 180);
  return along > threshold || across > threshold ? next : shown;
}
