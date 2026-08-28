import { describe, expect, it } from 'vitest';
import { CARDINAL_POINTS } from '../../src/core/copy';
import { bboxAround, bearingDeg, cardinal, distanceM, withinRadius } from '../../src/core/geo';
import { CBD, KALORAMA } from '../fixtures';

// Reference figures computed independently of Turf (haversine, R = 6 371 008.8 m)
// so this suite would catch a wrong library as well as a wrong call.
const KALORAMA_TO_CBD_M = 35_041.6;
const KALORAMA_TO_CBD_DEG = 269.77;

describe('distanceM', () => {
  it('matches an independent haversine for the reference pair, within 5%', () => {
    expect(distanceM(KALORAMA, CBD)).toBeCloseTo(KALORAMA_TO_CBD_M, -2);
    expect(Math.abs(distanceM(KALORAMA, CBD) - KALORAMA_TO_CBD_M) / KALORAMA_TO_CBD_M).toBeLessThan(
      0.05,
    );
  });

  it('is symmetric', () => {
    expect(distanceM(KALORAMA, CBD)).toBeCloseTo(distanceM(CBD, KALORAMA), 6);
  });

  it('is zero for a point against itself', () => {
    expect(distanceM(KALORAMA, KALORAMA)).toBe(0);
  });
});

describe('bearingDeg', () => {
  it('matches the independent reference within 5 degrees', () => {
    expect(Math.abs(bearingDeg(KALORAMA, CBD) - KALORAMA_TO_CBD_DEG)).toBeLessThan(5);
  });

  it('normalises to 0-360 rather than returning a negative westerly bearing', () => {
    const west = bearingDeg(KALORAMA, CBD);
    expect(west).toBeGreaterThan(0);
    expect(west).toBeLessThan(360);
  });

  it('reads 0 due north and about 90 due east', () => {
    expect(bearingDeg(KALORAMA, { lat: KALORAMA.lat + 0.05, lon: KALORAMA.lon })).toBeCloseTo(0, 5);
    expect(
      Math.abs(bearingDeg(KALORAMA, { lat: KALORAMA.lat, lon: KALORAMA.lon + 0.05 }) - 90),
    ).toBeLessThan(1);
  });
});

describe('cardinal', () => {
  it('names every one of the 16 sectors at its 22.5 degree centre', () => {
    CARDINAL_POINTS.forEach((name, i) => {
      expect(cardinal(i * 22.5)).toBe(name);
    });
  });

  it('wraps at and beyond 360', () => {
    expect(cardinal(360)).toBe('NORTH');
    expect(cardinal(720)).toBe('NORTH');
    expect(cardinal(382.5)).toBe('NORTH-NORTH-EAST');
  });

  it('handles a negative bearing', () => {
    expect(cardinal(-22.5)).toBe('NORTH-NORTH-WEST');
    expect(cardinal(-90)).toBe('WEST');
  });
});

describe('withinRadius', () => {
  // Latitude offsets, so the distance is independent of the cosine term.
  const north = (km: number) => ({ lat: KALORAMA.lat + km / 111.195, lon: KALORAMA.lon });

  it('is INCLUSIVE: a point exactly on the radius is inside', () => {
    const p = north(6);
    const exact = distanceM(KALORAMA, p) / 1000;
    expect(withinRadius(KALORAMA, p, exact)).toBe(true);
    expect(withinRadius(KALORAMA, p, exact + 0.001)).toBe(true);
    expect(withinRadius(KALORAMA, p, exact - 0.001)).toBe(false);
  });

  it('holds at the 5.99 / 6.00 / 6.01 km boundary of a 6 km pack', () => {
    expect(withinRadius(KALORAMA, north(5.99), 6)).toBe(true);
    expect(withinRadius(KALORAMA, north(6.01), 6)).toBe(false);
    expect(distanceM(KALORAMA, north(6))).toBeCloseTo(6000, -1);
  });
});

describe('bboxAround', () => {
  it('brackets the centre', () => {
    const [minLon, minLat, maxLon, maxLat] = bboxAround(KALORAMA, 6);
    expect(minLon).toBeLessThan(KALORAMA.lon);
    expect(maxLon).toBeGreaterThan(KALORAMA.lon);
    expect(minLat).toBeLessThan(KALORAMA.lat);
    expect(maxLat).toBeGreaterThan(KALORAMA.lat);
  });

  it('is wider in longitude than in latitude at Victorian latitudes', () => {
    const [minLon, minLat, maxLon, maxLat] = bboxAround(KALORAMA, 6);
    expect(maxLon - minLon).toBeGreaterThan(maxLat - minLat);
  });

  it('grows with the radius', () => {
    const small = bboxAround(KALORAMA, 6);
    const large = bboxAround(KALORAMA, 12);
    expect(large[2] - large[0]).toBeGreaterThan(small[2] - small[0]);
  });
});
