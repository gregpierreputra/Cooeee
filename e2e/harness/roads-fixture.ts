import { encodeRoads, type SourceLine } from '../../src/core/roads-format';

// A few synthetic roads round the harness pack at Ferny Creek (-37.88, 145.34),
// long enough to cross the dial in both views, one of each kind the width rule
// tells apart. Written with the real encoder, so the dial reads a real file.
// Synthetic, like everything in the harness: the names are for reading, not a map.
const line = (cls: number, name: string, points: [number, number][]): SourceLine => ({ cls, name, points });

export const ROADS_FIXTURE_LINES: SourceLine[] = [
  // East-west, 500 m north of the pack centre.
  line(1, 'Fixture Highway', [[145.26, -37.8755], [145.3, -37.8755], [145.42, -37.8755]]),
  // North-south, 900 m west of it.
  line(2, 'Fixture Arterial Road', [[145.3298, -37.95], [145.3298, -37.88], [145.3298, -37.8]]),
  // A freeway on the diagonal, and a ramp off it under a kilometre long.
  line(0, 'Fixture Freeway', [[145.28, -37.94], [145.34, -37.89], [145.4, -37.84]]),
  line(0, 'Fixture Freeway Ramp', [[145.3525, -37.8795], [145.3565, -37.8765]]),
  // A collector south of the centre.
  line(3, 'Fixture Collector Street', [[145.3, -37.8935], [145.38, -37.8935]]),
  // A line with no name: drawn, never labelled.
  line(2, '', [[145.36, -37.9], [145.36, -37.86]]),
];

export const roadsFixture = (): ArrayBuffer =>
  encodeRoads(ROADS_FIXTURE_LINES, 25, { gridM: 5, lon0: 145, lat0: -37 }).bytes.buffer as ArrayBuffer;

// Six synthetic localities, 1.8 km from the pack centre at every 60 degrees
// from north, as the file holds them: [name, lat, lon]. At the whole-way view
// they fall in the band the locality rule names (clear of the arrow and of the
// disc's edge); in "Near me" none is drawn.
export const LOCALITIES_FIXTURE: [string, number, number][] = [
  ['ALPHA', -37.8638, 145.34],
  ['BRAVO', -37.8719, 145.3578],
  ['CHARLIE', -37.8881, 145.3578],
  ['DELTA', -37.8962, 145.34],
  ['ECHO', -37.8881, 145.3222],
  ['FOXTROT', -37.8719, 145.3222],
];
