import type { Pack } from './types';

export type PackConflictDecision =
  | { kind: 'none' }
  | { kind: 'conflict'; savedPack: Pack }
  | { kind: 'invalid-multiple' };

/** EPIC 1 permits one complete pack. Any existing complete pack therefore
 * requires an explicit keep-or-replace decision before the next network call. */
export function decidePackConflict(packs: readonly Pack[]): PackConflictDecision {
  if (packs.length === 0) return { kind: 'none' };
  if (packs.length === 1) return { kind: 'conflict', savedPack: packs[0] };
  return { kind: 'invalid-multiple' };
}
