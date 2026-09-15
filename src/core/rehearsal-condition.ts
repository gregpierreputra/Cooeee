// E5-US1-AC1 — the disruption a rehearsal runs under.
//
// A rehearsal is run without something, and the user says without what. Two
// conditions are supported (decision D-B, 9 September), and the SAME two
// whatever the pack holds: these are ways a phone fails, not ways a hazard
// behaves, so a heat pack and a bushfire pack offer the same pair.
//
// The set is fixed HERE, in code. It is not read from a pack, a snapshot or a
// feed, which is why this screen has no empty state: there is no source that
// could return nothing.

import * as copy from './copy';

/** The supported conditions. A rehearsal runs under exactly one of these, and
 *  the value is a single condition rather than a collection: there is no shape
 *  in this type for a second condition to occupy, so "never two" is a property
 *  of the model rather than something the screen has to keep checking. */
export type RehearsalCondition = 'no-data' | 'no-location-fix';

/** In a fixed order, so the list does not reshuffle between mounts. The order
 *  is presentation only: nothing here or on the screen says one is likelier,
 *  more realistic or more serious than the other, and there is no field on a
 *  row that could carry such a claim. */
export const REHEARSAL_CONDITIONS: readonly RehearsalCondition[] = ['no-data', 'no-location-fix'];

/** One condition as the screen states it: what is missing, then what that means
 *  in plain words. No rank, no ordinal, no "most likely" — and there must never
 *  be a field here that could hold one. */
export type ConditionRow = {
  condition: RehearsalCondition;
  label: string;
  detail: string;
};

const ROW_COPY: Record<RehearsalCondition, { label: string; detail: string }> = {
  'no-data': { 
    label: copy.CONDITION_NO_DATA, 
    detail: copy.CONDITION_NO_DATA_DETAIL },
  'no-location-fix': { 
    label: copy.CONDITION_NO_FIX,
    detail: copy.CONDITION_NO_FIX_DETAIL },
};

/** The rows to offer, in the fixed order. Nothing is marked chosen: a row
 *  carries no selected state at all, so nothing can be pre-selected. */
export const conditionRows = (): ConditionRow[] =>
  REHEARSAL_CONDITIONS.map((condition) => ({ condition, ...ROW_COPY[condition] }));

/** Whether a value is one of the supported conditions.
 *
 *  Guards anything that arrives from outside the running screen — route state, a
 *  restored history entry — so a value that is not a supported condition is not
 *  treated as a choice. A third condition cannot be introduced by handing one in. */
export const isRehearsalCondition = (value: unknown): value is RehearsalCondition =>
  typeof value === 'string' && (REHEARSAL_CONDITIONS as readonly string[]).includes(value);

/** How the chosen condition is stated once it has been chosen. This is the row
 *  title, word for word, so the bar matches the choice screen. Never put it
 *  after "without" in a sentence: it already says "No". */
export const conditionLabel = (condition: RehearsalCondition): string =>
  ROW_COPY[condition].label;

/** Kept apart from ROW_COPY so a choice row carries only what the row shows. */
const WITHOUT_FORM: Record<RehearsalCondition, string> = {
  'no-data': copy.CONDITION_NO_DATA_WITHOUT,
  'no-location-fix': copy.CONDITION_NO_FIX_WITHOUT,
};

/** How the condition reads after the word "without", for the sentences that
 *  embed it. A separate function rather than a string the caller adjusts, so a
 *  sentence picks the right form by name. */
export const conditionWithout = (condition: RehearsalCondition): string =>
  WITHOUT_FORM[condition];

/** E5-US6. What to do on the phone so the condition is real, not pretended. */
export const howToLine = (condition: RehearsalCondition): string =>
  copy.CONDITION_HOW_TO[condition];

/** E5-US6. What the browser reports while she is out, for the one condition
 *  the browser can report on. A location fix cannot be seen without asking
 *  for one, and a rehearsal never asks, so that condition gets no line. */
export function connectionLine(condition: RehearsalCondition, online: boolean): string | null {
  if (condition !== 'no-data') return null;
  return online ? copy.PHONE_STILL_ONLINE : copy.PHONE_IS_OFFLINE;
}
