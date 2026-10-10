// The picture under Nearby's map: the main roads and a few town names round
// where distances are measured from, drawn from the files BlackSky already
// keeps on the phone. The rules are BlackSky's own, in its whole-way view; this
// file only sizes them to a square.

import { AREA_MAP_HALF_KM, NEARBY_MAP_HALF_PX } from './constants';
import { chooseLocalities, type Locality, type PlaceName } from './localities';
import { drawRoads, project, type DialRoad, type RoadMap } from './roads';
import type { LatLon } from './types';

export type NearbyMapDrawing = { roads: DialRoad[]; names: PlaceName[] };

/** Room kept clear round each place's mark, a 28 px disc, so no town name
 *  sits under one. */
const MARK_CLEAR_PX = 18;

/** North up, in pixels from the origin at the middle of a square
 *  AREA_MAP_HALF_KM each way: the same ground and the same plain projection the
 *  marks are placed on (mapBoxAround and mapPoint). Without the roads file the
 *  picture is the town names alone. */
export function drawNearbyMap(
  roads: RoadMap | null,
  localities: Locality[],
  origin: LatLon,
  marks: LatLon[] = [],
): NearbyMapDrawing {
  const halfPx = NEARBY_MAP_HALF_PX;
  const metresPerPx = (AREA_MAP_HALF_KM * 1000) / halfPx;
  // The circle round the square, so its corners are drawn too; the picture
  // crops it to the square.
  const radiusPx = halfPx * Math.SQRT2;
  const drawn = roads ? drawRoads(roads, origin, { view: 'whole', radiusM: radiusPx * metresPerPx, radiusPx }) : null;
  return {
    roads: drawn?.roads ?? [],
    names: chooseLocalities(
      localities,
      origin,
      metresPerPx,
      halfPx,
      [],
      marks.map((mark) => {
        const [x, y] = project(origin, metresPerPx, mark.lon, mark.lat);
        return { x, y, r: MARK_CLEAR_PX };
      }),
    ),
  };
}
