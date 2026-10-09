import { describe, expect, it } from 'vitest';
import { clampView, mapAcrossKm, mapBoxAround, mapBoxOf, mapPoint, MAP_HOME, zoomAbout } from '../../src/core/area-map-view';

const centre = { lat: -37.8, lon: 145.3 };
const box = mapBoxAround(centre, 40);

describe('the stored map box', () => {
  it('places the centre in the middle, north at the top and east to the right', () => {
    expect(mapPoint(box, centre)).toEqual({ x: expect.closeTo(0.5, 9), y: expect.closeTo(0.5, 9) });
    expect(mapPoint(box, { lat: box.north, lon: box.west })).toEqual({ x: 0, y: 0 });
    expect(mapPoint(box, { lat: centre.lat - 0.1, lon: centre.lon + 0.1 })!.y).toBeGreaterThan(0.5);
    expect(mapPoint(box, { lat: centre.lat, lon: box.east + 0.01 })).toBeNull();
  });

  it('reads the box back from the request, and refuses one that is not a box', () => {
    const url = `https://example.org/wms?bbox=${[box.west, box.south, box.east, box.north].join(',')}`;
    expect(mapBoxOf(url)).toEqual(box);
    expect(mapAcrossKm(box)).toBe(80);
    expect(mapBoxOf('https://example.org/wms?bbox=1,2,3')).toBeNull();
    expect(mapBoxOf('https://example.org/wms?bbox=3,2,1,4')).toBeNull();
    expect(mapBoxOf('not a url')).toBeNull();
  });
});

describe('zoomAbout', () => {
  it('keeps the ground under the fingers still while zooming', () => {
    const view = zoomAbout(MAP_HOME, 40, -20, 2, 200);
    // The layer point that was under (40, -20) maps back to (40, -20).
    expect(view.x + view.scale * 40).toBeCloseTo(40, 9);
    expect(view.y + view.scale * -20).toBeCloseTo(-20, 9);
  });

  it('never zooms out past the whole map or in past eight times', () => {
    expect(zoomAbout(MAP_HOME, 0, 0, 0.5, 200).scale).toBe(1);
    expect(zoomAbout(MAP_HOME, 0, 0, 20, 200).scale).toBe(8);
  });
});

describe('clampView', () => {
  it('never moves the picture off any part of the frame', () => {
    // Fully zoomed out the picture already fills the frame: it cannot move.
    const still = clampView({ x: 150, y: -150, scale: 1 }, 200);
    expect(still.x).toBeCloseTo(0);
    expect(still.y).toBeCloseTo(0);
    expect(still.scale).toBe(1);
    // At twice the size it moves at most half the frame, to the picture's edge.
    expect(clampView({ x: 900, y: -900, scale: 2 }, 200)).toEqual({ x: 200, y: -200, scale: 2 });
  });
});
