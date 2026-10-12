// E9 — the rules of movement in the drill, kept apart from the screen so they
// can be tested without one. Positions are in tiles, time in seconds.

import { blocked, REACH, type Closed } from './drill-house';
import { DRILL_SECONDS, type DrillItem } from './drill-items';
import { CLASSIC, type DrillRules, type Light } from './drill-twists';

/** Walking pace with an empty bag, in tiles per second. */
export const SPEED = 6.5;
/** Each bulky thing carried costs a share of the pace (a tenth, unless the
 *  twist says otherwise), down to this floor. */
const SLOWEST = 0.6;

/** The early way out: after the first 15 seconds (so the start, beside the
 *  mat, never ends it by accident), standing on the door mat this long ends
 *  the drill at once, with whatever is in the bag. A ring fills on the mat
 *  while they wait, so a person at the door is never left unsure what happens
 *  next. In the classic two minutes that is the last 1 minute 45 seconds. */
export const EARLY_EXIT_HOLD = 1.5;
const EARLY_EXIT_GRACE = 15;

/** Whether the time on the mat counts towards leaving early. */
export const leavingEarly = (secondsLeft: number, onMat: boolean, seconds = DRILL_SECONDS): boolean =>
  onMat && secondsLeft < seconds - EARLY_EXIT_GRACE;

/** Which way the figure looks, in the order the sprite sheet holds them. */
export const RIGHT = 0;
export const UP = 1;
export const LEFT = 2;
export const DOWN = 3;

/** The pace for this bag. Bulky things (the ones that take points away) slow
 *  the figure, which is the lesson: they cost time as well as room. */
export function speedFor(packed: string[], rules: DrillRules = CLASSIC): number {
  const bulky = packed.filter((id) => (rules.items.find((item) => item.id === id)?.weight ?? 0) < 0).length;
  return SPEED * rules.pace * Math.max(SLOWEST, 1 - rules.bulkyCost * bulky);
}

/** How far sideways the figure is eased to slip round a corner it clips. */
const SLIDE = 0.3;

/** The smallest sideways shift, up to SLIDE, that would let a blocked move of
 *  (dx, dy) along one axis go through, or 0 when none does. */
function clearance(x: number, y: number, dx: number, dy: number, closed?: Closed): number {
  for (let shift = 0.05; shift <= SLIDE + 1e-9; shift += 0.05) {
    for (const side of [shift, -shift]) {
      const ox = dx === 0 ? side : 0;
      const oy = dx === 0 ? 0 : side;
      if (!blocked(x + ox, y + oy, closed) && !blocked(x + ox + dx, y + oy + dy, closed)) return side;
    }
  }
  return 0;
}

/** Move towards a sideways shift, no faster than the figure is walking. */
const ease = (shift: number, move: number): number => Math.sign(shift) * Math.min(Math.abs(shift), Math.abs(move));

/** One move. The stick (sx, sy) is at most one long. Each axis moves on its
 *  own, so the figure slides along a wall rather than sticking to it, and a
 *  move straight into the corner of something eases round it. */
export function step(x: number, y: number, sx: number, sy: number, dt: number, speed: number, closed?: Closed) {
  const length = Math.max(1, Math.hypot(sx, sy));
  const dx = (sx / length) * speed * dt;
  const dy = (sy / length) * speed * dt;
  let nextX = x;
  let nextY = y;
  if (dx !== 0) {
    if (!blocked(x + dx, y, closed)) nextX = x + dx;
    else if (dy === 0) nextY = y + ease(clearance(x, y, dx, 0, closed), dx);
  }
  if (dy !== 0) {
    if (!blocked(nextX, y + dy, closed)) nextY = y + dy;
    else if (dx === 0) nextX = x + ease(clearance(x, y, 0, dy, closed), dy);
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
export function nearestItem(x: number, y: number, packed: string[], rules: DrillRules = CLASSIC): DrillItem | null {
  let nearest: DrillItem | null = null;
  let nearestDistance = REACH;
  for (const item of rules.items) {
    const distance = Math.hypot(item.x - x, item.y - y);
    if (distance <= nearestDistance && !packed.includes(item.id)) {
      nearest = item;
      nearestDistance = distance;
    }
  }
  return nearest;
}

/** How thick the smoke and the dark are, 0 to 1, as the time runs. With the
 *  power out the dark starts deep and only grows, and smoke arrives before
 *  flame. Neither is ever total: the game stays playable. */
export function haze(elapsed: number, seconds: number, light: Light = CLASSIC.light) {
  const progress = Math.min(1, Math.max(0, elapsed / seconds));
  return { smoke: light.smoke[0] + light.smoke[1] * progress, dark: light.dark[0] + light.dark[1] * progress };
}
