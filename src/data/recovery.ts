import { MAX_RESPONSE_BYTES } from '../core/constants';
import { isAllowedSourceUrl } from '../core/provenance';
import { NEEDS } from '../core/recover';
import type { NeedKey, RecoveryProgram, Source } from '../core/types';
import { readJsonBounded } from './bounded-body';
import { putPrograms } from './db';

// The precached recovery programs snapshot: a curated list of official program
// pages built by scripts/build-recovery.mjs. Same-origin static asset, served
// from the service-worker precache after the first visit.
//
// ponytail: one hard-coded snapshot filename, as data/nsp.ts.
export const RECOVERY_SNAPSHOT_PATH = '/data/recovery.v2026-09-11.json';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TELEPHONE = /^[0-9 +]+$/;

function fail(message: string): never {
  throw new TypeError(`recovery snapshot: ${message}`);
}

function assertNonEmpty(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) fail(`${field} must be a non-empty string`);
  return value as string;
}

function assertOfficialUrl(value: unknown, field: string): string {
  const url = assertNonEmpty(value, field);
  if (!isAllowedSourceUrl(url)) fail(`${field} must be an https URL on an official domain`);
  return url;
}

function assertSource(value: unknown, field: string): Source {
  if (typeof value !== 'object' || value === null) fail(`${field} must be an object`);
  const raw = value as Record<string, unknown>;
  if (typeof raw.retrievedAt !== 'number' || raw.retrievedAt <= 0) fail(`${field}.retrievedAt must be positive`);
  return {
    publisher: assertNonEmpty(raw.publisher, `${field}.publisher`),
    url: assertOfficialUrl(raw.url, `${field}.url`),
    licence: assertNonEmpty(raw.licence, `${field}.licence`),
    retrievedAt: raw.retrievedAt,
  };
}

function assertProgram(value: unknown, index: number): RecoveryProgram {
  if (typeof value !== 'object' || value === null) fail(`programs[${index}] must be an object`);
  const raw = value as Record<string, unknown>;
  const at = (field: string) => `programs[${index}].${field}`;

  if (!Array.isArray(raw.needs) || raw.needs.length === 0) fail(`${at('needs')} must be a non-empty array`);
  const needs = raw.needs.map((need) => {
    if (!NEEDS.includes(need as NeedKey)) fail(`${at('needs')} holds an unknown need`);
    return need as NeedKey;
  });
  const snapshotDate = assertNonEmpty(raw.snapshotDate, at('snapshotDate'));
  if (!ISO_DATE.test(snapshotDate)) fail(`${at('snapshotDate')} must be an ISO date (YYYY-MM-DD)`);

  const program: RecoveryProgram = {
    id: assertNonEmpty(raw.id, at('id')),
    org: assertNonEmpty(raw.org, at('org')),
    title: assertNonEmpty(raw.title, at('title')),
    covers: assertNonEmpty(raw.covers, at('covers')),
    needs,
    officialUrl: assertOfficialUrl(raw.officialUrl, at('officialUrl')),
    snapshotDate,
    source: assertSource(raw.source, at('source')),
  };
  if (raw.telephone !== undefined) {
    const telephone = assertNonEmpty(raw.telephone, at('telephone'));
    if (!TELEPHONE.test(telephone)) fail(`${at('telephone')} must hold digits, spaces and a plus only`);
    program.telephone = telephone;
  }
  return program;
}

/** THE asserting parser for the recovery snapshot. Every read goes through
 *  here, so a malformed or off-domain row never reaches a screen as fact. */
export function assertRecoverySnapshot(value: unknown): RecoveryProgram[] {
  if (typeof value !== 'object' || value === null) fail('the file must be a JSON object');
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.programs) || raw.programs.length === 0) fail('programs must be a non-empty array');
  return raw.programs.map(assertProgram);
}

/** Read the precached snapshot and store it whole. Called at every app start,
 *  so Recover works with the radios off after the first visit. `fetchImpl` is
 *  injectable so tests can supply the bytes without a request. */
export async function loadRecoveryPrograms(fetchImpl: typeof fetch = fetch): Promise<RecoveryProgram[]> {
  const response = await fetchImpl(RECOVERY_SNAPSHOT_PATH, { cache: 'force-cache' });
  if (!response.ok) fail(`request failed (${response.status})`);
  const programs = assertRecoverySnapshot(await readJsonBounded(response, MAX_RESPONSE_BYTES));
  await putPrograms(programs);
  return programs;
}
