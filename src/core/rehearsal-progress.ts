// E5-US2-AC2 / AC3 / AC4 — what has moved since the last time this pack was
// rehearsed the same way.
//
// Decision D-E, 10 September: the comparison is against the most recent earlier
// rehearsal of the SAME pack under the SAME condition. Same condition matters —
// a no-data run and a no-location-fix run look for different things, so the
// difference between them is not progress, it is two different questions
// answered.
//
// THERE IS NO NUMBER HERE. No total, no count, no percentage, no score, no
// grade, no verdict, and no field below one could be put in. What changed is
// three lists of things, named; how many of them there are is not the reader's
// business and is certainly not their mark.
//
// ONE CONSEQUENCE OF HOW GAPS ARE FOUND, worth knowing before reading further:
// detectGaps is pure over (condition, content), and a pack's checked content
// never changes once it is committed. So two rehearsals of the SAME pack id
// under the same condition always find the same gaps, and the only thing that
// can have moved between them is what the reader has done. A newly detected gap
// can therefore only appear across a pack that was rebuilt — which is exactly
// the case AC4 annotates. The two are one mechanism, not two.

import * as copy from './copy';
import { formatSavedDate } from './provenance';
import type { GapRow } from './rehearsal-result';
import { rehearsalResult } from './rehearsal-result';
import type { ActionCompletion, DetectedGap, Rehearsal } from './types';

/** Whether the pack was the same on both runs. Three answers, and the third is
 *  not a polite version of the first: not knowing is its own state. */
export type PackChange =
  | { state: 'unchanged' }
  | { state: 'changed'; changedOn: string }
  | { state: 'indeterminate' };

export type Progress =
  /** AC3. Nothing to compare against yet. The result itself is unaffected: a
   *  first rehearsal is a whole result, not a partial one. */
  | { state: 'first' }
  | {
      state: 'compared';
      /** The earlier rehearsal, named by its date, as the criterion requires. */
      earlierOn: string;
      packChange: PackChange;
      newlyDetected: GapRow[];
      stillOpen: GapRow[];
      completedSince: GapRow[];
    };

const sameGap = (left: DetectedGap, right: DetectedGap) =>
  left.gapType === right.gapType && left.hazard === right.hazard;

/** The rehearsal this one is compared against: the most recent EARLIER run of
 *  the same pack under the same condition.
 *
 *  Same pack and same condition are both required, and a run is never compared
 *  with itself. Where several earlier runs qualify, the most recent is chosen:
 *  the reader is being shown what has moved lately, not since the beginning. */
export function comparableEarlier(
  all: readonly Rehearsal[],
  latest: Rehearsal,
): Rehearsal | null {
  return all
    .filter(
      (row) =>
        row.id !== latest.id &&
        row.packId === latest.packId &&
        row.condition === latest.condition &&
        row.finishedAt <= latest.finishedAt,
    )
    .reduce<Rehearsal | null>(
      (best, row) => (best === null || row.finishedAt > best.finishedAt ? row : best),
      null,
    );
}

/** Whether the pack changed between two runs, and when.
 *
 *  A rehearsal recorded before the pack's verified date was kept cannot answer
 *  this, and says so. It does NOT say "unchanged": "we cannot tell" and
 *  "nothing changed" are different statements, and substituting the second for
 *  the first is what shared rule 0.1 forbids. */
export function packChangeBetween(earlier: Rehearsal, latest: Rehearsal): PackChange {
  if (earlier.packVerifiedAt === undefined || latest.packVerifiedAt === undefined) {
    return { state: 'indeterminate' };
  }
  if (earlier.packVerifiedAt === latest.packVerifiedAt) return { state: 'unchanged' };
  return { state: 'changed', changedOn: formatSavedDate(latest.packVerifiedAt) };
}

/** What has moved since the last comparable rehearsal.
 *
 *  Three lists and a date. Nothing is summarised, because a summary of what
 *  someone has not done is a mark. */
export function rehearsalProgress(
  latest: Rehearsal,
  earlier: Rehearsal | null,
  completions: readonly ActionCompletion[],
): Progress {
  if (earlier === null) return { state: 'first' };

  const rows = rehearsalResult(latest, completions);
  const gapRows = rows.state === 'gaps' ? rows.rows : [];
  const doneAt = new Map(
    completions
      .filter((row) => row.packId === latest.packId)
      .map((row) => [row.actionId, row.doneAt]),
  );

  const newlyDetected = latest.gaps
    .map((gap, index) => ({ gap, row: gapRows[index] }))
    .filter(({ gap }) => !earlier.gaps.some((was) => sameGap(was, gap)))
    .map(({ row }) => row);

  // Done since the earlier run: the completion has to be newer than that run,
  // or the reader did it before and it is not news.
  const completedSince = gapRows.filter((row) => {
    const at = doneAt.get(row.actionId);
    return at !== undefined && at > earlier.finishedAt;
  });

  const stillOpen = gapRows.filter((row) => doneAt.get(row.actionId) === undefined);

  return {
    state: 'compared',
    earlierOn: copy.EARLIER_REHEARSAL_ON(formatSavedDate(earlier.finishedAt)),
    packChange: packChangeBetween(earlier, latest),
    newlyDetected,
    stillOpen,
    completedSince,
  };
}
