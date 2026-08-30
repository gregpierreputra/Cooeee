import { ADDRESS_QUERY_MIN_CHARS } from './constants';
import type { AddressCandidate, AddressRecord } from './types';

export type AddressSearchState =
  | { kind: 'search' }
  | { kind: 'searching' }
  | { kind: 'candidates'; candidates: AddressCandidate[] }
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

/** Exclude inactive records and collapse exact duplicate address/coordinate
 * rows. A primary record can replace its duplicate in the same position, but
 * can never move or visually favour an entry. */
export function visibleAddressCandidates(records: readonly AddressRecord[]): AddressCandidate[] {
  const visible: AddressRecord[] = [];
  const indices = new Map<string, number>();

  for (const record of records) {
    if (record.propertyStatus !== 'A') continue;
    const { address, lat, lon } = record.candidate;
    const key = `${address}\u0000${lat}\u0000${lon}`;
    const existingIndex = indices.get(key);

    if (existingIndex === undefined) {
      indices.set(key, visible.length);
      visible.push(record);
    } else if (record.isPrimary && !visible[existingIndex].isPrimary) {
      visible[existingIndex] = record;
    }
  }

  return visible.map(({ candidate }) => candidate);
}

export function completedSearchState(candidates: readonly AddressCandidate[]): AddressSearchState {
  return candidates.length === 0
    ? { kind: 'no-match' }
    : { kind: 'candidates', candidates: [...candidates] };
}
