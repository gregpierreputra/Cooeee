// E9 — the drill's score and the debrief that explains it.
//
// THIS FILE HAS A NUMBER IN IT, ON PURPOSE. The rehearsal (E5) never scores,
// and E5-US2-AC2 keeps that rule for the rehearsal alone. The drill is a game
// played before it, and the team chose (18 September 2026) that a game may say
// how ready a bag was, out of 100. The number is about the BAG, never about the
// person, and it is built only from what was packed.

import { BAG_LIMIT, DRILL_ITEMS, type DrillItem } from './drill-items';
import { CLASSIC, type DrillRules } from './drill-twists';

export type DebriefRow = { item: DrillItem; effect: 'added' | 'took' | 'nothing' };

/** A thing as this drill's twist has it: its weight and place. */
const itemIn = (rules: DrillRules, id: string): DrillItem | undefined => rules.items.find((item) => item.id === id);

/** The score for a bag: the weights added up, out of the best bag the twist
 *  allows, held between 0 and 100. In the classic drill the best bag is
 *  exactly 100 points, so the score is the plain sum. */
export function scoreDrill(packedIds: string[], rules: DrillRules = CLASSIC): number {
  const total = packedIds
    .slice(0, rules.bagLimit)
    .reduce((sum, id) => sum + (itemIn(rules, id)?.weight ?? 0), 0);
  const score = rules.maxPoints > 0 ? (100 * total) / rules.maxPoints : 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/** One row per packed item, in the order they were packed. */
export const debriefRows = (packedIds: string[], rules: DrillRules = CLASSIC): DebriefRow[] =>
  packedIds.flatMap((id) => {
    const item = itemIn(rules, id);
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

export type ScoreGroup = {
  kind: 'essential' | 'listed' | 'neutral' | 'bulky';
  items: DrillItem[];
  /** The points this group added (or took away). */
  points: number;
};

/** Which kind a thing is, from its points: the colour it wears on the debrief. */
export const kindOf = (weight: number): ScoreGroup['kind'] =>
  weight >= 10 ? 'essential' : weight > 0 ? 'listed' : weight < 0 ? 'bulky' : 'neutral';

/** Every essential that stayed in the house and could have been reached, for
 *  the debrief: what was packed is only half of the lesson. A thing behind a
 *  shut door is not counted against the bag. */
export const leftBehind = (packedIds: string[], rules: DrillRules = CLASSIC): DrillItem[] =>
  rules.reachable.filter((item) => kindOf(item.weight) === 'essential' && !packedIds.includes(item.id));

/** The bag sorted into what counted and how much: the "why" behind the score.
 *  Every group is returned, empty ones too, so the debrief can say "0 of 10". */
export function scoreBreakdown(packedIds: string[], rules: DrillRules = CLASSIC): ScoreGroup[] {
  const groups: ScoreGroup[] = (['essential', 'listed', 'neutral', 'bulky'] as const).map((kind) => ({ kind, items: [], points: 0 }));
  for (const { item } of debriefRows(packedIds.slice(0, rules.bagLimit), rules)) {
    const group = groups.find((candidate) => candidate.kind === kindOf(item.weight))!;
    group.items.push(item);
    group.points += item.weight;
  }
  return groups;
}
