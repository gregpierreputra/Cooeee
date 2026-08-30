import { MS_PER_DAY, PACK_REFRESH_DAYS } from './constants';
import { NOT_RECENTLY_VERIFIED, SAVED_DAYS_AGO } from './copy';
import { resolveBushfireAreaStatus } from './area-check';
import type { LayerPublicationStatus, LayerStatus, Pack } from './types';

/** Whole days since the pack was last verified. Freshness derives from
 *  verifiedAt, never createdAt. */
export const ageDays = (now: number, verifiedAt: number): number =>
  Math.floor((now - verifiedAt) / MS_PER_DAY);

/** A pack past its refresh window stays FULLY USABLE and gains a label.
 *  Nothing expires; nothing auto-refreshes; nothing is replaced silently.
 *  The window is inclusive: at exactly PACK_REFRESH_DAYS the pack is not stale. */
export const freshness = (
  now: number,
  verifiedAt: number,
): { stale: boolean; label: string } => {
  const days = ageDays(now, verifiedAt);
  const stale = days > PACK_REFRESH_DAYS;
  return { stale, label: stale ? NOT_RECENTLY_VERIFIED(days) : SAVED_DAYS_AGO(days) };
};

/** Exact encoded size of the rows about to be written, for the size screen. */
export const textBytes = (rows: unknown): number =>
  new TextEncoder().encode(JSON.stringify(rows)).length;

/** The area decision that makes publication uncertainty explicit and makes a
 *  failed probe impossible to collapse into a confident negative result. */
export const layerStatus = (
  hitsAtPoint: number,
  publication: LayerPublicationStatus,
): LayerStatus => resolveBushfireAreaStatus(hitsAtPoint, publication);

export type PackFieldChange = { field: string; from: unknown; to: unknown };

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
