import { describe, expect, it } from 'vitest';
import { areaMapHalfKm, clampView, mapAcrossKm, mapBoxAround, mapBoxOf, mapMaxScale, mapPoint, MAP_HOME, MAP_MAX_SCALE, zoomAbout } from '../../src/core/area-map-view';

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

// A pack's map takes in the places chosen for it: the usual 40 km, wider to
// reach the farthest with room to spare, and no wider than 120 km.
describe('areaMapHalfKm', () => {
  const kmEast = (km: number) => ({ lat: centre.lat, lon: centre.lon + km / (111 * Math.cos((centre.lat * Math.PI) / 180)) });
  const kmNorth = (km: number) => ({ lat: centre.lat + km / 111, lon: centre.lon });

  it('keeps the usual 20 km each way when every place is on it', () => {
    expect(areaMapHalfKm(centre, [])).toBe(20);
    expect(areaMapHalfKm(centre, [kmEast(5), kmNorth(-12)])).toBe(20);
  });

  it('widens to the farthest place east, west, north or south, with room past it', () => {
    expect(areaMapHalfKm(centre, [kmEast(5), kmEast(-30.2)])).toBe(34);
    expect(areaMapHalfKm(centre, [kmNorth(41)])).toBe(44);
  });

  it('puts every place it widens for on the map', () => {
    const places = [kmEast(-30.2), kmNorth(41)];
    const wide = mapBoxAround(centre, areaMapHalfKm(centre, places));
    for (const place of places) expect(mapPoint(wide, place)).not.toBeNull();
  });

  it('reaches no further than 60 km each way', () => {
    expect(areaMapHalfKm(centre, [kmEast(95)])).toBe(60);
  });
});

describe('mapMaxScale', () => {
  it('zooms a wider map further in, so home reads as closely as on 40 km', () => {
    expect(mapMaxScale(mapBoxAround(centre, 20))).toBe(MAP_MAX_SCALE);
    expect(mapMaxScale(mapBoxAround(centre, 60))).toBe(MAP_MAX_SCALE * 3);
    expect(mapMaxScale(null)).toBe(MAP_MAX_SCALE);
    expect(clampView({ x: 0, y: 0, scale: 50 }, 100, mapMaxScale(mapBoxAround(centre, 60))).scale).toBe(24);
  });
});
