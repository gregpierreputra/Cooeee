// Ready the Block — the camera over the yard, as plain arithmetic so it can be
// tested without a screen. Everything here is in DEVICE pixels for the screen
// and SOURCE pixels for the yard. The zoom is always a whole number of device
// pixels to one source pixel, so every pixel of the art stays square.

import { BLOCK_HEIGHT, BLOCK_TILE, BLOCK_WIDTH } from './block-layout';

/** Where the picture's top left corner is over the yard, in source pixels,
 *  and the zoom, in device pixels per source pixel. */
export type Camera = { left: number; top: number; scale: number };
export type Viewport = { width: number; height: number };

/** About this many tiles fit across at the starting zoom: close enough that
 *  each thing is easy to tap, wide enough to see where it is. */
const START_TILES_ACROSS = 14;
/** The closest zoom shows at least this many tiles across. */
const CLOSEST_TILES_ACROSS = 6;

/** The zooms on offer, from the whole yard in view to close up. */
export function zoomLevels(view: Viewport): { min: number; start: number; max: number } {
  const whole = Math.max(1, Math.floor(Math.min(view.width / BLOCK_WIDTH, view.height / BLOCK_HEIGHT)));
  const start = Math.max(whole, Math.round(view.width / (START_TILES_ACROSS * BLOCK_TILE)));
  const max = Math.max(start, Math.floor(view.width / (CLOSEST_TILES_ACROSS * BLOCK_TILE)));
  return { min: whole, start, max };
}

/** Keep the yard on screen: a side larger than the view never scrolls past
 *  its edge, and a side smaller than the view sits in the middle of it. */
export function clampCamera(camera: Camera, view: Viewport): Camera {
  const across = view.width / camera.scale;
  const down = view.height / camera.scale;
  const fit = (start: number, shown: number, total: number) =>
    total <= shown ? -(shown - total) / 2 : Math.min(total - shown, Math.max(0, start));
  return { scale: camera.scale, left: fit(camera.left, across, BLOCK_WIDTH), top: fit(camera.top, down, BLOCK_HEIGHT) };
}

/** A camera at this zoom with the yard point (x, y), in source pixels, in
 *  the middle of the view. */
export const centredOn = (x: number, y: number, scale: number, view: Viewport): Camera =>
  clampCamera({ scale, left: x - view.width / scale / 2, top: y - view.height / scale / 2 }, view);

/** The yard point, in source pixels, under a screen point in device pixels. */
export const screenToYard = (px: number, py: number, camera: Camera): { x: number; y: number } => ({
  x: camera.left + px / camera.scale,
  y: camera.top + py / camera.scale,
});

/** A new zoom that keeps the yard point under (px, py) where it is on screen. */
export function zoomAbout(camera: Camera, scale: number, px: number, py: number, view: Viewport): Camera {
  const { x, y } = screenToYard(px, py, camera);
  return clampCamera({ scale, left: x - px / scale, top: y - py / scale }, view);
}

/** Move the picture with a drag of (dx, dy) device pixels. */
export const panBy = (camera: Camera, dx: number, dy: number, view: Viewport): Camera =>
  clampCamera({ ...camera, left: camera.left - dx / camera.scale, top: camera.top - dy / camera.scale }, view);

/** The zoom a pinch has reached: the starting zoom times how far the fingers
 *  have spread, rounded to a whole number and held within the levels. */
export const pinchScale = (start: number, ratio: number, levels: { min: number; max: number }): number =>
  Math.min(levels.max, Math.max(levels.min, Math.round(start * ratio)));

/** A press and release counts as a tap when it barely moved and was short:
 *  anything more is a drag to look around, and marks nothing. */
export const isTap = (moved: number, ms: number, slop: number): boolean => moved <= slop && ms <= 600;
