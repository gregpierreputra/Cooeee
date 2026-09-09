import { useSyncExternalStore } from 'react';
import type { RehearsalRun } from '../../core/rehearsal-run';
import type { RehearsalCondition } from '../../core/rehearsal-condition';

/** E5-US1-AC3 — where a running rehearsal is held, and why it is held HERE.
 *
 *  In memory, at module scope, and nowhere else. Not IndexedDB, not
 *  localStorage, not sessionStorage, not the URL.
 *
 *  Module scope rather than component state because AC3 requires a run to
 *  survive the user leaving the screen and coming back within the same session:
 *  component state dies on unmount, which would drop the user back at the
 *  choice with nothing chosen, and that is the ambiguity this criterion exists
 *  to prevent. The same latch pattern is used for the service-worker update
 *  flag in app.tsx and for the tour in components/Tour.tsx.
 *
 *  Module scope rather than storage because AC3 equally requires that a closed
 *  and reopened app has NO rehearsal running. This value dies with the
 *  document, so a reload is a cold start by construction rather than by a
 *  cleanup step that could fail to run. There is nothing on the device for a
 *  restart to find, so there is no half-alive rehearsal to find it in, and no
 *  partial result to show. The store belongs to the change that adds gaps and
 *  actions, which are the first things that must genuinely survive a reload. */
let current: RehearsalRun | null = null;

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
export function startRun(packId: string, condition: RehearsalCondition): void {
  current = { packId, condition };
  announce();
}

/** End the run. The bar goes with it, everywhere, at once. */
export function endRun(): void {
  current = null;
  announce();
}

/** The run in progress, as a component sees it. Re-renders every screen of the
 *  run when the run starts or ends, so the bar can never be left behind on a
 *  screen after the rehearsal it belonged to has finished. */
export const useRehearsalRun = (): RehearsalRun | null =>
  useSyncExternalStore(subscribe, currentRun, () => null);
