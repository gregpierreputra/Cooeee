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

/** The viewer's state: a shift in pixels, a zoom and a turn in degrees, applied
 *  about the middle of the frame. */
export type MapView = { x: number; y: number; scale: number; angle: number };

export const MAP_HOME: MapView = { x: 0, y: 0, scale: 1, angle: 0 };
export const MAP_MAX_SCALE = 8;

/** Keeps the zoom between 1 and MAP_MAX_SCALE, and the picture's middle within
 *  reach of the frame, so the map can never be lost off screen. half is half
 *  the frame's width in pixels. */
export function clampView(view: MapView, half: number): MapView {
  const scale = Math.min(MAP_MAX_SCALE, Math.max(1, view.scale));
  const limit = half * scale;
  const bound = (value: number) => Math.min(limit, Math.max(-limit, value));
  return { x: bound(view.x), y: bound(view.y), scale, angle: view.angle };
}

/** The view after zooming by factor and turning by turn degrees about the point
 *  at (px, py) from the frame's middle, so the ground under that point stays
 *  under it, as under two fingers. */
export function zoomTurnAbout(view: MapView, px: number, py: number, factor: number, turn: number, half: number): MapView {
  const scale = Math.min(MAP_MAX_SCALE, Math.max(1, view.scale * factor));
  const k = scale / view.scale;
  const r = (turn * Math.PI) / 180;
  const dx = view.x - px;
  const dy = view.y - py;
  return clampView(
    {
      x: px + k * (dx * Math.cos(r) - dy * Math.sin(r)),
      y: py + k * (dx * Math.sin(r) + dy * Math.cos(r)),
      scale,
      angle: (view.angle + turn) % 360,
    },
    half,
  );
}
