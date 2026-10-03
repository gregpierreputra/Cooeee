// Locality names on the map disc (BS_Enhancement-AC5, "Whole way" only): the
// pure rules. The file's rows decoded and checked, and which few names the
// disc carries. No I/O here: the screen hands in the file's parsed JSON.
//
// Worked out NORTH UP in screen pixels from the dial's centre, like the roads;
// the dial carries each name round with the map and turns it back upright.

import {
  ROADS_LABEL_PX,
  ROADS_LOCALITY_CENTRE_PX,
  ROADS_LOCALITY_COUNT,
  ROADS_LOCALITY_EDGE_PX,
  ROADS_LOCALITY_LETTER_SPACING_PX,
  ROADS_LOCALITY_PAD_PX,
  ROADS_LOCALITY_PX,
  ROADS_LOCALITY_SPACING_PX,
  isInsideVictoria,
} from './constants';
import { project, type Obstacle } from './roads';
import type { LatLon } from './types';

/** A locality: its name and one representative point. */
export type Locality = { name: string; lat: number; lon: number };

/** A locality name placed on the disc: upper case, centred on its point. */
export type PlaceName = { name: string; x: number; y: number };

type Point = [number, number];

/** The file's rows, [[name, lat, lon], ...], into localities. Throws on
 *  anything else: the screen then draws the map without them. */
export function decodeLocalities(raw: unknown): Locality[] {
  if (!Array.isArray(raw)) throw new TypeError('localities file: not a list');
  return raw.map((row, i) => {
    if (
      !Array.isArray(row) ||
      row.length !== 3 ||
      typeof row[0] !== 'string' ||
      row[0].trim() === '' ||
      typeof row[1] !== 'number' ||
      typeof row[2] !== 'number' ||
      !isInsideVictoria(row[1], row[2])
    ) {
      throw new TypeError(`localities file: row ${i} is not [name, lat, lon] in Victoria`);
    }
    return { name: row[0], lat: row[1], lon: row[2] };
  });
}

/** An estimate of a name's width as drawn, upper case, its letter-spacing
 *  included. The screen passes a measure from the real font; this stands in
 *  for the tests. */
export const estimateLocalityPx = (name: string): number =>
  name.length * ROADS_LOCALITY_PX * 0.68 + name.length * ROADS_LOCALITY_LETTER_SPACING_PX;

/** The locality a spot lies in, as near as the file can tell: it holds one
 *  point for each locality, not its boundary, so this is the locality whose
 *  point is nearest. Null for an empty list. */
export function localityAt(localities: Locality[], spot: LatLon): Locality | null {
  let best: Locality | null = null;
  let bestD = Infinity;
  const k = Math.cos((spot.lat * Math.PI) / 180);
  for (const l of localities) {
    const d = (l.lat - spot.lat) ** 2 + ((l.lon - spot.lon) * k) ** 2;
    if (d < bestD) {
      best = l;
      bestD = d;
    }
  }
  return best;
}

export type LocalityOptions = {
  /** The chosen place: its own locality is tried before any other. */
  place?: LatLon | null;
  /** The width of a name as drawn, upper case, in screen pixels. */
  measure?: (name: string) => number;
};

/** THE LOCALITY RULE. The chosen place's own locality first, then the rest,
 *  nearest the person first; a name is skipped when its point is within 46 px
 *  of the centre (the arrow) or 30 px of the disc's edge, within 62 px of a
 *  name already placed, or when its upright box, with 4 px round it, would
 *  touch a road name or an obstacle (the pin): road names always win. At most
 *  eight. The box is the name as drawn with the dial north up; turned, the
 *  name can come a little closer to a road name than that. Asked for in the
 *  review of the phone test: a full half-width every way left three names at
 *  most. */
export function chooseLocalities(
  localities: Locality[],
  centre: LatLon,
  metresPerPx: number,
  radiusPx: number,
  roadLabelSamples: Point[],
  obstacles: Obstacle[] = [],
  { place = null, measure = estimateLocalityPx }: LocalityOptions = {},
): PlaceName[] {
  // A cheap box first: only localities within the disc's reach are projected.
  const reachLat = (radiusPx * metresPerPx) / 111_000;
  const reachLon = reachLat / Math.cos((centre.lat * Math.PI) / 180);
  const candidates = localities
    .filter((l) => Math.abs(l.lat - centre.lat) <= reachLat && Math.abs(l.lon - centre.lon) <= reachLon)
    .map((l) => {
      const [x, y] = project(centre, metresPerPx, l.lon, l.lat);
      return { locality: l, name: l.name.toLocaleUpperCase('en-AU'), x, y, r: Math.hypot(x, y) };
    })
    .filter(({ r }) => r >= ROADS_LOCALITY_CENTRE_PX && r <= radiusPx - ROADS_LOCALITY_EDGE_PX)
    .sort((a, b) => a.r - b.r);
  // The place's own locality goes to the front, if it is on the disc at all.
  const own = place ? localityAt(localities, place) : null;
  const ownAt = candidates.findIndex((c) => c.locality === own);
  if (ownAt > 0) candidates.unshift(...candidates.splice(ownAt, 1));

  const placed: PlaceName[] = [];
  for (const { name, x, y } of candidates) {
    if (placed.length === ROADS_LOCALITY_COUNT) break;
    if (placed.some((p) => Math.hypot(p.x - x, p.y - y) < ROADS_LOCALITY_SPACING_PX)) continue;
    // The name's upright box, centred on its point, and the pad round it.
    const halfW = measure(name) / 2 + ROADS_LOCALITY_PAD_PX;
    const halfH = ROADS_LOCALITY_PX / 2 + ROADS_LOCALITY_PAD_PX;
    // A road name is a band ROADS_LABEL_PX high along its samples.
    const clearOfRoadNames = roadLabelSamples.every(
      ([sx, sy]) => Math.abs(sx - x) >= halfW + ROADS_LABEL_PX / 2 || Math.abs(sy - y) >= halfH + ROADS_LABEL_PX / 2,
    );
    // An obstacle is a circle: clear when its centre is further than its
    // radius from the box.
    const clearOfObstacles = obstacles.every((o) => {
      const dx = Math.max(0, Math.abs(o.x - x) - halfW);
      const dy = Math.max(0, Math.abs(o.y - y) - halfH);
      return Math.hypot(dx, dy) >= o.r;
    });
    if (!clearOfRoadNames || !clearOfObstacles) continue;
    placed.push({ name, x, y });
  }
  return placed;
}
