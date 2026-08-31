import { ADDRESS_QUERY_MIN_CHARS } from './constants';
import type { AddressCandidate, AddressRecord } from './types';

/** The outcome of turning one address response into things a user may choose.
 * `unresolvedCount` counts exact-address groups the register describes at more
 * than one point without identifying which one it means. Those groups yield no
 * candidate: a coordinate the user cannot see is never guessed at. */
export type AddressCandidateResolution = {
  candidates: AddressCandidate[];
  unresolvedCount: number;
};

export type AddressSearchState =
  | { kind: 'search' }
  | { kind: 'searching' }
  | { kind: 'candidates'; candidates: AddressCandidate[]; unresolvedCount: number }
  | { kind: 'no-match' }
  | { kind: 'unavailable' };

export function addressQueryCanRun(query: string): boolean {
  return query.trim().length >= ADDRESS_QUERY_MIN_CHARS;
}

/** The query sent to Vicmap is uppercase and CQL apostrophes are doubled.
 * The original text stays untouched in UI state for correction. */
export function addressQueryForCql(query: string): string {
  return query.trim().toUpperCase().replaceAll("'", "''");
}

function pointKey({ lat, lon }: AddressCandidate): string {
  return `${lat} ${lon}`;
}

/** Resolve one exact-address group to the single record it stands for, or to
 * null when the register does not say which record that is. */
function resolveGroup(group: readonly AddressRecord[]): AddressCandidate | null {
  const flagged = group.filter(({ isPrimary }) => isPrimary);
  const onePoint = group.every(
    (record) => pointKey(record.candidate) === pointKey(group[0].candidate),
  );

  // One point: the records differ only in fields the user never sees and never
  // chose between, so collapsing loses nothing. The selection flag breaks the
  // tie in place; without it the service's own first record stands. Neither
  // moves a candidate or marks it.
  if (onePoint) return (flagged[0] ?? group[0]).candidate;

  // Different points: exactly one flagged record is the only evidence of which
  // location the register means. With none, or with several, any pick would be
  // a fabricated coordinate behind an identical-looking button, so the group is
  // withheld and counted instead.
  return flagged.length === 1 ? flagged[0].candidate : null;
}

/** Exclude inactive records, then resolve each exact `ezi_address` to at most
 * one candidate at its first-seen position. The grouping key is the returned
 * address string verbatim — no trimming, case folding or punctuation stripping
 * — so two officially distinct addresses, including units, suffixes and street
 * numbers, can never merge. Nothing is reordered, ranked or scored. */
export function resolveAddressCandidates(
  records: readonly AddressRecord[],
): AddressCandidateResolution {
  const groups = new Map<string, AddressRecord[]>();

  for (const record of records) {
    if (record.propertyStatus !== 'A') continue;
    const group = groups.get(record.candidate.address);
    if (group) group.push(record);
    else groups.set(record.candidate.address, [record]);
  }

  const candidates: AddressCandidate[] = [];
  let unresolvedCount = 0;

  // Map iteration is insertion-ordered, so this is the service's own order.
  for (const group of groups.values()) {
    const candidate = resolveGroup(group);
    if (candidate) candidates.push(candidate);
    else unresolvedCount += 1;
  }

  return { candidates, unresolvedCount };
}

export function completedSearchState(
  resolution: AddressCandidateResolution,
): AddressSearchState {
  // A response holding something the register could not pin down is not the
  // same as a response holding nothing.
  return resolution.candidates.length === 0 && resolution.unresolvedCount === 0
    ? { kind: 'no-match' }
    : {
        kind: 'candidates',
        candidates: [...resolution.candidates],
        unresolvedCount: resolution.unresolvedCount,
      };
}