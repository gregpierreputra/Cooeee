// E7 — the pack page's record of its own drills, newest first, in the
// debrief's own words.

import * as copy from './copy';
import { formatSavedDate } from './provenance';
import type { Drill } from './types';

export type DrillRow = { id: string; date: string; outcome: string; packed: string };

export const drillRows = (drills: Drill[]): DrillRow[] =>
  [...drills]
    .sort((a, b) => b.finishedAt - a.finishedAt)
    .map((drill) => ({
      id: drill.id,
      date: formatSavedDate(drill.finishedAt),
      outcome: drill.reachedDoor ? copy.DRILL_ROW_DOOR(drill.score) : copy.DRILL_ROW_AWAY,
      packed: copy.DRILL_ROW_PACKED(drill.packed.length),
    }));

/** The highest score among the drills that reached the door, or null when
 *  none has. A drill that ended away from the door has no score to compare. */
export const highestScore = (drills: Drill[]): number | null => {
  const scores = drills.filter((drill) => drill.reachedDoor).map((drill) => drill.score);
  return scores.length === 0 ? null : Math.max(...scores);
};
