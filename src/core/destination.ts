import { distanceM } from './geo';
import { NO_DESTINATION_PUBLISHED_FOR, ORDINALS } from './copy';
import type { Destination, LatLon, Source } from './types';

const isGeocoded = (d: Destination): boolean =>
  typeof d.lat === 'number' && typeof d.lon === 'number';

/** Sites with a location, ordered strictly ascending by distance from the pack
 *  centre, each carrying its distance and its zero-based display order.
 *
 *  Sites WITHOUT a location are excluded from the ordering and returned
 *  separately — never sorted in against a distance they do not have, and never
 *  dropped, because dropping them would delete a published place from the list. */
export const orderByDistance = (
  sites: Destination[],
  centre: LatLon,
): { ordered: Destination[]; ungeocoded: Destination[] } => {
  const ungeocoded = sites.filter((d) => !isGeocoded(d));
  const ordered = sites
    .filter(isGeocoded)
    .map((d) => ({ ...d, distanceM: distanceM(centre, { lat: d.lat!, lon: d.lon! }) }))
    .sort((a, b) => a.distanceM - b.distanceM)
    .map((d, i) => ({ ...d, distanceOrder: i }));
  return { ordered, ungeocoded };
};

/** Position in a distance-ordered list, worded as position and nothing more.
 *  Beyond the third there is no label, because there is no ranking to extend. */
export const ordinalLabel = (order: number): (typeof ORDINALS)[number] | undefined =>
  ORDINALS[order];

/** Toggling one place in the current selection. At most two, nothing
 *  pre-selected, both equals. Returns the new selection, or null when the cap
 *  blocks the choice — the caller shows why rather than silently ignoring a tap.
 *  Persisting the result is a separate, explicit save. */
export const chooseRules = (chosen: string[], id: string): string[] | null => {
  if (chosen.includes(id)) return chosen.filter((c) => c !== id);
  if (chosen.length >= 2) return null;
  return [...chosen, id];
};

/** Absence as a ROW, not an empty array. A renderer given an empty array may
 *  reasonably draw nothing; this row MUST be rendered, and carries its own
 *  reason and the area it applies to.
 *
 *  The caller passes the snapshot's own Source: core never invents provenance. */
export const absenceRow = (packId: string, area: string, source: Source): Destination => ({
  id: `${packId}:absence`,
  packId,
  kind: 'absence',
  reason: NO_DESTINATION_PUBLISHED_FOR(area),
  source,
});
