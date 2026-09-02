import { DESTINATIONS_MAX, METRES_PER_KM } from './constants';
import { distanceM } from './geo';
import { NO_DESTINATION_PUBLISHED_FOR, ORDINALS } from './copy';
import type { Destination, LatLon, Source } from './types';

export const isGeocoded = (d: { lat?: number; lon?: number }): boolean =>
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

/** A straight-line distance for display: whole tens of metres below a kilometre,
 *  one decimal place above it. The figure is a ±5% estimate, so it is never
 *  shown to the metre. Fed by the SAME haversine that produced the ordering, so
 *  the figure and the order can never disagree. */
export const formatDistanceM = (metres: number): string =>
  metres < METRES_PER_KM
    ? `${Math.round(metres / 10) * 10} m`
    : `${(metres / METRES_PER_KM).toFixed(1)} km`;

/** Toggling one place in the current selection. At most DESTINATIONS_MAX,
 *  nothing pre-selected, both equals. Returns the new selection, or null when
 *  the cap blocks the choice — the caller shows why rather than silently
 *  ignoring a tap. Persisting the result is a separate, explicit save. */
export const chooseRules = (chosen: string[], id: string): string[] | null => {
  if (chosen.includes(id)) return chosen.filter((c) => c !== id);
  if (chosen.length >= DESTINATIONS_MAX) return null;
  return [...chosen, id];
};

/** The rows to persist for the user's picks: the distance-ordered rows whose id
 *  the user chose, in list order, each marked `chosen` and nothing more — no
 *  rank, no "first pick", the two are equals. Throws rather than let a third
 *  through, so the cap holds even if the id list is somehow longer. */
export const chosenDestinations = (
  ordered: Destination[],
  chosenIds: readonly string[],
): Destination[] => {
  const picks = ordered.filter((d) => chosenIds.includes(d.id));
  if (picks.length > DESTINATIONS_MAX) {
    throw new RangeError(`at most ${DESTINATIONS_MAX} last-resort places may be chosen`);
  }
  return picks.map((d) => ({ ...d, chosen: true }));
};

/** How many last-resort places this area lets the user save: DESTINATIONS_MAX,
 *  or fewer when fewer are located. */
export const savableCount = (locatedCount: number): number =>
  Math.min(DESTINATIONS_MAX, locatedCount);

/** Whether the current selection may be saved: exactly `savableCount` places,
 *  and never nothing. */
export const canSaveDestinations = (locatedCount: number, chosenCount: number): boolean =>
  locatedCount >= 1 && chosenCount === savableCount(locatedCount);

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
