import { DYNAMIC_SNAPSHOT_MAX_AGE_MS } from './constants';
import * as copy from './copy';
import { formatMelbourneTime, type NearbyCache } from './nearby';
import type { Condition, LatLon } from './types';

/** Whether the point lies inside the ring: a ray cast east, counting crossings. */
export function pointInRing(point: LatLon, ring: LatLon[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[i];
    const b = ring[j];
    const crosses = a.lat > point.lat !== b.lat > point.lat;
    if (crosses && point.lon < ((b.lon - a.lon) * (point.lat - a.lat)) / (b.lat - a.lat) + a.lon) {
      inside = !inside;
    }
  }
  return inside;
}

/** The notices that name this point: statewide ones, and any whose area holds it. */
export const conditionsAt = (point: LatLon, conditions: Condition[]): Condition[] =>
  conditions.filter((c) => c.statewide || c.rings.some((ring) => pointInRing(point, ring)));

/** Whether a heat notice, fresh by the rule below, names the point right now. */
export const heatNoticeAt = (now: number, cache: Pick<NearbyCache, 'conditions' | 'meta'>, point: LatLon): boolean =>
  noticeView(now, cache, point) !== null && conditionsAt(point, cache.conditions).some((c) => c.hazard === 'heat');

export type NoticeView = { lines: string[]; asOf: string };

/** What the screen says about current notices at a point, or null when there is
 *  nothing honest to say: no snapshot yet, or one older than the same hour that
 *  hides a relief centre. An empty `lines` means none apply here. */
export function noticeView(now: number, cache: Pick<NearbyCache, 'conditions' | 'meta'>, point: LatLon): NoticeView | null {
  const asOfIso = cache.meta.dynamic_source_last_success_at ?? cache.meta.dynamic_generated_at ?? cache.meta.dynamic_synced_at;
  if (asOfIso === undefined) return null;
  const asOf = Date.parse(asOfIso);
  if (now - asOf > DYNAMIC_SNAPSHOT_MAX_AGE_MS) return null;
  return {
    lines: conditionsAt(point, cache.conditions).map((c) => copy.NOTICE_LINE(c.title, c.publisher)),
    asOf: copy.AS_OF(formatMelbourneTime(asOf)),
  };
}
