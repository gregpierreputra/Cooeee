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

/** The width of a name as drawn: upper case, its letter-spacing included. The
 *  factor is generous for capitals, so a name is never judged smaller than it
 *  is. */
export const localityWidthPx = (name: string): number =>
  name.length * ROADS_LOCALITY_PX * 0.68 + (name.length - 1) * ROADS_LOCALITY_LETTER_SPACING_PX;

/** THE LOCALITY RULE. The localities nearest the person first; a name is
 *  skipped when its point is within 46 px of the centre (the arrow) or 30 px
 *  of the disc's edge, within 62 px of a name already placed, or when any part
 *  of it could touch a road name or an obstacle (the pin): road names always
 *  win. At most eight. A name stands upright whichever way the map has turned,
 *  so against the map it can lie at any angle: it is kept clear by the circle
 *  its half width sweeps round its point. */
export function chooseLocalities(
  localities: Locality[],
  centre: LatLon,
  metresPerPx: number,
  radiusPx: number,
  roadLabelSamples: Point[],
  obstacles: Obstacle[] = [],
): PlaceName[] {
  // A cheap box first: only localities within the disc's reach are projected.
  const reachLat = (radiusPx * metresPerPx) / 111_000;
  const reachLon = reachLat / Math.cos((centre.lat * Math.PI) / 180);
  const candidates = localities
    .filter((l) => Math.abs(l.lat - centre.lat) <= reachLat && Math.abs(l.lon - centre.lon) <= reachLon)
    .map((l) => {
      const [x, y] = project(centre, metresPerPx, l.lon, l.lat);
      return { name: l.name.toLocaleUpperCase('en-AU'), x, y, r: Math.hypot(x, y) };
    })
    .filter(({ r }) => r >= ROADS_LOCALITY_CENTRE_PX && r <= radiusPx - ROADS_LOCALITY_EDGE_PX)
    .sort((a, b) => a.r - b.r);

  const placed: PlaceName[] = [];
  for (const { name, x, y } of candidates) {
    if (placed.length === ROADS_LOCALITY_COUNT) break;
    if (placed.some((p) => Math.hypot(p.x - x, p.y - y) < ROADS_LOCALITY_SPACING_PX)) continue;
    const reach = localityWidthPx(name) / 2;
    const clearOfRoadNames = roadLabelSamples.every(
      ([sx, sy]) => Math.hypot(sx - x, sy - y) >= reach + ROADS_LABEL_PX / 2,
    );
    const clearOfObstacles = obstacles.every((o) => Math.hypot(o.x - x, o.y - y) >= reach + o.r);
    if (!clearOfRoadNames || !clearOfObstacles) continue;
    placed.push({ name, x, y });
  }
  return placed;
}
