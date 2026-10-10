import { describe, expect, it } from 'vitest';
import { NEARBY_MAP_HALF_PX } from '../../src/core/constants';
import type { Locality } from '../../src/core/localities';
import { drawNearbyMap } from '../../src/core/nearby-map';
import { decodeRoads, project } from '../../src/core/roads';
import { encodeRoads } from '../../src/core/roads-format';
import { KALORAMA } from '../fixtures';

const roads = decodeRoads(
  encodeRoads(
    [{ cls: 1, name: 'Test Highway', points: [[145.2, -37.813], [145.5, -37.813]] }],
    25,
    { gridM: 5, lon0: 145, lat0: -37 },
  ).bytes.buffer as ArrayBuffer,
);
// Two towns about 9 km either side of the middle, east and west: past the
// clear ring the town rule keeps round the centre mark.
const towns: Locality[] = [
  { name: 'Eastville', lat: KALORAMA.lat, lon: 145.462 },
  { name: 'Westville', lat: KALORAMA.lat, lon: 145.262 },
];

describe('drawNearbyMap', () => {
  it('draws the roads and the towns round the origin', () => {
    const map = drawNearbyMap(roads, towns, KALORAMA);
    expect(map.roads.length).toBeGreaterThan(0);
    expect(map.names.map((n) => n.name).sort()).toEqual(['EASTVILLE', 'WESTVILLE']);
  });

  it('keeps a town name out from under a place mark', () => {
    const map = drawNearbyMap(roads, towns, KALORAMA, [{ lat: KALORAMA.lat, lon: 145.462 }]);
    expect(map.names.map((n) => n.name)).toEqual(['WESTVILLE']);
  });

  it('still names the towns without the roads file', () => {
    const map = drawNearbyMap(null, towns, KALORAMA);
    expect(map.roads).toEqual([]);
    expect(map.names).toHaveLength(2);
  });

  it('draws on the same ground the marks are placed on', () => {
    // 20 km east of the middle is the picture's right edge.
    const [x] = project(KALORAMA, (20_000) / NEARBY_MAP_HALF_PX, KALORAMA.lon + 20 / (111.195 * Math.cos((KALORAMA.lat * Math.PI) / 180)), KALORAMA.lat);
    expect(x).toBeCloseTo(NEARBY_MAP_HALF_PX, 0);
  });
});
