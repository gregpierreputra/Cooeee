import { describe, expect, it } from 'vitest';
import { mapAcrossKm, mapBoxAround, mapBoxOf, mapPoint, MAP_HOME, zoomTurnAbout } from '../../src/core/area-map-view';

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

describe('zoomTurnAbout', () => {
  it('keeps the ground under the fingers still while zooming and turning', () => {
    const view = zoomTurnAbout(MAP_HOME, 40, -20, 2, 30, 200);
    // The layer point that was under (40, -20) maps back to (40, -20).
    const r = (view.angle * Math.PI) / 180;
    const q = { x: 40, y: -20 };
    const x = view.x + view.scale * (q.x * Math.cos(r) - q.y * Math.sin(r));
    const y = view.y + view.scale * (q.x * Math.sin(r) + q.y * Math.cos(r));
    expect(x).toBeCloseTo(40, 9);
    expect(y).toBeCloseTo(-20, 9);
  });

  it('never zooms out past the whole map or in past eight times', () => {
    expect(zoomTurnAbout(MAP_HOME, 0, 0, 0.5, 0, 200).scale).toBe(1);
    expect(zoomTurnAbout(MAP_HOME, 0, 0, 20, 0, 200).scale).toBe(8);
  });
});
