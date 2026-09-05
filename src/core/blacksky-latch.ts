import type { FlagStore } from './acknowledgement';
import { BLACKSKY_LATCH_KEY, BLACKSKY_LATCH_VALUE } from './constants';

/** Whether BlackSky was the last screen open in this browser. Set when the
 *  screen opens and cleared only by the hold on Leave BlackSky, so a visit that
 *  starts anywhere else can be sent back to it. A store that cannot be read
 *  reads as "not latched": the app opens normally rather than being blocked. */
export function isBlackSkyLatched(store: FlagStore | null): boolean {
  if (!store) return false;
  try {
    return store.getItem(BLACKSKY_LATCH_KEY) === BLACKSKY_LATCH_VALUE;
  } catch {
    return false;
  }
}

export function latchBlackSky(store: FlagStore | null): void {
  try {
    store?.setItem(BLACKSKY_LATCH_KEY, BLACKSKY_LATCH_VALUE);
  } catch {
    // A browser that refuses the write simply forgets; nothing else depends on it.
  }
}

export function unlatchBlackSky(store: FlagStore | null): void {
  try {
    store?.removeItem(BLACKSKY_LATCH_KEY);
  } catch {
    // As above: the worst case is one more return to BlackSky.
  }
}
