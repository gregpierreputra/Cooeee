// E9 — the pack page's record of its own drills, newest first, in the
// debrief's own words.

import * as copy from './copy';
import { DRILL_ITEMS } from './drill-items';
import { debriefRows, kindOf, leftBehind, type ScoreGroup } from './drill-score';
import { formatSavedDate } from './provenance';
import type { Drill } from './types';

/** One drill on the pack page. Worked out from the packed items alone, with
 *  the debrief's own rules: the score and its verdict when the drill reached
 *  the door, the bag as pictures, the essentials in it and left behind, and
 *  the things that cost points. Away from the door there is no number. */
export type DrillRow = {
  id: string;
  date: string;
  score: number | null;
  verdict: string | null;
  essentials: string;
  leftBehind: string[];
  costYou: string[];
  /** `points` only for a drill that reached the door, as on the debrief. */
  bag: { id: string; name: string; why: string; kind: ScoreGroup['kind']; points: string | null }[];
};

const ESSENTIALS_TOTAL = DRILL_ITEMS.filter((item) => kindOf(item.weight) === 'essential').length;

export const drillRows = (drills: Drill[]): DrillRow[] =>
  [...drills]
    .sort((a, b) => b.finishedAt - a.finishedAt)
    .map((drill) => ({
      id: drill.id,
      date: formatSavedDate(drill.finishedAt),
      score: drill.reachedDoor ? drill.score : null,
      verdict: drill.reachedDoor ? copy.VERDICT(drill.score) : null,
      essentials: copy.DRILL_ROW_ESSENTIALS(
        debriefRows(drill.packed).filter(({ item }) => kindOf(item.weight) === 'essential').length,
        ESSENTIALS_TOTAL,
      ),
      leftBehind: leftBehind(drill.packed).map((item) => item.name),
      costYou: debriefRows(drill.packed).filter(({ effect }) => effect === 'took').map(({ item }) => item.name),
      bag: debriefRows(drill.packed).map(({ item }) => ({
        id: item.id,
        name: item.name,
        why: item.why,
        kind: kindOf(item.weight),
        points: drill.reachedDoor ? copy.SIGNED_POINTS(item.weight) : null,
      })),
    }));

/** The highest score among the drills that reached the door, or null when
 *  none has. A drill that ended away from the door has no score to compare. */
export const highestScore = (drills: Drill[]): number | null => {
  const scores = drills.filter((drill) => drill.reachedDoor).map((drill) => drill.score);
  return scores.length === 0 ? null : Math.max(...scores);
};
