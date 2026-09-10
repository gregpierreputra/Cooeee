// E5-US2-AC1 — what the result screen renders, decided here.
//
// THERE IS NO NUMBER IN THIS FILE. No total, no count, no percentage, no score,
// no grade, no pass, no fail, no verdict — and no field on any type below that
// one could be put in later without being noticed. A rehearsal says what the
// reader could not rely on and what to do about each of those things. It does
// not mark their work.

import * as copy from './copy';
import { conditionLabel } from './rehearsal-condition';
import { actionFor } from './rehearsal-actions';
import type { DetectedGap, Rehearsal, RehearsalGapKind, RehearsalGapType } from './types';

/** One gap as the screen states it: what could not be relied on, which of the
 *  two kinds it is, whose journey it belongs to, and the one thing to do. */
export type GapRow = {
  gapType: RehearsalGapType;
  kind: RehearsalGapKind;
  hazardLine: string;
  title: string;
  meaning: string;
  action: string;
  /** Carried for the change that lets the reader mark the action done. */
  actionId: string;
};

export type RehearsalResult =
  | { state: 'gaps'; conditionLine: string; rows: GapRow[] }
  /** Its own designed screen, never an empty list. Only reachable after a
   *  no-data run on a complete pack: under no location fix the contingency gap
   *  always fires, so that condition can never produce this state. */
  | { state: 'no-gaps'; conditionLine: string; heading: string; detail: string };

const rowFor = (detected: DetectedGap): GapRow => {
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
  };
};

/** The result of one finished rehearsal.
 *
 *  Reads the stored run rather than re-checking, so what the reader sees is
 *  what the run actually found, and reopening it later cannot quietly produce a
 *  different answer than the one that was recorded. */
export function rehearsalResult(rehearsal: Rehearsal): RehearsalResult {
  const label = conditionLabel(rehearsal.condition);
  const conditionLine = copy.RESULT_CONDITION_LINE(label);

  if (rehearsal.gaps.length === 0) {
    return {
      state: 'no-gaps',
      conditionLine,
      heading: copy.NO_GAPS_HEADING,
      detail: copy.NO_GAPS_DETAIL(label),
    };
  }

  return { state: 'gaps', conditionLine, rows: rehearsal.gaps.map(rowFor) };
}
