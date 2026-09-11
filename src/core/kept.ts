// E4-US6: the programs a person chose to keep. Program ids only, held in the
// browser's local storage under one key, so nothing about the person is
// written and a cleared site wipes it with everything else.

import type { FlagStore } from './acknowledgement';
import { KEPT_KEY, KEPT_MAX } from './constants';

/** The kept ids, or none: an absent key, malformed text or a store that
 *  throws all read as nothing kept, never as an error. */
export function readKept(store: FlagStore | null): string[] {
  try {
    const parsed: unknown = JSON.parse(store?.getItem(KEPT_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/** Drop kept ids the snapshot no longer holds, once the snapshot has landed,
 *  so the Home nudge can never count a program that cannot be saved. */
export function pruneKept(store: FlagStore | null, known: readonly string[]): void {
  const kept = readKept(store);
  const next = kept.filter((id) => known.includes(id));
  if (next.length === kept.length) return;
  try {
    store?.setItem(KEPT_KEY, JSON.stringify(next));
  } catch {
    // Storage refused: the stale id stays until the next start.
  }
}

/** Keep the id, or release it when already kept. The oldest id is dropped past
 *  the cap. The list returned is the truth for the screen even when the store
 *  refuses the write, so a tap never appears to do nothing. */
export function toggleKept(store: FlagStore | null, kept: readonly string[], id: string): string[] {
  const next = kept.includes(id) ? kept.filter((k) => k !== id) : [...kept, id].slice(-KEPT_MAX);
  try {
    store?.setItem(KEPT_KEY, JSON.stringify(next));
  } catch {
    // Storage refused: the choice lasts for this visit only.
  }
  return next;
}
