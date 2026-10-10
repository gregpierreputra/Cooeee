// E9 — the pack page's record of its own drills, newest first, in the
// debrief's own words.

import * as copy from './copy';
import { DRILL_ITEMS } from './drill-items';
import { debriefRows, kindOf, leftBehind } from './drill-score';
import { formatSavedDate } from './provenance';
import type { Drill } from './types';

/** One drill on the pack page. Worked out from the packed items alone, with
 *  the debrief's own rules: the essentials in the bag, the essentials left in
 *  the house, the things that cost points, and every thing packed. */
export type DrillRow = {
  id: string;
  date: string;
  outcome: string;
  packed: string;
  essentials: string;
  leftBehind: string[];
  costYou: string[];
  items: string[];
};

const ESSENTIALS_TOTAL = DRILL_ITEMS.filter((item) => kindOf(item.weight) === 'essential').length;

export const drillRows = (drills: Drill[]): DrillRow[] =>
  [...drills]
    .sort((a, b) => b.finishedAt - a.finishedAt)
    .map((drill) => ({
      id: drill.id,
      date: formatSavedDate(drill.finishedAt),
      outcome: drill.reachedDoor ? copy.DRILL_ROW_DOOR(drill.score) : copy.DRILL_ROW_AWAY,
      packed: copy.DRILL_ROW_PACKED(drill.packed.length),
      essentials: copy.DRILL_ROW_ESSENTIALS(
        debriefRows(drill.packed).filter(({ item }) => kindOf(item.weight) === 'essential').length,
        ESSENTIALS_TOTAL,
      ),
      leftBehind: leftBehind(drill.packed).map((item) => item.name),
      costYou: debriefRows(drill.packed).filter(({ effect }) => effect === 'took').map(({ item }) => item.name),
      items: debriefRows(drill.packed).map(({ item }) => item.name),
    }));

/** The highest score among the drills that reached the door, or null when
 *  none has. A drill that ended away from the door has no score to compare. */
export const highestScore = (drills: Drill[]): number | null => {
  const scores = drills.filter((drill) => drill.reachedDoor).map((drill) => drill.score);
  return scores.length === 0 ? null : Math.max(...scores);
};
