import { bearing } from '@turf/bearing';
import { distance } from '@turf/distance';
import { CARDINAL_ABBR } from './copy';
import type { LatLon } from './types';

// ONE haversine feeds both the ordering and the displayed figure, so an order and
// its label can never disagree. Turf takes positional [lon, lat]; every function
// here takes named fields, and this file is the only place the conversion happens.
const coord = (p: LatLon): [number, number] => [p.lon, p.lat];

/** Great-circle distance in metres. */
export const distanceM = (a: LatLon, b: LatLon): number =>
  distance(coord(a), coord(b), { units: 'kilometers' }) * 1000;

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

/** Magnetic declination across Victoria, degrees EAST of true north: what to add
 *  to a magnetic compass heading to get a true one. A plane fitted to the World
 *  Magnetic Model for September 2026 at six towns from Mildura to Mallacoota,
 *  within 0.1° of the model at each; the model drifts about 0.05° a year.
 *  ponytail: a Victoria-only plane; swap in the full WMM if the app leaves the
 *  state. */
export const magneticDeclinationDeg = ({ lat, lon }: LatLon): number =>
  -64.808 + 0.4397 * lon - 0.3426 * lat;

/** The direction the top of the screen faces, MAGNETIC north, 0–360 — or null
 *  when the sensor reading carries no compass heading. iOS reports the heading
 *  itself; Android reports `alpha`, the device's rotation away from north, so
 *  the heading is its complement and only trustworthy when `absolute`. The
 *  screen's own rotation (landscape) is added so the reference stays the top of
 *  the screen, which is where the arrows are drawn from. */
export const compassHeading = (
  reading: { alpha: number | null; absolute?: boolean; webkitCompassHeading?: number },
  screenAngle = 0,
): number | null => {
  const heading =
    typeof reading.webkitCompassHeading === 'number'
      ? reading.webkitCompassHeading
      : reading.absolute && typeof reading.alpha === 'number'
        ? 360 - reading.alpha
        : null;
  return heading === null ? null : (((heading + screenAngle) % 360) + 360) % 360;
};
