import { PACK_RADIUS_KM } from './constants';
import { OFFICIAL_INSTRUCTIONS_FIRST, SAVED_DAYS_AGO } from './copy';
import { savedAgeDays } from './provenance';
import type { Pack, PackSeed, PendingPlace, Source } from './types';

/** How long ago a pack was saved, from verifiedAt, never createdAt. A pack
 *  never expires and is never marked old: the age alone is stated. */
export const packAgeLabel = (now: number, verifiedAt: number): string =>
  SAVED_DAYS_AGO(savedAgeDays(now, verifiedAt));

/** The seed for a pack built from an already-confirmed place and an
 * already-fetched official area result. 
 * The reminder defaults to the same mandated priority line shown on the area-result screen — 
 * there is no reminder-editing surface yet, so nothing invented is stored in its place. */
export function buildPackSeed(
  id: string,
  createdAt: number,
  place: PendingPlace,
  lgaName: string,
  source: Source,
  existingPackId?: string,
): PackSeed {
  return {
    id,
    name: place.name,
    address: place.address,
    lat: place.lat,
    lon: place.lon,
    radiusKm: PACK_RADIUS_KM,
    lgaName,
    createdAt,
    reminder: OFFICIAL_INSTRUCTIONS_FIRST,
    sources: [source],
    ...(existingPackId ? { supersedes: existingPackId } : {}),
  };
}

type PackFieldChange = { field: string; from: unknown; to: unknown };

// The user-visible fields of a Pack. Anything not listed here is machinery
// (ids, timestamps, the manifest) and its change is not a change the user made.
const DIFFED_FIELDS = [
  'name',
  'address',
  'lat',
  'lon',
  'radiusKm',
  'lgaName',
  'builtWithTiles',
  'reminder',
] as const;

/** What changed between the pack on the device and the pack just built, for the
 *  update view. The old pack stays fully usable until the user acknowledges.
 *  ponytail: Pack fields only; the update view extends this to layer and
 *  destination rows when Epic 1's update story lands. */
export const diffPacks = (oldPack: Pack, newPack: Pack): PackFieldChange[] =>
  DIFFED_FIELDS.filter((field) => oldPack[field] !== newPack[field]).map((field) => ({
    field,
    from: oldPack[field],
    to: newPack[field],
  }));