// E5-US1-AC5 — how a rehearsal ended, and who says so.
//
// Every rehearsal ends one of two ways, and the reader chooses which: walked, or
// not walked, a dry run. The app never decides for her. A rehearsal she did not
// come back to stays unfinished rather than being guessed at, and returning to it
// asks. A rehearsal recorded before the endings existed carries none, and is
// reported as not recorded: never defaulted to either ending.

import * as copy from './copy';
import { formatSavedDate } from './provenance';
import { conditionWithout } from './rehearsal-condition';
import type { RehearsalRun } from './rehearsal-run';
import type { Rehearsal, RehearsalEnding, StoredRehearsal, UnfinishedRehearsal } from './types';

/** The two endings, in a fixed order. The order is presentation only: nothing
 *  here or on the screen treats one as the better answer. */
export const REHEARSAL_ENDINGS: readonly RehearsalEnding[] = ['walked', 'dry-run'];

/** Whether a value is one of the two endings. Guards what is read back from the
 *  device, so a stored value that is not an ending is not taken for one. */
export const isRehearsalEnding = (value: unknown): value is RehearsalEnding =>
  typeof value === 'string' && (REHEARSAL_ENDINGS as readonly string[]).includes(value);

/** Whether a stored row is a rehearsal still waiting for its ending. */
export const isUnfinished = (row: StoredRehearsal): row is UnfinishedRehearsal =>
  row.finishedAt === undefined;

/** The row kept the moment a run starts: which pack, which condition, when, and
 *  nothing that would claim it ended. */
export const unfinishedFrom = (run: RehearsalRun): UnfinishedRehearsal => ({
  id: run.id,
  packId: run.packId,
  condition: run.condition,
  startedAt: run.startedAt,
});

/** One answer as the screen offers it. There is no selected field, so nothing
 *  can be chosen for her. */
export type EndingRow = { ending: RehearsalEnding; label: string; detail: string };

const ENDING_COPY: Record<RehearsalEnding, { label: string; detail: string }> = {
  walked: { label: copy.ENDING_WALKED, detail: copy.ENDING_WALKED_DETAIL },
  'dry-run': { label: copy.ENDING_DRY_RUN, detail: copy.ENDING_DRY_RUN_DETAIL },
};

export const endingRows = (): EndingRow[] =>
  REHEARSAL_ENDINGS.map((ending) => ({ ending, ...ENDING_COPY[ending] }));

/** What returning to an unfinished rehearsal asks. */
export type UnfinishedView = { heading: string; detail: string; rows: EndingRow[] };

export const unfinishedView = (unfinished: UnfinishedRehearsal): UnfinishedView => ({
  heading: copy.UNFINISHED_HEADING,
  detail: copy.UNFINISHED_DETAIL(
    conditionWithout(unfinished.condition),
    formatSavedDate(unfinished.startedAt),
  ),
  rows: endingRows(),
});

/** The ending a finished rehearsal had. Three answers, and the third is not a
 *  polite version of either of the others: not knowing is its own state, the
 *  same shape as the pack change in rehearsal-progress.ts. */
export type Ending = { state: 'walked' } | { state: 'dry-run' } | { state: 'not-recorded' };

export function endingOf(rehearsal: Rehearsal): Ending {
  return isRehearsalEnding(rehearsal.ending)
    ? { state: rehearsal.ending }
    : { state: 'not-recorded' };
}

/** The two endings as the journey screen offers them while the rehearsal runs,
 *  in the present and in her words. The question asked after a cold start names
 *  the same two endings looking back (endingRows). */
export type JourneyEndingRow = { ending: RehearsalEnding; label: string };

const JOURNEY_ENDING_LABEL: Record<RehearsalEnding, string> = {
  walked: copy.ENDING_ARRIVED,
  'dry-run': copy.ENDING_WITHOUT_GOING,
};

export const journeyEndingRows = (): JourneyEndingRow[] =>
  REHEARSAL_ENDINGS.map((ending) => ({ ending, label: JOURNEY_ENDING_LABEL[ending] }));

/** What an ending adds to the record: the ending she gave, the moment she gave
 *  it, and — on a walked rehearsal only — the time between its start and that
 *  moment. The time is carried exactly as it is: not rounded, rated, compared or
 *  checked against anything. A dry run keeps no time. */
export type EndingRecord = { finishedAt: number; ending: RehearsalEnding; elapsedMs?: number };

export function endingRecord(
  startedAt: number,
  ending: RehearsalEnding,
  endedAt: number,
): EndingRecord {
  return ending === 'walked'
    ? { finishedAt: endedAt, ending, elapsedMs: endedAt - startedAt }
    : { finishedAt: endedAt, ending };
}

/** How an ending is stated. */
export function endingLine(ending: Ending): string {
  switch (ending.state) {
    case 'walked':
      return copy.ENDING_WALKED;
    case 'dry-run':
      return copy.ENDING_DRY_RUN;
    case 'not-recorded':
      return copy.ENDING_NOT_RECORDED;
  }
}
