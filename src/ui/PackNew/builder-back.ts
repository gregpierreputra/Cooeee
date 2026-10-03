import { useSyncExternalStore } from 'react';

/** What Back does inside the pack builder, set by the builder for the Back bar.
 *  'step' goes back one step. 'hidden' holds Back while a check or the save
 *  runs, and once the pack is saved, where Back to Home is the way on. */
export type BuilderBack = 'step' | 'hidden';

let current: BuilderBack = 'step';
const listeners = new Set<() => void>();

export function setBuilderBack(next: BuilderBack) {
  if (next === current) return;
  current = next;
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useBuilderBack = (): BuilderBack => useSyncExternalStore(subscribe, () => current, () => 'step');
