import { RETRY_SCHEDULE_MS } from './constants';
import type { NeedKey, RecoveryProgram } from './types';

/** Programs whose needs intersect the selected needs — a union across needs,
 *  deduplicated by id, in the order the snapshot supplies.
 *
 *  An empty result is an HONEST empty state and is never padded with a
 *  near-match, because "may match" is already the strongest claim available. */
export const matchNeeds = (
  programs: RecoveryProgram[],
  needs: NeedKey[],
): RecoveryProgram[] => {
  const wanted = new Set(needs);
  const seen = new Set<string>();
  return programs.filter((p) => {
    if (seen.has(p.id) || !p.needs.some((n) => wanted.has(n))) return false;
    seen.add(p.id);
    return true;
  });
};

// The fields a reader would notice changing. A change in any of them is a change
// worth showing before anything is replaced.
const VISIBLE_FIELDS = [
  'org',
  'title',
  'covers',
  'officialUrl',
  'telephone',
  'sms',
  'snapshotDate',
] as const;

const differs = (a: RecoveryProgram, b: RecoveryProgram): boolean =>
  VISIBLE_FIELDS.some((f) => a[f] !== b[f]) ||
  a.needs.length !== b.needs.length ||
  a.needs.some((n, i) => n !== b.needs[i]);

/** What a newly fetched snapshot would change, computed BEFORE anything is
 *  written, so the user can see it and choose. Nothing is replaced silently. */
export const diffSnapshot = (
  live: RecoveryProgram[],
  incoming: RecoveryProgram[],
): { added: string[]; removed: string[]; changed: string[] } => {
  const liveById = new Map(live.map((p) => [p.id, p]));
  const incomingById = new Map(incoming.map((p) => [p.id, p]));
  return {
    added: incoming.filter((p) => !liveById.has(p.id)).map((p) => p.id),
    removed: live.filter((p) => !incomingById.has(p.id)).map((p) => p.id),
    changed: incoming
      .filter((p) => liveById.has(p.id) && differs(liveById.get(p.id)!, p))
      .map((p) => p.id),
  };
};

/** Delay before retry number `attempts`, or null when the schedule is exhausted
 *  and the app should stop and offer a manual check instead of retrying forever. */
export const nextRetryDelay = (attempts: number): number | null =>
  RETRY_SCHEDULE_MS[attempts] ?? null;
