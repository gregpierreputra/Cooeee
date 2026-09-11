// E4 Recover: the rules behind needs-first support matching. Pure, so the
// screen renders what these return and judges nothing of its own.

import { MS_PER_DAY, RECOVERY_STALE_DAYS } from './constants';
import type { NeedKey, Pack, RecoveryProgram } from './types';

/** The order the need phrases are offered in. */
export const NEEDS: readonly NeedKey[] = ['stay', 'money', 'food', 'property', 'health', 'documents'];

/** The newest saved pack that carries recovery references. Every pack copies
 *  the same statewide snapshot, so the newest copy is the one to read. */
export function recoveryPack(packs: readonly Pack[]): Pack | null {
  return packs
    .filter((pack) => pack.manifest.groups.recovery.count > 0)
    .reduce<Pack | null>(
      (newest, pack) => (newest === null || pack.createdAt > newest.createdAt ? pack : newest),
      null,
    );
}

/** Every program tagged with the need, in the one neutral order the screen
 *  states: organisation, then title. Nothing about the person is read. */
export function matchPrograms(
  programs: readonly RecoveryProgram[],
  need: NeedKey,
): RecoveryProgram[] {
  return programs
    .filter((program) => program.needs.includes(need))
    .sort((a, b) => a.org.localeCompare(b.org) || a.title.localeCompare(b.title));
}

/** Past the window the screen says so in words; the programs stay shown. */
export function recoveryStale(now: number, snapshotDate: string): boolean {
  return (now - Date.parse(snapshotDate)) / MS_PER_DAY > RECOVERY_STALE_DAYS;
}
