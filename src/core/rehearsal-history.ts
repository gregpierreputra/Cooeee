// E5-US5 — the pack page's record of its own rehearsals.
//
// Every finished rehearsal of this pack, newest first, each stated in the
// words the result used: when, without what, how it ended, and how many gaps
// it found. A list, not a ledger: no total, no trend, no verdict, and the
// order is the order in time, never the order of outcome.

import * as copy from './copy';
import { conditionLabel } from './rehearsal-condition';
import { endingLine, endingOf } from './rehearsal-ending';
import { formatSavedDate } from './provenance';
import type { Rehearsal } from './types';

export type HistoryRow = { id: string; date: string; condition: string; ending: string; gaps: string };

export function historyRows(rehearsals: Rehearsal[]): HistoryRow[] {
  return [...rehearsals]
    .sort((a, b) => b.finishedAt - a.finishedAt)
    .map((rehearsal) => ({
      id: rehearsal.id,
      date: formatSavedDate(rehearsal.finishedAt),
      condition: conditionLabel(rehearsal.condition),
      ending: endingLine(endingOf(rehearsal)),
      gaps: copy.HISTORY_GAPS(rehearsal.gaps.length),
    }));
}
