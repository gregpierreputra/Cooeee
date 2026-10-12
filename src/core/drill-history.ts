// E9 — the pack page's record of its own drills, newest first, in the
// debrief's own words.

import * as copy from './copy';
import { debriefRows, kindOf, leftBehind, type ScoreGroup } from './drill-score';
import { rulesFor } from './drill-twists';
import { formatSavedDate } from './provenance';
import type { Drill } from './types';

/** One drill on the pack page. Worked out from the packed items alone, with
 *  the debrief's own rules: the score and its verdict when the drill reached
 *  the door, the bag as pictures, the essentials in it and left behind, and
 *  the things that cost points. Away from the door there is no number. */
export type DrillRow = {
  id: string;
  date: string;
  /** The twist's name, or null for the classic drill. */
  twist: string | null;
  score: number | null;
  verdict: string | null;
  essentials: string;
  leftBehind: string[];
  costYou: string[];
  /** `points` only for a drill that reached the door, as on the debrief. */
  bag: { id: string; name: string; why: string; kind: ScoreGroup['kind']; points: string | null }[];
};

/** Each drill is read under its own twist, so a row says what that drill's
 *  debrief said, whatever twist is on today. */
export const drillRows = (drills: Drill[]): DrillRow[] =>
  [...drills]
    .sort((a, b) => b.finishedAt - a.finishedAt)
    .map((drill) => {
      const rules = rulesFor(drill.twist ?? 'classic');
      const rows = debriefRows(drill.packed, rules);
      return {
        id: drill.id,
        date: formatSavedDate(drill.finishedAt),
        twist: rules.twist === 'classic' ? null : rules.name,
        score: drill.reachedDoor ? drill.score : null,
        verdict: drill.reachedDoor ? copy.VERDICT(drill.score) : null,
        essentials: copy.DRILL_ROW_ESSENTIALS(
          rows.filter(({ item }) => kindOf(item.weight) === 'essential').length,
          rules.reachable.filter((item) => kindOf(item.weight) === 'essential').length,
        ),
        leftBehind: leftBehind(drill.packed, rules).map((item) => item.name),
        costYou: rows.filter(({ effect }) => effect === 'took').map(({ item }) => item.name),
        bag: rows.map(({ item }) => ({
          id: item.id,
          name: item.name,
          why: item.why,
          kind: kindOf(item.weight),
          points: drill.reachedDoor ? copy.SIGNED_POINTS(item.weight) : null,
        })),
      };
    });

/** The highest score among the drills that reached the door, or null when
 *  none has. A drill that ended away from the door has no score to compare. */
export const highestScore = (drills: Drill[]): number | null => {
  const scores = drills.filter((drill) => drill.reachedDoor).map((drill) => drill.score);
  return scores.length === 0 ? null : Math.max(...scores);
};

/** The highest score among drills played under this twist. Scores under two
 *  twists are out of different bags, so they are never compared. */
export const highestForTwist = (drills: Drill[], twist: string): number | null =>
  highestScore(drills.filter((drill) => (drill.twist ?? 'classic') === twist));

