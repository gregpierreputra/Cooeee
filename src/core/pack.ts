import { PACK_RADIUS_KM } from './constants';
import { OFFICIAL_INSTRUCTIONS_FIRST, SAVED_DAYS_AGO } from './copy';
import { savedAgeDays } from './provenance';
import type { Pack, PackIcon, PackSeed, PendingPlace, Source } from './types';

/** How long ago a pack was saved, from verifiedAt, never createdAt. A pack
 *  never expires and is never marked old: the age alone is stated. */
export const packAgeLabel = (now: number, verifiedAt: number): string =>
  SAVED_DAYS_AGO(savedAgeDays(now, verifiedAt));

/** Whether two pack names are the same to a reader: capitals and spaces at
 *  either end do not make a name different. One name per pack, so packs are
 *  told apart by name, most of all when choosing one in BlackSky. */
export const samePackName = (a: string, b: string): boolean =>
  a.trim().toLocaleLowerCase('en-AU') === b.trim().toLocaleLowerCase('en-AU');

/** Every drawing a pack may carry, in the order the picker shows them. The
 *  pin comes first: it is the default, and what every older pack shows. */
export const PACK_ICONS: readonly PackIcon[] = ['place', 'home', 'work', 'family', 'holiday', 'school', 'farm'];

/** Whether a value is one of the pack drawings. Checked where an icon is
 *  stored and where it is read, so a changed value on the phone is never drawn. */
export const isPackIcon = (value: unknown): value is PackIcon =>
  typeof value === 'string' && (PACK_ICONS as readonly string[]).includes(value);

/** The drawing a pack shows: its own, or the pin when it has none. */
export const packIcon = (pack: Pick<Pack, 'icon'>): PackIcon => (isPackIcon(pack.icon) ? pack.icon : 'place');

/** The address without the suburb and postcode at its end, as the official
 *  list writes them: "8 RIDGE ROAD KALORAMA 3766" gives "8 RIDGE ROAD". An
 *  address that does not end that way is returned whole, never guessed at. */
export function streetPart(address: string, locality: string): string {
  const end = ` ${locality} `;
  const at = address.toUpperCase().lastIndexOf(end.toUpperCase());
  const postcode = address.slice(at + end.length);
  return at > 0 && /^\d{4}$/.test(postcode) ? address.slice(0, at) : address;
}

/** The name the builder offers: the suburb, or the street when another pack
 *  already has the suburb's name, so a second pack in one suburb is told
 *  apart by what it is, not by a number. */
export const defaultPackName = (
  candidate: { address: string; localityName: string },
  savedNames: readonly string[],
): string =>
  savedNames.some((name) => samePackName(name, candidate.localityName))
    ? streetPart(candidate.address, candidate.localityName)
    : candidate.localityName;

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
    ...(isPackIcon(place.icon) ? { icon: place.icon } : {}),
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
  'icon',
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