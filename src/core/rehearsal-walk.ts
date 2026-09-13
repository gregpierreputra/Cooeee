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
// scores or grades, and nothing names a hazard the pack does not hold.
//
// A line that holds shows the thing, not only a claim about it: its value from
// the pack, above the sentence (amended 14 September 2026). Every value comes
// from the renderer that already states it elsewhere in the app, so the reader
// never meets her own pack worded differently inside a rehearsal.

import { areaResultLine } from './area-check';
import * as copy from './copy';
import { placeName } from './destination';
import { publisherLine } from './provenance';
import { designationRows, detectGaps, hazardPlaces, provenanceItems } from './rehearsal-checks';
import { GAP_KIND, GAP_TITLE } from './rehearsal-actions';
import { conditionWithout, type RehearsalCondition } from './rehearsal-condition';
import { rehearsableHazards, type RehearsalHazard } from './rehearsal-entry';
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

/** One line on a step: what was looked for, what the pack holds for it, and a
 *  sentence saying whether it held. The sentence is what tells the two states
 *  apart. `state` exists for tests and keys, never for a colour. */
export type StepLine = {
  gapType: RehearsalGapType;
  state: StepLineState;
  title: string;
  /** What the pack holds for this line, each already worded by the renderer the
   *  rest of the app uses. Empty on a gap, so a gap has no empty slot, and always
   *  empty for live direction and distance. */
  values: string[];
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
    : copy.STEP_HELD_CONDITION(conditionWithout(condition));

/** What a held line shows, taken from the very rows its check decided on.
 *
 *  - The designation as the area check states it. Only a BPA row is ever built,
 *    and the area check states BPA alone. A designation held by another code has
 *    no existing wording, so it shows no value rather than new words.
 *  - The publisher and saved date through the shared provenance line, once for
 *    each distinct line, since the check covers every stored item.
 *  - The places as the destinations list names them, in the order it listed them.
 *  - Live direction and distance shows nothing. A real value needs a position,
 *    and a rehearsal never asks for one. */
function heldValues(
  gapType: RehearsalGapType,
  content: CompletePackContent,
  hazards: readonly RehearsalHazard[],
): string[] {
  switch (gapType) {
    case 'designation-missing':
      return designationRows(content)
        .filter((row) => row.code === 'BPA')
        .map((row) => areaResultLine(row.status));
    case 'provenance-missing':
      return [
        ...new Set(
          hazards
            .flatMap((hazard) => provenanceItems(content, hazard))
            .map((row) => publisherLine(row.source)),
        ),
      ];
    case 'places-missing':
      return hazards
        .flatMap((hazard) => hazardPlaces(content, hazard))
        .sort((a, b) => (a.distanceOrder ?? 0) - (b.distanceOrder ?? 0))
        .map((place) => placeName(place));
    case 'live-direction-unavailable':
      return [];
  }
}

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
  const hazards = rehearsableHazards(content);
  const bushfire = hazards.includes('bushfire');
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
        values: isGap ? [] : heldValues(gapType, content, hazards),
        statement: isGap ? GAP_STATEMENT[kind] : heldStatement(kind, condition),
      };
    }),
  };
}
