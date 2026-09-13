// E5-US2-AC1 — what the result screen renders, decided here.
//
// THERE IS NO NUMBER IN THIS FILE. No total, no count, no percentage, no score,
// no grade, no pass, no fail, no verdict — and no field on any type below that
// one could be put in later without being noticed. A rehearsal says what the
// reader could not rely on and what to do about each of those things. It does
// not mark their work.

import * as copy from './copy';
import { conditionWithout } from './rehearsal-condition';
import { actionFor } from './rehearsal-actions';
import { formatSavedDate } from './provenance';
import type {
  ActionCompletion,
  DetectedGap,
  Rehearsal,
  RehearsalGapKind,
  RehearsalGapType,
} from './types';

/** One gap as the screen states it: what could not be relied on, which of the
 *  two kinds it is, whose journey it belongs to, and the one thing to do. */
export type GapRow = {
  gapType: RehearsalGapType;
  kind: RehearsalGapKind;
  hazardLine: string;
  title: string;
  meaning: string;
  action: string;
  actionId: string;
  /** The date the reader marked this action done, already written the way every
   *  date in this product is written, or null when they have not.
   *
   *  ONE field, not a boolean beside a date: a row cannot then say it is done
   *  while holding no date to say it with, which is what a completion that
   *  never stored would look like. */
  doneOn: string | null;
};

export type RehearsalResult =
  | { state: 'gaps'; conditionLine: string; rows: GapRow[] }
  /** Its own designed screen, never an empty list. Only reachable after a
   *  no-data run on a complete pack: under no location fix the contingency gap
   *  always fires, so that condition can never produce this state. */
  | { state: 'no-gaps'; conditionLine: string; heading: string; detail: string };

const rowFor = (detected: DetectedGap, doneAt: number | undefined): GapRow => {
  const action = actionFor(detected);
  return {
    gapType: detected.gapType,
    kind: detected.kind,
    // The hazard is one of two named values, so the map is total over it and
    // there is no fallback to reach for.
    hazardLine: copy.GAP_HAZARD_LINE(copy.HAZARD_NAME[detected.hazard]),
    title: action.title,
    meaning: action.meaning,
    action: action.action,
    actionId: action.actionId,
    doneOn: doneAt === undefined ? null : formatSavedDate(doneAt),
  };
};

/** The result of one finished rehearsal.
 *
 *  Reads the stored run rather than re-checking, so what the reader sees is
 *  what the run actually found, and reopening it later cannot quietly produce a
 *  different answer than the one that was recorded. */
export function rehearsalResult(
  rehearsal: Rehearsal,
  /** What the reader has already marked against this pack. Completions belong to
   *  the pack rather than to the run, so a run finds the ones made before it. */
  completions: readonly ActionCompletion[] = [],
): RehearsalResult {
  const without = conditionWithout(rehearsal.condition);
  const conditionLine = copy.RESULT_CONDITION_LINE(without);

  if (rehearsal.gaps.length === 0) {
    return {
      state: 'no-gaps',
      conditionLine,
      heading: copy.NO_GAPS_HEADING,
      detail: copy.NO_GAPS_DETAIL(without),
    };
  }

  // Only completions for THIS pack count: a completion is identified by the
  // pack it was made against, and one pack's record says nothing about another.
  const doneAt = new Map(
    completions
      .filter((row) => row.packId === rehearsal.packId)
      .map((row) => [row.actionId, row.doneAt]),
  );

  return {
    state: 'gaps',
    conditionLine,
    rows: rehearsal.gaps.map((detected) =>
      rowFor(detected, doneAt.get(actionFor(detected).actionId)),
    ),
  };
}
