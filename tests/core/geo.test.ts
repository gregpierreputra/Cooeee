import { describe, expect, it } from 'vitest';
import { CARDINAL_ABBR } from '../../src/core/copy';
import { arrowGlyph, bearingDeg, cardinalAbbr, distanceM } from '../../src/core/geo';
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

describe('cardinalAbbr', () => {
  it('names every one of the 16 sectors at its 22.5 degree centre', () => {
    CARDINAL_ABBR.forEach((name, i) => {
      expect(cardinalAbbr(i * 22.5)).toBe(name);
    });
  });

  it('wraps at and beyond 360', () => {
    expect(cardinalAbbr(360)).toBe('N');
    expect(cardinalAbbr(720)).toBe('N');
    expect(cardinalAbbr(382.5)).toBe('NNE');
  });

  it('handles a negative bearing', () => {
    expect(cardinalAbbr(-22.5)).toBe('NNW');
    expect(cardinalAbbr(-90)).toBe('W');
  });
});

describe('arrowGlyph', () => {
  it('points north at 0 and rotates one glyph per 45-degree sector', () => {
    expect(arrowGlyph(0)).toBe('↑');
    expect(arrowGlyph(45)).toBe('↗');
    expect(arrowGlyph(180)).toBe('↓');
    expect(arrowGlyph(315)).toBe('↖');
  });
});
