// R1: the roadmap steps a person has ticked done. Step ids only, held in the
// browser's local storage under one key, as the saved programs are, so
// nothing about the person is written and a cleared site wipes it.

import type { FlagStore } from './acknowledgement';
import { ROADMAP_DONE_KEY } from './constants';
import { ROADMAP_STAGES } from './copy';

const STEP_IDS = ROADMAP_STAGES.flatMap((stage) => stage.steps.map((step) => step.id));

/** The ticked ids, or none: an absent key, malformed text, an unknown id or a
 *  store that throws all read as nothing ticked, never as an error. */
export function readDone(store: FlagStore | null): string[] {
  try {
    const parsed: unknown = JSON.parse(store?.getItem(ROADMAP_DONE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((id) => STEP_IDS.includes(id)) : [];
  } catch {
    return [];
  }
}

/** Untick every step. */
export function clearDone(store: FlagStore | null): void {
  try {
    store?.removeItem(ROADMAP_DONE_KEY);
  } catch {
    // Storage refused: the screen still shows nothing ticked for this visit.
  }
}

/** Tick or untick one step, and return the new list. */
export function toggleDone(store: FlagStore | null, done: readonly string[], id: string): string[] {
  const next = done.includes(id) ? done.filter((each) => each !== id) : [...done, id];
  try {
    store?.setItem(ROADMAP_DONE_KEY, JSON.stringify(next));
  } catch {
    // Storage refused: the ticks last for this visit only.
  }
  return next;
}
