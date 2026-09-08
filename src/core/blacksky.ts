import { heatNoticeAt } from './conditions';
import {
  ACCURACY_MAX_M,
  DTP_PUBLISHER,
  FIX_STALE_MS,
  MARK_DRIFT_M_PER_S,
  MARK_START_ACCURACY_M,
  NEARBY_PLACES,
} from './constants';
import * as copy from './copy';
import { isGeocoded } from './destination';
import { bearingDeg, distanceM } from './geo';
import type { NearbyCache } from './nearby';
import type { BundleFacility, Destination, Fix, LatLon, NspSnapshot, Pack, PackWithPlaces } from './types';

/** What the screen has on the device for a heat day: the downloaded cool places
 *  and the last synced notices. Empty on a phone that has never opened Nearby. */
export type HeatSources = Pick<NearbyCache, 'conditions' | 'meta'> & { cool: BundleFacility[] };
export const NO_HEAT_SOURCES: HeatSources = { cool: [], conditions: [], meta: {} };

/** One place to point at: a live bearing and distance from the fix. Built the
 *  same way for a place chosen into a pack and for a site on the state-wide
 *  list, so the screen draws both with one row. */
export type Placed = {
  id: string;
  name: string;
  bearingDeg: number;
  distanceM: number;
  publisher: string;
};

const placeFrom = (
  fix: LatLon,
  to: LatLon & { id: string; name: string; publisher: string },
): Placed => ({
  id: to.id,
  name: to.name,
  bearingDeg: bearingDeg(fix, to),
  distanceM: distanceM(fix, to),
  publisher: to.publisher,
});

const byDistance = (a: Placed, b: Placed) => a.distanceM - b.distanceM;

/** How far to trust the fix the arrows are drawn from. The arrows are never
 *  withheld on its account: a vague or old fix still points, and the screen
 *  says so beside the figure. */
export type Confidence = {
  accuracyM: number;
  ageS: number;
  approximate: boolean; // accuracy worse than ACCURACY_MAX_M
  stale: boolean; // older than FIX_STALE_MS
};

const confidenceOf = (now: number, fix: Fix): Confidence => ({
  accuracyM: fix.accuracyM,
  ageS: Math.max(0, Math.round((now - fix.at) / 1000)),
  approximate: fix.accuracyM > ACCURACY_MAX_M,
  stale: now - fix.at > FIX_STALE_MS,
});

/** A position the user marked themselves — a known point such as their front
 *  gate — and when they marked it. */
export type Mark = { lat: number; lon: number; at: number };

/**
 * The marked position as a synthetic Fix (E3-US1-AC4). Its uncertainty starts
 * at MARK_START_ACCURACY_M and grows at walking pace, because without motion
 * sensors the holder may have been walking since the mark. `at` is `now`: an
 * estimate is never "stale" — its decay IS the accuracy figure.
 *
 * Returns null once the uncertainty passes ACCURACY_MAX_M: the estimate cannot
 * be maintained, and a null fix hands the screen back to ACQUIRING — the AC2
 * reference state — rather than drawing a confident arrow.
 */
// ponytail: time-only drift, no sensors. Upgrade to accelerometer/gyro PDR only
// after the Iteration 1 drift spike validates it (card E3-US1-AC4).
export function estimateFix(mark: Mark, now: number): Fix | null {
  const accuracyM = Math.round(MARK_START_ACCURACY_M + ((now - mark.at) / 1000) * MARK_DRIFT_M_PER_S);
  if (accuracyM > ACCURACY_MAX_M) return null;
  return { lat: mark.lat, lon: mark.lon, accuracyM, at: now };
}

// `heat` says what the nearby list holds: true, the nearest cool places under a
// current heat notice at the fix; false, the nearest bushfire places of last resort.
export type Screen =
  | { kind: 'NO_PACK'; nearby: Placed[]; heat: boolean; confidence?: Confidence }
  | {
      kind: 'ACQUIRING';
      reason: 'no-fix' | 'denied';
      pack: Pack;
      places: Destination[];
    }
  | {
      kind: 'OUT_OF_AREA';
      packs: { pack: Pack; distanceKm: number }[];
      nearby: Placed[];
      heat: boolean;
      confidence: Confidence;
    }
  | {
      kind: 'IN_AREA';
      pack: Pack;
      places: Placed[];
      nearby: Placed[];
      heat: boolean;
      confidence: Confidence;
      absence?: Destination;
    };

// The chosen places, plus any absence row — which is never "chosen" but must
// always be rendered.
const shown = (places: Destination[]): Destination[] =>
  places.filter((d) => d.chosen === true || d.kind === 'absence');

/** The NEARBY_PLACES closest of the given places, nearest first. Every row is
 *  reachable from here: the list is never cut by a radius. This runs on every
 *  tick, so the whole list gets one distance each and only the few that are
 *  kept get a bearing. */
function nearestPlaces(fix: LatLon, rows: (LatLon & { id: string; name: string; publisher: string })[]): Placed[] {
  return rows
    .map((row) => ({ row, metres: distanceM(fix, row) }))
    .sort((a, b) => a.metres - b.metres)
    .slice(0, NEARBY_PLACES)
    .map(({ row }) => placeFrom(fix, row));
}

/** The nearest sites on the state-wide CFA list, skipping any the pack already carries. */
export function nearestSites(
  fix: LatLon,
  snapshot: NspSnapshot | null,
  excludeSiteIds: Set<string> = new Set(),
): Placed[] {
  if (!snapshot) return [];
  return nearestPlaces(
    fix,
    snapshot.sites
      .filter((site) => isGeocoded(site) && !excludeSiteIds.has(site.id))
      .map((site) => ({ id: site.id, name: site.name, lat: site.lat!, lon: site.lon!, publisher: snapshot.source.publisher })),
  );
}

/** The nearest downloaded cool places, listed by the Department of Transport and Planning. */
const nearestCool = (fix: LatLon, cool: BundleFacility[]): Placed[] =>
  nearestPlaces(fix, cool.map((f) => ({ id: String(f.facility_id), name: f.name, lat: f.lat, lon: f.lon, publisher: DTP_PUBLISHER })));

/**
 * The whole BlackSky screen, derived from scratch on every fix and every
 * TICK_MS tick. It is a DERIVATION, not a state machine:
 * "the arrow returns automatically when a fix arrives" needs no code, because it
 * is simply what the next derivation returns.
 *
 * PRECEDENCE — first match wins:
 *   1 NO_PACK  2 ACQUIRING  3 OUT_OF_AREA  4 IN_AREA
 *
 * Once any fix exists the arrows are drawn from it, however vague or old it
 * is: a person in the field is better served by an approximate direction with
 * its error stated than by no direction. `confidence` carries that statement.
 */
/** The position the arrows are drawn from: a denied sensor is treated as no
 *  fix, whatever a stale reading still holds. */
export const positionFrom = (
  fix: Fix | null,
  permission: 'granted' | 'denied' | 'prompt',
): Fix | null => (permission === 'denied' ? null : fix);

export function deriveState(
  now: number,
  packs: PackWithPlaces[],
  fix: Fix | null,
  permission: 'granted' | 'denied' | 'prompt',
  snapshot: NspSnapshot | null = null,
  heatSources: HeatSources = NO_HEAT_SOURCES,
): Screen {
  const from = positionFrom(fix, permission);
  // Under a current heat notice the nearby list points at cool places instead
  // of bushfire places: the hazard at the fix decides which list is drawn.
  const heat = from !== null && heatSources.cool.length > 0 && heatNoticeAt(now, heatSources, from);
  const nearby = (fix: LatLon, exclude?: Set<string>): Placed[] =>
    heat ? nearestCool(fix, heatSources.cool) : nearestSites(fix, snapshot, exclude);

  if (packs.length === 0) {
    return from
      ? { kind: 'NO_PACK', nearby: nearby(from), heat, confidence: confidenceOf(now, from) }
      : { kind: 'NO_PACK', nearby: [], heat };
  }

  // With no fix there is nothing to place a pack by, so this is the caller's
  // first pack. The screen passes the one pack the person chose to load (or the
  // only pack saved), so the first pack is the chosen one.
  const fallback = packs[0];

  if (!from)
    return {
      kind: 'ACQUIRING',
      reason: permission === 'denied' ? 'denied' : 'no-fix',
      pack: fallback.pack,
      places: shown(fallback.places),
    };

  const confidence = confidenceOf(now, from);
  const byMetres = packs
    .map((p) => ({ ...p, metres: distanceM(from, p.pack) }))
    .sort((a, b) => a.metres - b.metres);

  // Containment is INCLUSIVE: a point exactly on the radius is inside.
  const containing = byMetres.filter((p) => p.metres <= p.pack.radiusKm * 1000);

  // "Distance to its area" is to the area's EDGE, not the pack centre — the
  // honest figure for how far the user is from ground they prepared.
  if (containing.length === 0)
    return {
      kind: 'OUT_OF_AREA',
      packs: byMetres
        .map((p) => ({ pack: p.pack, distanceKm: (p.metres - p.pack.radiusKm * 1000) / 1000 }))
        .sort((a, b) => a.distanceKm - b.distanceKm),
      nearby: nearby(from),
      heat,
      confidence,
    };

  const here = containing[0];
  const chosen = shown(here.places);
  const places = chosen
    .filter(isGeocoded)
    .map((d) =>
      placeFrom(from, {
        id: d.id,
        name: d.name ?? copy.OFFICIAL_DESTINATION_INFORMATION,
        lat: d.lat!,
        lon: d.lon!,
        publisher: d.source.publisher,
      }),
    )
    .sort(byDistance);

  // A chosen row's id is `${packId}:${siteId}`, so the site ids fall out of it.
  const chosenSiteIds = new Set(chosen.map((d) => d.id.slice(here.pack.id.length + 1)));
  const absence = here.places.find((d) => d.kind === 'absence');

  return {
    kind: 'IN_AREA',
    pack: here.pack,
    places,
    nearby: nearby(from, chosenSiteIds),
    heat,
    confidence,
    ...(absence ? { absence } : {}),
  };
}
