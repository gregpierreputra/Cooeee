import { bearing } from '@turf/bearing';
import { distance } from '@turf/distance';
import { ARROW_GLYPHS, CARDINAL_ABBR } from './copy';
import type { LatLon } from './types';

// ONE haversine feeds both the ordering and the displayed figure, so an order and
// its label can never disagree. Turf takes positional [lon, lat]; every function
// here takes named fields, and this file is the only place the conversion happens.
const coord = (p: LatLon): [number, number] => [p.lon, p.lat];

/** Great-circle distance in metres. */
export const distanceM = (a: LatLon, b: LatLon): number =>
  distance(coord(a), coord(b), { units: 'kilometers' }) * 1000;

/** Containment test. INCLUSIVE: a point exactly on the radius is inside. */
export const withinRadius = (a: LatLon, b: LatLon, km: number): boolean =>
  distanceM(a, b) <= km * 1000;

/** Initial great-circle bearing from a to b, TRUE north, normalised to 0–360. */
export const bearingDeg = (a: LatLon, b: LatLon): number => {
  const deg = bearing(coord(a), coord(b));
  return ((deg % 360) + 360) % 360;
};

/** Which of n equal sectors a bearing falls in. Sector centres sit every
 *  360/n degrees, so a boundary rounds into the sector it opens. */
const sector = (deg: number, n: number): number => {
  const normalised = ((deg % 360) + 360) % 360;
  return Math.round(normalised / (360 / n)) % n;
};

/** 16-point compass abbreviation. */
export const cardinalAbbr = (deg: number): (typeof CARDINAL_ABBR)[number] =>
  CARDINAL_ABBR[sector(deg, 16)];

/** 8-direction arrow glyph. */
export const arrowGlyph = (deg: number): (typeof ARROW_GLYPHS)[number] =>
  ARROW_GLYPHS[sector(deg, 8)];
