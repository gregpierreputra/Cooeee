import { describe, expect, it } from 'vitest';
import {
  ROADS_LOCALITY_CENTRE_PX,
  ROADS_LOCALITY_COUNT,
  ROADS_LOCALITY_EDGE_PX,
  ROADS_LOCALITY_PAD_PX,
  ROADS_LOCALITY_SPACING_PX,
} from '../../src/core/constants';
import {
  chooseLocalities,
  decodeLocalities,
  estimateLocalityPx,
  localityAt,
  type Locality,
} from '../../src/core/localities';
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

  // Every name 60 px wide as drawn, so the box is plain to work out: 30 px
  // each side of its point and 4.75 px above and below, and 4 px round that.
  const sixty = () => 60;
  const halfW = 30 + ROADS_LOCALITY_PAD_PX;
  const halfH = 9.5 / 2 + ROADS_LOCALITY_PAD_PX;
  const withBox = (samples: [number, number][], obstacles: Obstacle[] = []) =>
    chooseLocalities([at('HAMPTON', 80, 0)], HERE, MPP, R, samples, obstacles, { measure: sixty }).map(
      (p) => p.name,
    );

  it('keeps its upright box, with 4 px round it, clear of every road name: road names win', () => {
    expect(ROADS_LOCALITY_PAD_PX).toBe(4);
    // A road name is a band 14 px high along its points: 7 px either side.
    expect(withBox([[80 + halfW + 6.9, 0]])).toEqual([]);
    expect(withBox([[80 + halfW + 7.1, 0]])).toEqual(['HAMPTON']);
    expect(withBox([[80, halfH + 6.9]])).toEqual([]);
    expect(withBox([[80, halfH + 7.1]])).toEqual(['HAMPTON']);
    // Above the name, inside its half width but outside its box: clear. The
    // old rule, a half width every way, would have skipped it.
    expect(withBox([[80, -25]])).toEqual(['HAMPTON']);
  });

  it('keeps its box clear of an obstacle, the pin', () => {
    expect(withBox([], [{ x: 80, y: -(halfH + 23.9), r: 24 }])).toEqual([]);
    expect(withBox([], [{ x: 80, y: -(halfH + 24.1), r: 24 }])).toEqual(['HAMPTON']);
    // Off a corner of the box, by the true distance to the corner.
    const corner = 24 / Math.SQRT2;
    expect(withBox([], [{ x: 80 + halfW + corner - 0.1, y: halfH + corner - 0.1, r: 24 }])).toEqual([]);
    expect(withBox([], [{ x: 80 + halfW + corner + 0.1, y: halfH + corner + 0.1, r: 24 }])).toEqual(['HAMPTON']);
  });

  it("tries the chosen place's own locality first, then the rest nearest first", () => {
    const near = at('NEAR', 60, 0);
    const home = at('HOME', 100, 0); // 40 px from NEAR: only one of the two can be named
    expect(choose([near, home])).toEqual(['NEAR']);
    // The place lies in HOME (its point is the nearest to the place): HOME wins.
    const place = { lat: home.lat + 0.0001, lon: home.lon };
    const names = chooseLocalities([near, home], HERE, MPP, R, [], [], { place }).map((p) => p.name);
    expect(names).toEqual(['HOME']);
    expect(localityAt([near, home], place)).toBe(home);
    expect(localityAt([], place)).toBeNull();
  });

  it('estimates a name at 9.5 px capitals with 1 px spacing when no measure is given', () => {
    expect(estimateLocalityPx('ABCD')).toBeCloseTo(4 * 9.5 * 0.68 + 4, 9);
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
