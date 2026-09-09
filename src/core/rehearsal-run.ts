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

/** A rehearsal in progress: the pack it runs against, and the one condition it
 *  runs under. There is no id, no started-at and no progress field, because
 *  nothing about a run outlives the page it runs on. */
export type RehearsalRun = {
  packId: string;
  condition: RehearsalCondition;
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
