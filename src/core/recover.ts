// E4 Recover: the rules behind needs-first support matching. Pure, so the
// screen renders what these return and judges nothing of its own.

import { MS_PER_DAY, RECOVERY_STALE_DAYS } from './constants';
import * as copy from './copy';
import { formatSavedDate } from './provenance';
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

/** What the person asked to see: one need, every program, or the kept ones. */
export type Choice = NeedKey | 'all' | 'kept';

export const isNeed = (choice: Choice): choice is NeedKey => (NEEDS as readonly string[]).includes(choice);

/** The programs for a choice, in the one neutral order the screen states: kept
 *  programs first, then organisation, then title. Nothing about the person is
 *  read; "kept" is a list of program ids the person chose. */
export function selectPrograms(
  programs: readonly RecoveryProgram[],
  choice: Choice,
  kept: readonly string[],
): RecoveryProgram[] {
  const rank = (program: RecoveryProgram) => (kept.includes(program.id) ? 0 : 1);
  return programs
    .filter((program) =>
      choice === 'all' || (choice === 'kept' ? kept.includes(program.id) : program.needs.includes(choice)))
    .sort((a, b) => rank(a) - rank(b) || a.org.localeCompare(b.org) || a.title.localeCompare(b.title));
}

/** The list as plain text for a message: the caveat travels with it, every
 *  program carries its publisher and saved date, and nothing about the person
 *  or the pack's address is in it. */
export function shareText(heading: string, programs: readonly RecoveryProgram[]): string {
  const blocks = programs.map((program) => [
    program.title,
    program.org,
    program.covers,
    ...(program.telephone ? [copy.CALL_LINE(program.telephone)] : []),
    program.officialUrl,
    copy.PROVENANCE_LINE(program.source.publisher, formatSavedDate(program.source.retrievedAt)),
  ].join('\n'));
  return [`${heading}\n${copy.RECOVER_MAY_MATCH}`, ...blocks, copy.SHARED_FROM].join('\n\n');
}

/** Up to three initials, so each organisation has one mark a glance can tell
 *  apart: Services Australia is SA, Country Fire Authority is CFA. */
export const monogram = (org: string): string =>
  org.split(' ').slice(0, 3).map((word) => word[0]).join('').toUpperCase();

/** Past the window the screen says so in words; the programs stay shown. */
export function recoveryStale(now: number, snapshotDate: string): boolean {
  return (now - Date.parse(snapshotDate)) / MS_PER_DAY > RECOVERY_STALE_DAYS;
}
