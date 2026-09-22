// E7 — the rules of movement in the drill, kept apart from the screen so they
// can be tested without one. Positions are in tiles, time in seconds.

import { blocked, REACH } from './drill-house';
import { BAG_LIMIT, DRILL_ITEMS, itemById, type DrillItem } from './drill-items';

/** Walking pace with an empty bag, in tiles per second. */
export const SPEED = 6.5;
/** Each bulky thing carried costs a tenth of the pace, down to this floor. */
const BULKY_COST = 0.1;
const SLOWEST = 0.6;

/** The early way out: with a full bag, in the last ten seconds, standing on
 *  the door mat this long ends the drill at once. A person who is ready is
 *  never left waiting at the door, unsure what happens next. */
export const EARLY_EXIT_HOLD = 1.5;
const EARLY_EXIT_WINDOW = 10;

/** Whether the time on the mat counts towards leaving early. */
export const leavingEarly = (packedCount: number, secondsLeft: number, onMat: boolean): boolean =>
  onMat && packedCount >= BAG_LIMIT && secondsLeft <= EARLY_EXIT_WINDOW;

/** Which way the figure looks, in the order the sprite sheet holds them. */
export const RIGHT = 0;
export const UP = 1;
export const LEFT = 2;
export const DOWN = 3;

/** The pace for this bag. Bulky things (the ones that take points away) slow
 *  the figure, which is the lesson: they cost time as well as room. */
export function speedFor(packed: string[]): number {
  const bulky = packed.filter((id) => (itemById(id)?.weight ?? 0) < 0).length;
  return SPEED * Math.max(SLOWEST, 1 - BULKY_COST * bulky);
}

/** How far sideways the figure is eased to slip round a corner it clips. */
const SLIDE = 0.3;

/** The smallest sideways shift, up to SLIDE, that would let a blocked move of
 *  (dx, dy) along one axis go through, or 0 when none does. */
function clearance(x: number, y: number, dx: number, dy: number): number {
  for (let shift = 0.05; shift <= SLIDE + 1e-9; shift += 0.05) {
    for (const side of [shift, -shift]) {
      const ox = dx === 0 ? side : 0;
      const oy = dx === 0 ? 0 : side;
      if (!blocked(x + ox, y + oy) && !blocked(x + ox + dx, y + oy + dy)) return side;
    }
  }
  return 0;
}

/** Move towards a sideways shift, no faster than the figure is walking. */
const ease = (shift: number, move: number): number => Math.sign(shift) * Math.min(Math.abs(shift), Math.abs(move));

/** One move. The stick (sx, sy) is at most one long. Each axis moves on its
 *  own, so the figure slides along a wall rather than sticking to it, and a
 *  move straight into the corner of something eases round it. */
export function step(x: number, y: number, sx: number, sy: number, dt: number, speed: number) {
  const length = Math.max(1, Math.hypot(sx, sy));
  const dx = (sx / length) * speed * dt;
  const dy = (sy / length) * speed * dt;
  let nextX = x;
  let nextY = y;
  if (dx !== 0) {
    if (!blocked(x + dx, y)) nextX = x + dx;
    else if (dy === 0) nextY = y + ease(clearance(x, y, dx, 0), dx);
  }
  if (dy !== 0) {
    if (!blocked(nextX, y + dy)) nextY = y + dy;
    else if (dx === 0) nextX = x + ease(clearance(x, y, 0, dy), dy);
  }
  return { x: nextX, y: nextY };
}

/** The way the stick points, or the way already faced when it is at rest. */
export function facing(sx: number, sy: number, previous: number): number {
  if (sx === 0 && sy === 0) return previous;
  if (Math.abs(sx) > Math.abs(sy)) return sx > 0 ? RIGHT : LEFT;
  return sy > 0 ? DOWN : UP;
}

/** The nearest thing within reach that is not in the bag yet. */
export function nearestItem(x: number, y: number, packed: string[]): DrillItem | null {
  let nearest: DrillItem | null = null;
  let nearestDistance = REACH;
  for (const item of DRILL_ITEMS) {
    const distance = Math.hypot(item.x - x, item.y - y);
    if (distance <= nearestDistance && !packed.includes(item.id)) {
      nearest = item;
      nearestDistance = distance;
    }
  }
  return nearest;
}

/** How thick the smoke and the dark are, 0 to 1, as the minute runs. The
 *  power is already out, so the dark starts deep and only grows, and smoke
 *  arrives before flame. Neither is ever total: the game stays playable. */
export function haze(elapsed: number, seconds: number) {
  const progress = Math.min(1, Math.max(0, elapsed / seconds));
  return { smoke: 0.08 + 0.22 * progress, dark: 0.62 + 0.12 * progress };
}
