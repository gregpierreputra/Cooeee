// E4 Recover: the rules behind needs-first support matching. Pure, so the
// screen renders what these return and judges nothing of its own.

import { HOTLINE_NUMBER, MS_PER_DAY, RECOVERY_STALE_DAYS } from './constants';
import * as copy from './copy';
import { formatSavedDate } from './provenance';
import type { NeedKey, PackProgram, RecoveryProgram } from './types';

/** The order the need phrases are offered in. */
export const NEEDS: readonly NeedKey[] = ['stay', 'money', 'food', 'property', 'health', 'documents'];

/** What the person asked to see: one need, every program, or the kept ones. */
export type Choice = NeedKey | 'all' | 'kept' | 'calls';

export const isNeed = (choice: Choice): choice is NeedKey =>
  choice !== 'all' && choice !== 'kept' && choice !== 'calls';

/** The programs for a choice, in the one neutral order the screen states: kept
 *  programs first, then organisation, then title. Nothing about the person is
 *  read; "kept" is a list of program ids the person chose. */
export function selectPrograms(
  programs: readonly RecoveryProgram[],
  choice: Exclude<Choice, 'calls'>,
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

/** The kept programs as rows this pack owns: copied, so the pack shows what
 *  was saved whatever the app's snapshot does later. */
export function packProgramsFor(
  packId: string,
  programs: readonly RecoveryProgram[],
  kept: readonly string[],
): PackProgram[] {
  return programs
    .filter((program) => kept.includes(program.id))
    .map((program) => ({ ...program, id: `${packId}:${program.id}`, packId, programId: program.id }));
}

/** What a pack must gain and lose so it carries exactly the kept programs.
 *  A stale row, one the snapshot has since changed, is both removed and
 *  added, so it is rebuilt from the current snapshot. */
export const keptDiff = (have: readonly string[], kept: readonly string[], stale: readonly string[] = []) => ({
  add: kept.filter((id) => !have.includes(id) || stale.includes(id)),
  remove: have.filter((id) => !kept.includes(id) || stale.includes(id)),
});

/** Every number the device holds: the hotline first, then each program's own,
 *  one entry per number. Nothing is typed and nothing is looked up. */
export type CallEntry = { label: string; org?: string; number: string };
export function callList(programs: readonly RecoveryProgram[]): CallEntry[] {
  const entries: CallEntry[] = [{ label: copy.HOTLINE_LABEL, number: HOTLINE_NUMBER }];
  const withNumber = programs
    .filter((program): program is RecoveryProgram & { telephone: string } => Boolean(program.telephone))
    .sort((a, b) => a.org.localeCompare(b.org) || a.title.localeCompare(b.title));
  for (const program of withNumber) {
    if (!entries.some((entry) => entry.number === program.telephone)) {
      entries.push({ label: program.title, org: program.org, number: program.telephone });
    }
  }
  return entries;
}

/** The kept programs no saved pack carries yet: the Home nudge counts them. */
export const unsavedKept = (kept: readonly string[], saved: readonly string[]): string[] =>
  kept.filter((id) => !saved.includes(id));

/** Past the window the screen says so in words; the programs stay shown. */
export function recoveryStale(now: number, snapshotDate: string): boolean {
  return (now - Date.parse(snapshotDate)) / MS_PER_DAY > RECOVERY_STALE_DAYS;
}
