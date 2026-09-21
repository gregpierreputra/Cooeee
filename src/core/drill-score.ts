// E7 — the drill's score and the debrief that explains it.
//
// THIS FILE HAS A NUMBER IN IT, ON PURPOSE. The rehearsal (E5) never scores,
// and E5-US2-AC2 keeps that rule for the rehearsal alone. The drill is a game
// played before it, and the team chose (18 September 2026) that a game may say
// how ready a bag was, out of 100. The number is about the BAG, never about the
// person, and it is built only from what was packed.

import { BAG_LIMIT, DRILL_ITEMS, itemById, type DrillItem } from './drill-items';

export type DebriefRow = { item: DrillItem; effect: 'added' | 'took' | 'nothing' };

/** The score for a bag: the weights added up, held between 0 and 100. */
export function scoreDrill(packedIds: string[]): number {
  const total = packedIds
    .slice(0, BAG_LIMIT)
    .reduce((sum, id) => sum + (itemById(id)?.weight ?? 0), 0);
  return Math.max(0, Math.min(100, Math.round(total)));
}

/** One row per packed item, in the order they were packed. */
export const debriefRows = (packedIds: string[]): DebriefRow[] =>
  packedIds.flatMap((id) => {
    const item = itemById(id);
    if (!item) return [];
    const effect = item.weight > 0 ? 'added' : item.weight < 0 ? 'took' : 'nothing';
    return [{ item, effect }];
  });

/** A bag of a full ten of the heaviest essentials is exactly 100. Exported so
 *  the test can hold the item table to that promise. */
export const topTenTotal = (): number =>
  [...DRILL_ITEMS]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, BAG_LIMIT)
    .reduce((sum, item) => sum + item.weight, 0);

/** Every essential (the heaviest weight) that stayed in the house, for the
 *  debrief: what was packed is only half of the lesson. */
export const leftBehind = (packedIds: string[]): DrillItem[] => {
  const heaviest = Math.max(...DRILL_ITEMS.map((item) => item.weight));
  return DRILL_ITEMS.filter((item) => item.weight === heaviest && !packedIds.includes(item.id));
};

export type ScoreGroup = {
  kind: 'essential' | 'listed' | 'neutral' | 'bulky';
  items: DrillItem[];
  /** The points this group added (or took away). */
  points: number;
};

/** The bag sorted into what counted and how much: the "why" behind the score.
 *  Every group is returned, empty ones too, so the debrief can say "0 of 10". */
/** Which kind a thing is, from its points: the colour it wears on the debrief. */
export const kindOf = (weight: number): ScoreGroup['kind'] =>
  weight >= 10 ? 'essential' : weight > 0 ? 'listed' : weight < 0 ? 'bulky' : 'neutral';

export function scoreBreakdown(packedIds: string[]): ScoreGroup[] {
  const groups: ScoreGroup[] = (['essential', 'listed', 'neutral', 'bulky'] as const).map((kind) => ({ kind, items: [], points: 0 }));
  for (const { item } of debriefRows(packedIds.slice(0, BAG_LIMIT))) {
    const group = groups.find((candidate) => candidate.kind === kindOf(item.weight))!;
    group.items.push(item);
    group.points += item.weight;
  }
  return groups;
}

/** How many essentials the house holds in all. */
export const ESSENTIAL_COUNT = DRILL_ITEMS.filter((item) => item.weight >= 10).length;
