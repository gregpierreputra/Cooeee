import { useSyncExternalStore } from 'react';

/** E7 — which packs have had their drill this session.
 *
 *  Held at module scope like the rehearsal run (Rehearsal/run-state.ts), so
 *  leaving for BlackSky or Home and coming back does not replay the drill,
 *  while a fresh open of the app plays it once more. Nothing is written to
 *  the phone for this. */
const drilled = new Set<string>();
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function markDrilled(packId: string): void {
  drilled.add(packId);
  listeners.forEach((listener) => listener());
}

export const useDrilled = (packId: string): boolean =>
  useSyncExternalStore(subscribe, () => drilled.has(packId));

/** Play the drill again for this pack, now: the Rehearse screen's own button.
 *  Clearing the mark brings the drill back in front of the rehearsal. */
export function replayDrill(packId: string): void {
  drilled.delete(packId);
  listeners.forEach((listener) => listener());
}
