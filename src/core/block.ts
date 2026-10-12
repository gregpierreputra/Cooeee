// Ready the Block — the rules of the daily hazard hunt, kept apart from the
// screen so they can be tested without one. Each Melbourne day sets out eight
// fire risks round the same home, the same on every phone; three minutes to
// find them by tapping. The score is about the yard, never the person.

import { BLOCK_ATLAS } from './block-atlas';
import { BLOCK_DECOYS, BLOCK_HAZARDS, BLOCK_PICKS, type BlockHazard } from './block-hazards';
import { BLOCK_TILE } from './block-layout';
import { mulberry32, seedFrom, seededShuffle } from './seeded';
import type { BlockPlay } from './types';

export const BLOCK_SECONDS = 180;
/** A tap on a harmless thing, or on a risk already dealt with, costs this. */
export const WRONG_TAP_COST = 4;
/** A hint costs this, and there are only so many. */
export const HINT_COST = 10;
export const HINT_LIMIT = 3;
/** No more than this many of a day's risks in one part of the yard. */
const ZONE_CAP = 3;

/** The day's eight risks: a shuffle of all forty, taken in order while no
 *  part of the yard has more than three. */
export function hazardsForDay(day: number): BlockHazard[] {
  const picked: BlockHazard[] = [];
  const perZone = new Map<string, number>();
  for (const hazard of seededShuffle(BLOCK_HAZARDS, seedFrom('ready-the-block', day))) {
    const inZone = perZone.get(hazard.zone) ?? 0;
    if (inZone >= ZONE_CAP) continue;
    picked.push(hazard);
    perZone.set(hazard.zone, inZone + 1);
    if (picked.length === BLOCK_PICKS) break;
  }
  return picked;
}

/** A sprite's box in source pixels, standing with the middle of its bottom
 *  edge at (x, y) tiles, grown by `pad` pixels each way. */
export function boxOf(sprite: string, x: number, y: number, pad = 0) {
  const [, , w, h] = BLOCK_ATLAS[sprite];
  const cx = x * BLOCK_TILE;
  const bottom = y * BLOCK_TILE;
  return { x0: cx - w / 2 - pad, y0: bottom - h - pad, x1: cx + w / 2 + pad, y1: bottom + pad };
}

/** What a tap at (px, py), in source pixels, landed on. */
export type Hit =
  | { kind: 'hazard'; id: string }
  | { kind: 'again'; id: string }
  | { kind: 'cleared'; id: string }
  | { kind: 'decoy'; id: string }
  | { kind: 'nothing' };

/** What the yard holds for a day: each of its risks, and every other spot
 *  either dealt with (drawn as it looks once cleared) or empty, and the
 *  harmless things. */
export type Shown = { id: string; role: 'hazard' | 'cleared' | 'decoy'; sprite: string; x: number; y: number };

export function shownFor(hazards: BlockHazard[]): Shown[] {
  const today = new Set(hazards.map((hazard) => hazard.id));
  const shown: Shown[] = [];
  for (const hazard of BLOCK_HAZARDS) {
    if (today.has(hazard.id)) shown.push({ id: hazard.id, role: 'hazard', sprite: hazard.sprite, x: hazard.x, y: hazard.y });
    else if (hazard.cleared) shown.push({ id: hazard.id, role: 'cleared', sprite: hazard.cleared, x: hazard.x, y: hazard.y });
  }
  for (const decoy of BLOCK_DECOYS) shown.push({ id: decoy.id, role: 'decoy', sprite: decoy.sprite, x: decoy.x, y: decoy.y });
  return shown;
}

/** The tap is forgiving: a risk not yet found wins over anything else its
 *  padded box overlaps, and among equals the nearest middle wins. A tap on
 *  open ground is nothing, and costs nothing. */
export function hitTest(px: number, py: number, hazards: BlockHazard[], found: string[], pad: number): Hit {
  let best: { hit: Hit; rank: number; distance: number } | null = null;
  for (const thing of shownFor(hazards)) {
    const box = boxOf(thing.sprite, thing.x, thing.y, pad);
    if (px < box.x0 || px > box.x1 || py < box.y0 || py > box.y1) continue;
    const hit: Hit =
      thing.role === 'hazard' ? { kind: found.includes(thing.id) ? 'again' : 'hazard', id: thing.id } : { kind: thing.role, id: thing.id };
    const rank = hit.kind === 'hazard' ? 0 : hit.kind === 'again' ? 1 : 2;
    const distance = Math.hypot(px - (box.x0 + box.x1) / 2, py - (box.y0 + box.y1) / 2);
    if (!best || rank < best.rank || (rank === best.rank && distance < best.distance)) best = { hit, rank, distance };
  }
  return best?.hit ?? { kind: 'nothing' };
}

/** The score, out of 100: an even share for each risk found, less the cost of
 *  wrong taps and hints, held between 0 and 100. */
export function scoreBlock({ found, wrongTaps, hints }: { found: number; wrongTaps: number; hints: number }): number {
  const score = Math.round((100 * found) / BLOCK_PICKS) - WRONG_TAP_COST * wrongTaps - HINT_COST * hints;
  return Math.max(0, Math.min(100, score));
}

/** Where a hint points: a circle, in tiles, round one risk not yet found.
 *  The circle is wider than the thing and not centred on it, so it narrows
 *  the search without giving the answer away. */
export function hintFor(hazards: BlockHazard[], found: string[], day: number, count: number): { x: number; y: number; radius: number } | null {
  const left = hazards.filter((hazard) => !found.includes(hazard.id));
  if (left.length === 0) return null;
  const hazard = left[0];
  const random = mulberry32(seedFrom('block-hint', day, hazard.id, count));
  const angle = random() * Math.PI * 2;
  const [, , , h] = BLOCK_ATLAS[hazard.sprite];
  const middleY = hazard.y - h / BLOCK_TILE / 2;
  return { x: hazard.x + Math.cos(angle), y: middleY + Math.sin(angle), radius: 2.5 };
}

/** The highest score of any play, or null before the first. */
export const highestBlock = (plays: BlockPlay[]): number | null =>
  plays.length === 0 ? null : Math.max(...plays.map((play) => play.score));

/** What the game's card on the Rehearse screen says. */
export type BlockTileView = { today: number | null; highest: number | null };

export const blockTileView = (plays: BlockPlay[], today: number): BlockTileView => ({
  today: highestBlock(plays.filter((play) => play.day === today)),
  highest: highestBlock(plays),
});
