// E5-US1-AC2 / E5-US1-AC3 — what a running rehearsal is, and what marks it.
//
// A rehearsal must never be mistaken for the real thing, so every screen of a
// run carries a bar saying it is a rehearsal and what is being rehearsed
// without (decision D-C, 10 September). Both facts are carried as WORDS: a
// colour, a tint or an icon would say nothing to a reader who cannot see it,
// and nothing at all in greyscale.
//
// A run is held in memory for as long as the page is open. Since E5-US1-AC5 the
// rehearsal it belongs to is ALSO kept on the device from the moment it starts,
// as an unfinished rehearsal (rehearsal-ending.ts), so a cold start finds it and
// asks how it ended. What is never kept is where the run was on screen: a cold
// start resumes no screen and shows no partial result.

import { conditionLabel, type RehearsalCondition } from './rehearsal-condition';
import * as copy from './copy';
import type { RehearsalEnding } from './types';

/** A rehearsal in progress: the pack it runs against, the one condition it runs
 *  under, and the identity it is recorded under.
 *
 *  There is no progress field, and there must not be one: progress that outlived
 *  the page would be a partial result. */
export type RehearsalRun = {
  /** The id the rehearsal is kept under, from its start to its finish. The row
   *  its start writes and the row its finish writes are the same row. */
  id: string;
  packId: string;
  condition: RehearsalCondition;
  /** When the user chose the condition. */
  startedAt: number;
  /** The ending the reader gave, once she has given one. Present only on a run
   *  resumed from an unfinished rehearsal by her answer, and recorded with the
   *  finished rehearsal. Never filled in by the app. */
  ending?: RehearsalEnding;
};

/** What the bar states, as two separate strings.
 *
 *  Two rather than one sentence so neither half can be dropped in favour of a
 *  colour or an icon, and so a screen reader meets the marker and the condition
 *  as distinct pieces rather than one run-on line. */
export type BarParts = { marker: string; condition: string };

export const barParts = (run: RehearsalRun): BarParts => ({
  marker: copy.REHEARSAL_LABEL,
  condition: conditionLabel(run.condition),
});

/** Whether this run is the one belonging to the given pack.
 *
 *  A run is against one pack. Opening the rehearsal entry for a DIFFERENT pack
 *  while a run is in progress is not a resumption of it: that pack has no run,
 *  and the gate starts from the beginning for it. */
export const isRunFor = (run: RehearsalRun | null, packId: string): boolean =>
  run !== null && run.packId === packId;
