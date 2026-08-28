import type { AddressCandidate, PendingPlace } from './types';

/** Create the in-memory selection without normalising user or source text. */
export function makePendingPlace(
  candidate: AddressCandidate,
  editedName: string,
): PendingPlace {
  return {
    name: editedName,
    address: candidate.address,
    lat: candidate.lat,
    lon: candidate.lon,
  };
}
