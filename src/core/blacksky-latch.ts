import type { FlagStore } from './acknowledgement';
import { BLACKSKY_LATCH_KEY, BLACKSKY_LATCH_VALUE, BLACKSKY_PACK_KEY } from './constants';

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

/** The pack the person chose to load in BlackSky, so a reload or relaunch opens
 *  on the same one. Null when nothing was chosen or the store cannot be read.
 *  The screen only ever compares the value against its saved packs' ids. */
export function readChosenPack(store: FlagStore | null): string | null {
  try {
    return store?.getItem(BLACKSKY_PACK_KEY) ?? null;
  } catch {
    return null;
  }
}

export function rememberChosenPack(store: FlagStore | null, id: string): void {
  try {
    store?.setItem(BLACKSKY_PACK_KEY, id);
  } catch {
    // A browser that refuses the write asks again next visit.
  }
}
