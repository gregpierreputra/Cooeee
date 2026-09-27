import { describe, expect, it } from 'vitest';
import {
  ROADS_LOCALITY_CENTRE_PX,
  ROADS_LOCALITY_COUNT,
  ROADS_LOCALITY_EDGE_PX,
  ROADS_LOCALITY_SPACING_PX,
} from '../../src/core/constants';
import { chooseLocalities, decodeLocalities, localityWidthPx, type Locality } from '../../src/core/localities';
import type { Obstacle } from '../../src/core/roads';

// BS_Enhancement-AC5: locality names on the map disc, "Whole way" only.

const HERE = { lat: -37.88, lon: 145.34 };
const M_PER_DEG = (6_371_008.8 * Math.PI) / 180;
const MX = M_PER_DEG * Math.cos((HERE.lat * Math.PI) / 180);
const MPP = 10; // metres a pixel
const R = 150; // the disc's radius in pixels

/** A locality at a pixel offset from the person, x east and y down. */
const at = (name: string, x: number, y: number): Locality => ({
  name,
  lat: HERE.lat - (y * MPP) / M_PER_DEG,
  lon: HERE.lon + (x * MPP) / MX,
});
const choose = (localities: Locality[], samples: [number, number][] = [], obstacles: Obstacle[] = []) =>
  chooseLocalities(localities, HERE, MPP, R, samples, obstacles).map((p) => p.name);

describe('reading the file', () => {
  it('takes [name, lat, lon] rows in Victoria', () => {
    expect(decodeLocalities([['FERNY CREEK', -37.87672, 145.33533]])).toEqual([
      { name: 'FERNY CREEK', lat: -37.87672, lon: 145.33533 },
    ]);
    expect(decodeLocalities([])).toEqual([]);
  });

  it('refuses anything else', () => {
    expect(() => decodeLocalities({})).toThrow(TypeError);
    expect(() => decodeLocalities([['FERNY CREEK', -37.8]])).toThrow(TypeError);
    expect(() => decodeLocalities([['', -37.8, 145.3]])).toThrow(TypeError);
    expect(() => decodeLocalities([['FERNY CREEK', '-37.8', 145.3]])).toThrow(TypeError);
    expect(() => decodeLocalities([['SYDNEY', -33.87, 151.21]])).toThrow(TypeError); // not in Victoria
    expect(() => decodeLocalities(['FERNY CREEK'])).toThrow(TypeError);
  });
});

describe('the locality rule', () => {
  it('names nothing within 46 px of the centre, nor within 30 px of the edge', () => {
    expect([ROADS_LOCALITY_CENTRE_PX, ROADS_LOCALITY_EDGE_PX]).toEqual([46, 30]);
    expect(choose([at('INNER', 45, 0)])).toEqual([]);
    expect(choose([at('INNER', 47, 0)])).toEqual(['INNER']);
    expect(choose([at('OUTER', 0, R - 29)])).toEqual([]);
    expect(choose([at('OUTER', 0, R - 31)])).toEqual(['OUTER']);
    // Beyond the disc altogether: not even considered.
    expect(choose([at('FAR', 0, 5 * R)])).toEqual([]);
  });

  it('puts names in upper case', () => {
    expect(choose([at('Ferny Creek', 60, 0)])).toEqual(['FERNY CREEK']);
  });

  it('takes the nearest first and skips one within 62 px of a name already placed', () => {
    expect(ROADS_LOCALITY_SPACING_PX).toBe(62);
    // Placed at 60 px; one 61 px from it is skipped, one 63 px away is kept.
    const near = at('NEAR', 60, 0);
    expect(choose([at('CLOSE', 60, 61), near])).toEqual(['NEAR']);
    expect(choose([at('APART', 60, 63), near])).toEqual(['NEAR', 'APART']);
    // The nearer of two close names wins, whichever came first in the file.
    expect(choose([at('FURTHER', 0, 100), at('NEARER', 0, 60)])).toEqual(['NEARER']);
  });

  it('never sets a name where it could touch a road name: road names win', () => {
    const place = at('HAMPTON', 80, 0);
    const reach = localityWidthPx('HAMPTON') / 2;
    // A road name's point just inside the circle the name sweeps as the map
    // turns (its half width, and half a road name's height): skipped.
    expect(choose([place], [[80, reach + 6.9]])).toEqual([]);
    expect(choose([place], [[80, reach + 7.1]])).toEqual(['HAMPTON']);
  });

  it('keeps clear of an obstacle, the pin', () => {
    const place = at('HALLAM', 80, 0);
    const reach = localityWidthPx('HALLAM') / 2;
    expect(choose([place], [], [{ x: 80, y: -(reach + 23), r: 24 }])).toEqual([]);
    expect(choose([place], [], [{ x: 80, y: -(reach + 25), r: 24 }])).toEqual(['HALLAM']);
  });

  it('names at most eight', () => {
    expect(ROADS_LOCALITY_COUNT).toBe(8);
    // Twelve round a ring of about 140 px, over 70 px apart, each a pixel
    // further out than the last: eight are kept, the eight nearest.
    const ring = Array.from({ length: 12 }, (_, i) => {
      const angle = (i * Math.PI) / 6;
      return at(`P${i}`, (140 + i) * Math.sin(angle), -(140 + i) * Math.cos(angle));
    });
    const names = chooseLocalities(ring, HERE, MPP, 400, [], []).map((p) => p.name);
    expect(names).toHaveLength(8);
    expect(names).toEqual(['P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7']);
  });

  it('returns each name at its point on the disc', () => {
    const [place] = chooseLocalities([at('BOX HILL', 0, -90)], HERE, MPP, R, []);
    expect(place.name).toBe('BOX HILL');
    expect(place.x).toBeCloseTo(0, 6);
    expect(place.y).toBeCloseTo(-90, 6);
  });
});
