// E5-US1-AC2 / E5-US1-AC3 — what a running rehearsal is, and what marks it.
//
// A rehearsal must never be mistaken for the real thing, so every screen of a
// run carries a bar saying it is a rehearsal and what is being rehearsed
// without (decision D-C, 10 September). Both facts are carried as WORDS: a
// colour, a tint or an icon would say nothing to a reader who cannot see it,
// and nothing at all in greyscale.
//
// Nothing here is stored. A run is a value held in memory for as long as the
// page is open, which is what makes an interrupted rehearsal impossible to
// mistake for a live one: a restart has nothing to find.

import { conditionLabel, type RehearsalCondition } from './rehearsal-condition';
import * as copy from './copy';

/** A rehearsal in progress: the pack it runs against, the one condition it runs
 *  under, and the identity it WOULD be recorded under if it finishes.
 *
 *  The id and the start time live here, in memory, and are written only as part
 *  of the finished record. Nothing about a run in progress is stored, so a run
 *  that is interrupted takes its id and its start time with it and leaves
 *  nothing behind (E5-US1-AC3). There is no progress field, and there must not
 *  be one: progress that outlived the page would be a partial result. */
export type RehearsalRun = {
  /** The id this run will be recorded under IF it finishes. Made when the run
   *  starts and kept in memory: it identifies the run, not a stored row, and a
   *  run that is interrupted takes it with it. */
  id: string;
  packId: string;
  condition: RehearsalCondition;
  /** When the user chose the condition. Held here and written only with the
   *  finished record, never on its own. */
  startedAt: number;
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
