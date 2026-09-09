import { COOL_DATASET_URL, DTP_LICENCE, DTP_PUBLISHER } from './constants';
import { distanceM } from './geo';
import type { BundleFacility, Destination, LatLon, Source } from './types';

/** The provenance every cool place carries: the Vicmap Features of Interest
 *  dataset page, dated by when the downloaded list last landed on this phone. */
export const coolSource = (retrievedAt: number): Source => ({
  publisher: DTP_PUBLISHER,
  url: COOL_DATASET_URL,
  licence: DTP_LICENCE,
  retrievedAt,
});

/** The `count` nearest cool places to the pack centre from the downloaded list,
 *  state-wide and however far. Distance is the only rule, as for the bushfire
 *  places; a row the list no longer confirms is left out. */
export const selectCoolForPack = (rows: BundleFacility[], centre: LatLon, count: number): BundleFacility[] =>
  rows
    .filter((row) => row.designation_status === 'designated')
    .map((row) => ({ row, metres: distanceM(centre, row) }))
    .sort((a, b) => a.metres - b.metres)
    .slice(0, count)
    .map(({ row }) => row);

/** One downloaded cool place → one DESTINATION row. Distance and order are
 *  added later by core/destination.ts, exactly as for a CFA site. */
export const toCoolDestination = (row: BundleFacility, packId: string, source: Source): Destination => ({
  id: `${packId}:${row.facility_id}`,
  packId,
  kind: 'cool-heat',
  name: row.name,
  ...(row.address ? { addressText: row.address } : {}),
  lat: row.lat,
  lon: row.lon,
  source,
});
