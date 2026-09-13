import { useSyncExternalStore } from 'react';
import type { RehearsalRun } from '../../core/rehearsal-run';
import type { RehearsalCondition } from '../../core/rehearsal-condition';
import type { RehearsalEnding, UnfinishedRehearsal } from '../../core/types';
import { WALK_START, advanceWalk, type WalkPosition } from '../../core/rehearsal-walk';

/** E5-US1-AC3, as amended by E5-US1-AC5 — where a running rehearsal is held.
 *
 *  The RUN is held here, in memory at module scope, so leaving the screen and
 *  coming back within the same session resumes it where it was: component state
 *  dies on unmount. The same latch pattern is used for the service-worker update
 *  flag in app.tsx and for the tour in components/Tour.tsx.
 *
 *  This value still dies with the document, so a closed and reopened app has no
 *  run: no bar, no resumed screen, no partial result. What survives is the
 *  REHEARSAL, kept on the device as an unfinished rehearsal from the moment it
 *  started (Condition.tsx). A cold start finds that and asks her how it ended;
 *  it never resumes a screen, and never decides the ending for her. */
let current: RehearsalRun | null = null;

/** E5-US1-AC5 — where the run is in the walk. Held beside the run, not in it,
 *  and under the same rules: in memory only, so returning in the same session
 *  resumes the step, and a cold start has no step to find. It moves only through
 *  advanceWalk(), one step forward, so no step is reachable out of order. */
let position: WalkPosition = WALK_START;

const listeners = new Set<() => void>();

const announce = () => listeners.forEach((listener) => listener());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The run in progress, or null. Read directly by code that is not a component. */
export const currentRun = (): RehearsalRun | null => current;

/** Begin a run. Replaces any run already in progress rather than stacking one
 *  on it: a rehearsal is against one pack under one condition, always. */
export function startRun(
  packId: string,
  condition: RehearsalCondition,
  id: string = crypto.randomUUID(),
  startedAt: number = Date.now(),
): RehearsalRun {
  const run = { id, packId, condition, startedAt };
  current = run;
  position = WALK_START;
  announce();
  return run;
}

/** Take up a kept unfinished rehearsal with the ending she gave it, at its
 *  result. The result records it finished, with that ending, over the kept row.
 *  The ending is hers: this is only ever called with her answer. */
export function resumeWithEnding(unfinished: UnfinishedRehearsal, ending: RehearsalEnding): void {
  current = {
    id: unfinished.id,
    packId: unfinished.packId,
    condition: unfinished.condition,
    startedAt: unfinished.startedAt,
    ending,
  };
  position = 'result';
  announce();
}

/** End the run. The bar goes with it, everywhere, at once. */
export function endRun(): void {
  current = null;
  position = WALK_START;
  announce();
}

/** Where the run is in the walk. */
export const currentWalkPosition = (): WalkPosition => position;

/** Move the walk on by one step. The only way the position changes. */
export function advanceWalkPosition(): void {
  position = advanceWalk(position);
  announce();
}

/** The walk position, as a component sees it. */
export const useWalkPosition = (): WalkPosition =>
  useSyncExternalStore(subscribe, currentWalkPosition, () => WALK_START);

/** The run in progress, as a component sees it. Re-renders every screen of the
 *  run when the run starts or ends, so the bar can never be left behind on a
 *  screen after the rehearsal it belonged to has finished. */
export const useRehearsalRun = (): RehearsalRun | null =>
  useSyncExternalStore(subscribe, currentRun, () => null);
