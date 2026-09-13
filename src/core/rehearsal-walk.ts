// E5-US1-AC5 — the rehearsal walks the journey before it says what it found.
//
// Two steps, in this order, and no others: the pack, then BlackSky. The four gap
// types split across exactly those two screens, because those are the two
// screens whose own constants state them (the criterion's table). Each step says
// in words, line by line, what held and what did not under the chosen condition.
//
// A step decides nothing of its own. It reads the same detectGaps() the result
// reads, so a line cannot say "held" on the walk and then appear as a gap on the
// result, or the other way round. Like the result, nothing here counts, totals,
// scores or grades, and nothing names a hazard.

import * as copy from './copy';
import { detectGaps } from './rehearsal-checks';
import { GAP_KIND, GAP_TITLE } from './rehearsal-actions';
import { conditionLabel, type RehearsalCondition } from './rehearsal-condition';
import { rehearsableHazards } from './rehearsal-entry';
import type { CompletePackContent, RehearsalGapKind, RehearsalGapType } from './types';

export type WalkStep = 'pack' | 'blacksky';

/** Where a running rehearsal is: on one of the two steps, or past both at the
 *  result. There is no other place to be, and no way to name one. */
export type WalkPosition = WalkStep | 'result';

export const WALK_STEPS: readonly WalkStep[] = ['pack', 'blacksky'];

/** Every run starts at the first step. */
export const WALK_START: WalkPosition = 'pack';

/** The one move a walk can make: forward by exactly one. There is no function
 *  that jumps, so the result is reachable only through both steps, and step 2
 *  only through step 1. The result is the end and stays the end. */
export const advanceWalk = (from: WalkPosition): WalkPosition =>
  from === 'pack' ? 'blacksky' : 'result';

/** Which checks each step states, in the order it states them. */
const STEP_CHECKS: Record<WalkStep, readonly RehearsalGapType[]> = {
  pack: ['designation-missing', 'provenance-missing'],
  blacksky: ['places-missing', 'live-direction-unavailable'],
};

/** The real screens' own headings, reused rather than restated. */
const STEP_HEADING: Record<WalkStep, string> = {
  pack: copy.YOUR_PACK,
  blacksky: copy.BLACKSKY_TITLE,
};

export type StepLineState = 'held' | 'gap';

/** One line on a step: what was looked for, and a sentence saying whether it
 *  held. The sentence is what tells the two states apart. `state` exists for
 *  tests and keys, never for a colour. */
export type StepLine = {
  gapType: RehearsalGapType;
  state: StepLineState;
  title: string;
  statement: string;
};

export type WalkStepView = {
  step: WalkStep;
  counter: string;
  heading: string;
  lines: StepLine[];
};

/** The gap sentences are the result's own. The condition kind uses the fact
 *  half alone: the action it would point to is on the result, not on a step. */
const GAP_STATEMENT: Record<RehearsalGapKind, string> = {
  'pack-content': copy.GAP_MEANING_PACK_CONTENT,
  'condition-persistent': copy.GAP_MEANING_CONDITION_FACT,
};

const heldStatement = (kind: RehearsalGapKind, condition: RehearsalCondition): string =>
  kind === 'pack-content'
    ? copy.STEP_HELD_PACK_CONTENT
    : copy.STEP_HELD_CONDITION(conditionLabel(condition));

/** What one step of the walk states, for this pack under this condition.
 *
 *  A check is stated only where the checks actually look for it. The designation
 *  is looked for on a bushfire journey alone (rehearsal-checks.ts), so a pack
 *  without bushfire content gets no designation line: "this information is in
 *  your pack" about something never looked for would be a claim with nothing
 *  behind it.
 *
 *  Same precondition as detectGaps(): only ever called for a pack the entry gate
 *  has passed. Pure, and reads only what it is handed. */
export function walkStep(
  step: WalkStep,
  condition: RehearsalCondition,
  content: CompletePackContent,
): WalkStepView {
  const found = new Set(detectGaps(condition, content).map((row) => row.gapType));
  const bushfire = rehearsableHazards(content).includes('bushfire');
  const checks = STEP_CHECKS[step].filter(
    (gapType) => gapType !== 'designation-missing' || bushfire,
  );

  return {
    step,
    counter: copy.STEP_OF(WALK_STEPS.indexOf(step) + 1, WALK_STEPS.length),
    heading: STEP_HEADING[step],
    lines: checks.map((gapType) => {
      const kind = GAP_KIND[gapType];
      const isGap = found.has(gapType);
      return {
        gapType,
        state: isGap ? 'gap' : 'held',
        title: GAP_TITLE[gapType],
        statement: isGap ? GAP_STATEMENT[kind] : heldStatement(kind, condition),
      };
    }),
  };
}
