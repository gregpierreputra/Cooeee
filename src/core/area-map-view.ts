import { AREA_MAP_HALF_KM, AREA_MAP_MARGIN_KM, AREA_MAP_MAX_HALF_KM } from './constants';
import type { LatLon } from './types';

// The stored map of a pack's area is one picture drawn in plain longitude and
// latitude (EPSG:4326), so a place sits on it by simple proportion: no map
// projection is involved. This file places points on that picture and works
// out the pan, zoom and turn of the pack page's map viewer.

export const KM_PER_DEGREE_LAT = 111;

export type MapBox = { west: number; south: number; east: number; north: number };

/** The square of ground halfKm each way from the centre. A degree of longitude
 *  shrinks with latitude, so the east-west half-width is widened to keep the
 *  square square on the ground. */
export function mapBoxAround({ lat, lon }: LatLon, halfKm: number): MapBox {
  const halfLat = halfKm / KM_PER_DEGREE_LAT;
  const halfLon = halfLat / Math.cos((lat * Math.PI) / 180);
  return { west: lon - halfLon, south: lat - halfLat, east: lon + halfLon, north: lat + halfLat };
}

/** How far a pack's map reaches each way, in whole kilometres: AREA_MAP_HALF_KM,
 *  or as far as the farthest chosen place east, west, north or south and a
 *  little room past it, up to AREA_MAP_MAX_HALF_KM. A place past that is said
 *  in words under the map. */
export function areaMapHalfKm(centre: LatLon, places: LatLon[]): number {
  const reach = places.reduce((most, { lat, lon }) => {
    const northSouth = Math.abs(lat - centre.lat) * KM_PER_DEGREE_LAT;
    const eastWest = Math.abs(lon - centre.lon) * KM_PER_DEGREE_LAT * Math.cos((centre.lat * Math.PI) / 180);
    return Math.max(most, northSouth, eastWest);
  }, 0);
  return Math.min(AREA_MAP_MAX_HALF_KM, Math.max(AREA_MAP_HALF_KM, Math.ceil(reach + AREA_MAP_MARGIN_KM)));
}

/** The box a stored map was drawn for, read back from its own request, so a
 *  pack saved with an older, smaller map still places its points exactly. */
export function mapBoxOf(url: string): MapBox | null {
  let bbox: string | null;
  try {
    bbox = new URL(url).searchParams.get('bbox'); // URL.canParse is too new for older iPhones
  } catch {
    return null;
  }
  const parts = (bbox ?? '').split(',').map(Number);
  if (parts.length !== 4 || !parts.every(Number.isFinite)) return null;
  const [west, south, east, north] = parts;
  return west < east && south < north ? { west, south, east, north } : null;
}

/** How far the map reaches from top to bottom, in whole kilometres. */
export const mapAcrossKm = (box: MapBox): number => Math.round((box.north - box.south) * KM_PER_DEGREE_LAT);

/** Where a place falls on the picture, as fractions of its width and height
 *  from the top left, or null when it is off the picture. */
export function mapPoint(box: MapBox, { lat, lon }: LatLon): { x: number; y: number } | null {
  const x = (lon - box.west) / (box.east - box.west);
  const y = (box.north - lat) / (box.north - box.south);
  return x >= 0 && x <= 1 && y >= 0 && y <= 1 ? { x, y } : null;
}

/** The viewer's state: a shift in pixels and a zoom, applied about the middle
 *  of the frame. North is always up: a turned square leaves blank corners. */
export type MapView = { x: number; y: number; scale: number };

export const MAP_HOME: MapView = { x: 0, y: 0, scale: 1 };
export const MAP_MAX_SCALE = 8;

/** The closest zoom for a map: MAP_MAX_SCALE on the usual 40 km, and more on a
 *  wider one, so the streets near home can be read as closely on either. */
export const mapMaxScale = (box: MapBox | null): number =>
  box ? MAP_MAX_SCALE * Math.max(1, mapAcrossKm(box) / (AREA_MAP_HALF_KM * 2)) : MAP_MAX_SCALE;

/** Keeps the zoom between 1 and maxScale, and the picture over the whole
 *  frame: nothing lies past its edge, so the map moves only as far as the edge.
 *  Fully zoomed out it does not move at all. half is half the frame's width. */
export function clampView(view: MapView, half: number, maxScale = MAP_MAX_SCALE): MapView {
  const scale = Math.min(maxScale, Math.max(1, view.scale));
  const limit = half * (scale - 1);
  const bound = (value: number) => Math.min(limit, Math.max(-limit, value));
  return { x: bound(view.x), y: bound(view.y), scale };
}

/** The view after zooming by factor about the point at (px, py) from the
 *  frame's middle, so the ground under that point stays under it, as under two
 *  fingers. */
export function zoomAbout(view: MapView, px: number, py: number, factor: number, half: number, maxScale = MAP_MAX_SCALE): MapView {
  const scale = Math.min(maxScale, Math.max(1, view.scale * factor));
  const k = scale / view.scale;
  return clampView({ x: px + k * (view.x - px), y: py + k * (view.y - py), scale }, half, maxScale);
}
