// Looking around the map (BS_Enhancement-AC5, from the 28 Sep review): the
// pure rules. The map can be dragged a little way from the person, and comes
// back to them on a tap or by itself. The offset is kept as metres north and
// east of the person, so it means the same whatever the dial's size, its
// turn, or where the person has since moved.

import { ROADS_PAN_MAX_M, ROADS_PAN_RETURN_MS } from './constants';

/** Where the map's centre is, in metres north and east of the person. */
export type PanOffset = { north: number; east: number };

export const NO_PAN: PanOffset = { north: 0, east: 0 };

export const isPanned = (offset: PanOffset): boolean => offset.north !== 0 || offset.east !== 0;

/** The offset after a drag of `dxPx` right and `dyPx` down on the screen.
 *  The map follows the finger, so its centre moves the other way; the dial is
 *  turned by the heading, so a drag up the screen moves the map along the
 *  heading, not along north. Never more than ROADS_PAN_MAX_M from the person:
 *  a longer drag stops at that distance, in the direction dragged. */
export function panOffset(
  current: PanOffset,
  dxPx: number,
  dyPx: number,
  headingDeg: number,
  metresPerPx: number,
): PanOffset {
  // The screen's vector for the centre's move, turned back into the map's
  // north-up frame (x east, y down): the dial draws the map turned by
  // -heading, so undoing that is a turn by +heading.
  const rad = (headingDeg * Math.PI) / 180;
  const sx = -dxPx;
  const sy = -dyPx;
  const mx = sx * Math.cos(rad) - sy * Math.sin(rad);
  const my = sx * Math.sin(rad) + sy * Math.cos(rad);
  const next = { north: current.north - my * metresPerPx, east: current.east + mx * metresPerPx };
  const far = Math.hypot(next.north, next.east);
  if (far <= ROADS_PAN_MAX_M) return next;
  const k = ROADS_PAN_MAX_M / far;
  return { north: next.north * k, east: next.east * k };
}

/** Whether the map should come back to the person by itself: it has been moved
 *  and nothing has touched it for ROADS_PAN_RETURN_MS. `lastTouchAt` is when
 *  the last touch on the map ended; null while a finger is on it. */
export function panShouldReturn(offset: PanOffset, lastTouchAt: number | null, now: number): boolean {
  return isPanned(offset) && lastTouchAt !== null && now - lastTouchAt >= ROADS_PAN_RETURN_MS;
}
