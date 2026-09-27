import { describe, expect, it } from 'vitest';
import {
  ROADS_CLASS_LIMITS,
  ROADS_LABEL_COUNT,
  ROADS_LABEL_STRETCH,
  ROADS_MAX_RADIUS_M,
  ROADS_MIN_RADIUS_M,
  ROADS_NEAR_RADIUS_M,
  ROADS_RAMP_IN_WHOLE_WAY,
  ROADS_REDRAW_M,
  ROADS_REDRAW_SHARE,
} from '../../src/core/constants';
import {
  chainRuns,
  chooseLabels,
  clipToCircle,
  cutPolyline,
  decodeRoads,
  drawRoads,
  drawnInView,
  estimateTextPx,
  fillWidthPx,
  highestClassDrawn,
  isRamp,
  linesNear,
  offsetLatLon,
  pathData,
  placeInView,
  polylineLength,
  project,
  redrawDistanceM,
  roadWidthPx,
  straightness,
  viewRadiusM,
  type RoadLine,
  type RoadMap,
} from '../../src/core/roads';
import { encodeRoads, type SourceLine } from '../../src/core/roads-format';

// BS_Enhancement-AC5: the pure rules behind the roads inside the dial.

const FRAME = { gridM: 5, lon0: 145, lat0: -37 };
const HERE = { lat: -37.88, lon: 145.34 };
// Metres per degree at HERE, the same flat scale the rules use.
const M_PER_DEG = (6_371_008.8 * Math.PI) / 180;
const MX = M_PER_DEG * Math.cos((HERE.lat * Math.PI) / 180);

/** A line from metre offsets east and north of HERE. */
const lineAt = (name: string, cls: number, offsets: [number, number][], lengthM = 5_000): RoadLine => {
  const lonLat = new Float64Array(offsets.flatMap(([e, n]) => [HERE.lon + e / MX, HERE.lat + n / M_PER_DEG]));
  const lons = offsets.map(([e]) => HERE.lon + e / MX);
  const lats = offsets.map(([, n]) => HERE.lat + n / M_PER_DEG);
  return {
    name,
    cls,
    lonLat,
    box: [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)],
    lengthM,
  };
};

describe('reading the file', () => {
  it('gives every line its bounding box and its length', () => {
    const source: SourceLine = {
      cls: 2,
      name: 'Test Road',
      points: [
        [145.34, -37.88],
        [145.35, -37.88],
        [145.35, -37.87],
      ],
    };
    const { lines } = decodeRoads(encodeRoads([source], 25, FRAME).bytes.buffer as ArrayBuffer);
    expect(lines).toHaveLength(1);
    const [minLon, minLat, maxLon, maxLat] = lines[0].box;
    expect(minLon).toBeCloseTo(145.34, 4);
    expect(maxLon).toBeCloseTo(145.35, 4);
    expect(minLat).toBeCloseTo(-37.88, 4);
    expect(maxLat).toBeCloseTo(-37.87, 4);
    // 0.01 degrees east (about 880 m here) and 0.01 north (about 1112 m).
    expect(lines[0].lengthM).toBeGreaterThan(1_980);
    expect(lines[0].lengthM).toBeLessThan(2_010);
  });
});

describe('the circle filter', () => {
  const R = 1_500;
  const map = (east: number): RoadMap => ({
    lines: [lineAt('Edge Road', 2, [[east, -500], [east, 500]])],
  });

  it('keeps a line whose box just reaches the circle, and drops one just beyond it', () => {
    expect(linesNear(map(R - 0.01), HERE, R)).toHaveLength(1);
    expect(linesNear(map(R + 0.01), HERE, R)).toHaveLength(0);
  });

  it('judges the box corner by its true distance, not by a square round the circle', () => {
    // A corner 1.2 km east and 1.2 km north is inside the square but 1.7 km away.
    const corner: RoadMap = { lines: [lineAt('Corner Road', 2, [[1_200, 1_200], [2_000, 2_000]])] };
    expect(linesNear(corner, HERE, R)).toHaveLength(0);
    expect(linesNear(corner, HERE, 1_700)).toHaveLength(1);
  });

  it('keeps a line that crosses the circle with both ends outside it', () => {
    const across: RoadMap = { lines: [lineAt('Across Road', 1, [[-5_000, 0], [5_000, 0]])] };
    expect(linesNear(across, HERE, R)).toHaveLength(1);
  });
});

describe('the projection', () => {
  it('puts the person at the centre and the ground at its true offset, north up', () => {
    const [cx, cy] = project(HERE, 10, HERE.lon, HERE.lat);
    expect(cx + 0).toBe(0);
    expect(cy + 0).toBe(0); // + 0 folds -0 into 0: the same pixel
    const [nx, ny] = project(HERE, 10, HERE.lon, HERE.lat + 1_000 / M_PER_DEG);
    expect(nx).toBeCloseTo(0, 9);
    expect(ny).toBeCloseTo(-100, 9); // 1 km north at 10 m a pixel: 100 px up
    const [ex, ey] = project(HERE, 10, HERE.lon + 1_000 / MX, HERE.lat);
    expect(ex).toBeCloseTo(100, 9);
    expect(ey).toBeCloseTo(0, 9);
    const [sx, sy] = project(HERE, 20, HERE.lon - 500 / MX, HERE.lat - 500 / M_PER_DEG);
    expect(sx).toBeCloseTo(-25, 9);
    expect(sy).toBeCloseTo(25, 9);
  });
});

describe('where the place is', () => {
  it("lies at its distance along its bearing, on the projection's own scale", () => {
    const east = offsetLatLon(HERE, 1_000, 90);
    const [ex, ey] = project(HERE, 10, east.lon, east.lat);
    expect(ex).toBeCloseTo(100, 6);
    expect(ey).toBeCloseTo(0, 6);
    const north = offsetLatLon(HERE, 500, 0);
    const [nx, ny] = project(HERE, 10, north.lon, north.lat);
    expect(nx).toBeCloseTo(0, 6);
    expect(ny).toBeCloseTo(-50, 6);
  });
});

describe('the view', () => {
  it('near me is always the same ground', () => {
    expect(viewRadiusM('near', 100)).toBe(ROADS_NEAR_RADIUS_M);
    expect(viewRadiusM('near', 50_000)).toBe(ROADS_NEAR_RADIUS_M);
  });

  it('whole way reaches the place and 15 % beyond, within 1.5 and 30 km', () => {
    expect(viewRadiusM('whole', 0)).toBe(ROADS_MIN_RADIUS_M);
    expect(viewRadiusM('whole', 1_000)).toBe(ROADS_MIN_RADIUS_M);
    // The lower limit: 1.5 km / 1.15 is the last distance it holds for.
    expect(viewRadiusM('whole', 1_304)).toBe(ROADS_MIN_RADIUS_M);
    expect(viewRadiusM('whole', 1_305)).toBeCloseTo(1_500.75, 6);
    expect(viewRadiusM('whole', 10_000)).toBeCloseTo(11_500, 6);
    // The upper limit: 30 km / 1.15 is about 26.09 km.
    expect(viewRadiusM('whole', 26_000)).toBeCloseTo(29_900, 6);
    expect(viewRadiusM('whole', 26_100)).toBe(ROADS_MAX_RADIUS_M);
    expect(viewRadiusM('whole', 200_000)).toBe(ROADS_MAX_RADIUS_M);
  });

  it('redraws after 50 m, or 1 % of the view radius once that is more', () => {
    expect(ROADS_REDRAW_M).toBe(50);
    expect(ROADS_REDRAW_SHARE).toBe(0.01);
    // The floor: in the near view 1 % is 15 m, so 50 m holds.
    expect(redrawDistanceM(ROADS_NEAR_RADIUS_M)).toBe(50);
    // Where the two meet: 1 % of 5 km is exactly 50 m.
    expect(redrawDistanceM(5_000)).toBe(50);
    expect(redrawDistanceM(5_100)).toBe(51);
    // The ceiling: in the widest view 1 % is 300 m.
    expect(redrawDistanceM(ROADS_MAX_RADIUS_M)).toBe(300);
  });

  it('the pin comes inside at its true spot when the place is in view, and stays on the ring when not', () => {
    const due = placeInView(750, 0, 1_500, 78)!;
    expect(due.r).toBe(39);
    expect(due.x).toBeCloseTo(0, 9);
    expect(due.y).toBeCloseTo(-39, 9);
    const east = placeInView(1_000, 90, 2_000, 100)!;
    expect(east.x).toBeCloseTo(50, 9);
    expect(east.y).toBeCloseTo(0, 9);
    expect(placeInView(1_500, 0, 1_500, 78)).toBeNull(); // on the edge: the ring
    expect(placeInView(2_600, 0, 1_500, 78)).toBeNull();
  });
});

describe('the width rule', () => {
  it('steps down from freeway to collector, wider near the person, with a freeway ramp at the collector width', () => {
    const widths = (view: 'whole' | 'near') => [
      roadWidthPx({ cls: 0, lengthM: 12_000 }, view),
      roadWidthPx({ cls: 0, lengthM: 1_000 }, view),
      roadWidthPx({ cls: 0, lengthM: 999 }, view), // a ramp
      roadWidthPx({ cls: 1, lengthM: 200 }, view),
      roadWidthPx({ cls: 2, lengthM: 5_000 }, view),
      roadWidthPx({ cls: 3, lengthM: 5_000 }, view),
    ];
    // In the whole way the freeway stands well above the highway (2.8) and
    // the arterial (1.6); "Near me" is unchanged.
    expect(widths('whole')).toEqual([5.5, 5.5, 1.2, 2.8, 1.6, 1.2]);
    expect(widths('near')).toEqual([11, 11, 4, 9, 6, 4]);
  });

  it('draws a ramp in near me only: a freeway line under 1 km is left out of the whole way', () => {
    expect(ROADS_RAMP_IN_WHOLE_WAY).toBe(false);
    expect(isRamp({ cls: 0, lengthM: 999 })).toBe(true);
    expect(isRamp({ cls: 0, lengthM: 1_000 })).toBe(false);
    expect(isRamp({ cls: 1, lengthM: 200 })).toBe(false); // only freeways have ramps
    expect(drawnInView({ cls: 0, lengthM: 999 }, 'near')).toBe(true);
    expect(drawnInView({ cls: 0, lengthM: 999 }, 'whole')).toBe(false);
    expect(drawnInView({ cls: 0, lengthM: 1_000 }, 'whole')).toBe(true);
    expect(drawnInView({ cls: 1, lengthM: 200 }, 'whole')).toBe(true);
  });

  it('draws the fill narrower than its casing by an edge each side, never under 0.6 px', () => {
    expect(fillWidthPx(11)).toBeCloseTo(7.7, 9); // edge 15 % of 11 = 1.65
    expect(fillWidthPx(5.5)).toBeCloseTo(3.85, 9);
    expect(fillWidthPx(2.2)).toBeCloseTo(1, 9); // the 0.6 px floor
    expect(fillWidthPx(1)).toBe(0);
  });
});

describe('the classes by view', () => {
  const { mainUpToM, sparseLines } = ROADS_CLASS_LIMITS;

  it('near me draws every class; the whole way never a collector', () => {
    expect([mainUpToM, sparseLines]).toEqual([10_000, 40]);
    expect(highestClassDrawn('near', 1_500, 500)).toBe(3);
    expect(highestClassDrawn('whole', 1_500, 500)).toBe(2);
    expect(highestClassDrawn('whole', 10_000, 500)).toBe(2); // 10 km itself keeps the arterials
    expect(highestClassDrawn('whole', 10_001, 500)).toBe(1);
    expect(highestClassDrawn('whole', 30_000, 500)).toBe(1);
  });

  it('beyond 10 km the whole way brings the arterials back only where fewer than 40 main lines are in view', () => {
    expect(highestClassDrawn('whole', 20_000, 39)).toBe(2);
    expect(highestClassDrawn('whole', 20_000, 40)).toBe(1);
    expect(highestClassDrawn('whole', 20_000, 0)).toBe(2);
  });

  // Lines across the view, each class at its own offset north of the person.
  const across = (count: number, cls: number, north: number) =>
    Array.from({ length: count }, (_, i) =>
      lineAt(`Road ${cls}-${i}`, cls, [[-40_000, north + i * 10], [40_000, north + i * 10]]),
    );
  const classesDrawn = (lines: RoadLine[], view: 'whole' | 'near', radiusM: number) =>
    [...new Set(drawRoads({ lines }, HERE, { view, radiusM, radiusPx: 100 }).roads.map((r) => r.cls))].sort();

  it('drops the classes the view does not draw', () => {
    const lines = [...across(1, 0, 0), ...across(1, 1, 200), ...across(1, 2, 400), ...across(1, 3, 600)];
    expect(classesDrawn(lines, 'near', 1_500)).toEqual([0, 1, 2, 3]);
    expect(classesDrawn(lines, 'whole', 1_500)).toEqual([0, 1, 2]);
    expect(classesDrawn(lines, 'whole', 5_000)).toEqual([0, 1, 2]);
    // Beyond 10 km with only three main lines in view: the arterial stays.
    expect(classesDrawn(lines, 'whole', 20_000)).toEqual([0, 1, 2]);
    // Forty main lines in view: the arterials go, the freeway and highway stay.
    const busy = [...across(1, 0, 0), ...across(1, 1, 200), ...across(38, 2, 400), ...across(5, 3, 1_000)];
    expect(classesDrawn(busy, 'whole', 20_000)).toEqual([0, 1]);
    // Thirty-nine: they come back.
    const quiet = [...across(1, 0, 0), ...across(1, 1, 200), ...across(37, 2, 400)];
    expect(classesDrawn(quiet, 'whole', 20_000)).toEqual([0, 1, 2]);
  });
});

describe('clipping to the ring', () => {
  it('cuts a line across the circle at the edge', () => {
    const [run] = clipToCircle([[-200, 0], [200, 0]], 100);
    expect(run[0][0]).toBeCloseTo(-100, 9);
    expect(run[1][0]).toBeCloseTo(100, 9);
  });

  it('drops a line that misses, and splits one that leaves and comes back', () => {
    expect(clipToCircle([[-200, 150], [200, 150]], 100)).toEqual([]);
    const runs = clipToCircle([[-50, -200], [-50, 200], [50, 200], [50, -200]], 100);
    expect(runs).toHaveLength(2);
  });

  it('keeps a line wholly inside as it is, and skips a repeated point', () => {
    expect(clipToCircle([[0, 0], [0, 0], [10, 10], [20, 0]], 100)).toEqual([[[0, 0], [10, 10], [20, 0]]]);
  });
});

describe('polylines', () => {
  it('cuts a stretch out of a line by distance along it', () => {
    const cut = cutPolyline([[0, 0], [10, 0], [10, 10]], 5, 15);
    expect(cut).toEqual([[5, 0], [10, 0], [10, 5]]);
    expect(polylineLength(cut)).toBe(10);
    expect(pathData([[0, 0], [1.25, 2]])).toBe('M0 0L1.3 2');
    expect(pathData([[0, 0], [1, 1]], [[2, 2], [3, 3]])).toBe('M0 0L1 1M2 2L3 3');
  });
});

describe('the label rule', () => {
  const R = 140;
  const straight = (name: string, y: number, half = 130, cls = 2) => ({
    name,
    cls,
    runs: [[[-half, y], [0, y], [half, y]] as [number, number][]],
  });

  it('names a long straight road inside its straightest stretch, reading left to right', () => {
    const [label] = chooseLabels([straight('Long Road', 60)], R, []);
    expect(label.name).toBe('Long Road');
    expect(label.angleDeg).toBeCloseTo(0, 9);
    expect(label.d.startsWith('M-')).toBe(true);
    // The reversed copy runs the same stretch the other way.
    expect(label.dReversed.startsWith('M-')).toBe(false);
  });

  it('turns a stretch drawn right to left so the name reads left to right', () => {
    const [label] = chooseLabels([{ name: 'Back Road', cls: 2, runs: [[[100, 40], [-100, 40]]] }], R, []);
    expect(label.d.startsWith('M-')).toBe(true);
  });

  it('passes over a line whose visible 90 % is shorter than its name', () => {
    expect(ROADS_LABEL_STRETCH).toBe(0.9);
    const need = estimateTextPx('Short Road') + 8;
    // 90 % of the run is just under what the name needs.
    const half = (need / ROADS_LABEL_STRETCH - 1) / 2;
    expect(chooseLabels([straight('Short Road', 0, half)], R, [])).toEqual([]);
    expect(chooseLabels([straight('Short Road', 0, half + 2)], R, [])).toHaveLength(1);
  });

  it('moves a name along the road off something in its way, and skips it when nowhere is clear', () => {
    // An obstacle over the middle of the road: the name moves along.
    const [moved] = chooseLabels([straight('Main Road', 0)], R, [{ x: 0, y: 0, r: 20 }]);
    expect(moved.name).toBe('Main Road');
    // An obstacle over the whole road: skipped, not squeezed in.
    expect(chooseLabels([straight('Main Road', 0)], R, [{ x: 0, y: 0, r: 150 }])).toEqual([]);
  });

  it('skips a name that would touch one already placed', () => {
    const labels = chooseLabels([straight('First Road', 0), straight('Close Road', 8)], R, []);
    expect(labels.map((l) => l.name)).toEqual(['First Road']);
    const apart = chooseLabels([straight('First Road', 0), straight('Far Road', -60)], R, []);
    expect(apart.map((l) => l.name)).toEqual(['First Road', 'Far Road']);
  });

  it('keeps names inside the ring', () => {
    // A road running just inside the edge has no room for a name inside it.
    expect(chooseLabels([straight('Rim Road', 136, 30)], R, [])).toEqual([]);
  });

  it('longest first, names each road once, never an unnamed one, and at most four', () => {
    expect(ROADS_LABEL_COUNT).toBe(4);
    const lines = [
      straight('Unnamed', -120, 60),
      straight('', -100, 60),
      ...Array.from({ length: 9 }, (_, i) => straight(`Road ${i}`, -80 + i * 20, 40 + i * 5)),
      straight('Road 8', 110, 50),
    ];
    const names = chooseLabels(lines, 500, []).map((l) => l.name);
    expect(names).toEqual(['Road 8', 'Road 7', 'Road 6', 'Road 5']);
  });

  it('names freeways first, then highways, then the rest, longest first within each', () => {
    const lines = [
      straight('Long Arterial', -90, 200, 2),
      straight('Longer Collector', -60, 220, 3),
      straight('Short Freeway', -30, 80, 0),
      straight('Long Freeway', 0, 120, 0),
      straight('Short Highway', 30, 70, 1),
    ];
    const names = chooseLabels(lines, 500, []).map((l) => l.name);
    expect(names).toEqual(['Long Freeway', 'Short Freeway', 'Short Highway', 'Longer Collector']);
  });

  it('prefers the straight stretch of a road with a bend', () => {
    // Straight for 200 px, then a zigzag for 40: the name sits on the straight.
    const run: [number, number][] = [[-120, 0], [80, 0], [90, 10], [100, 0], [110, 10], [120, 0]];
    const [label] = chooseLabels([{ name: 'Bend Road', cls: 2, runs: [run] }], R, []);
    const xs = label.d.slice(1).split('L').map((pair) => Number(pair.split(' ')[0]));
    expect(Math.max(...xs)).toBeLessThanOrEqual(80);
  });

  it('joins the pieces of one road that meet end to end, whichever way each was drawn', () => {
    const a: [number, number][] = [[-100, 0], [-40, 0]];
    const b: [number, number][] = [[40, 0], [-40, 0]]; // drawn the other way
    const c: [number, number][] = [[100, 0], [40, 0]];
    const [chain, ...rest] = chainRuns([b, a, c]);
    expect(rest).toEqual([]);
    expect(polylineLength(chain)).toBe(200);
    // Four ways a run can meet the chain: each end to each end.
    expect(chainRuns([[[0, 0], [10, 0]], [[20, 0], [10, 0]]])).toHaveLength(1);
    expect(chainRuns([[[10, 0], [20, 0]], [[0, 0], [10, 0]]])).toHaveLength(1);
    expect(chainRuns([[[10, 0], [20, 0]], [[10, 0], [0, 0]]])).toHaveLength(1);
  });

  it('never joins two carriageways round the end where they meet', () => {
    // Out along one and back along the other: a hairpin, left as two runs.
    const out: [number, number][] = [[0, 0], [100, 0]];
    const back: [number, number][] = [[100, 0], [0, 4]];
    expect(chainRuns([out, back])).toHaveLength(2);
  });

  it('measures straightness end to end, and names nothing round a hairpin', () => {
    expect(straightness([[0, 0], [10, 0], [20, 0]])).toBe(1);
    expect(straightness([[0, 0], [0, 0]])).toBe(1);
    expect(straightness([[0, 0], [50, 0], [0, 10]])).toBeLessThan(0.2);
    const hairpin = { name: 'Hairpin Road', cls: 2, runs: [[[-120, 0], [120, 0], [-120, 20]] as [number, number][]] };
    // 480 px of road but every stretch long enough for the name doubles back.
    expect(chooseLabels([hairpin], 500, [], () => 400)).toEqual([]);
  });

  it('uses the measure it is given', () => {
    expect(chooseLabels([straight('Any Road', 0, 20)], R, [], () => 10)).toHaveLength(1);
  });
});

describe('drawing one view', () => {
  const map: RoadMap = {
    lines: [
      lineAt('Collector Street', 3, [[-3_000, 400], [3_000, 400]]),
      lineAt('Test Freeway', 0, [[-3_000, -3_000], [3_000, 3_000]], 20_000),
      lineAt('Test Ramp', 0, [[100, 600], [500, 900]], 500),
      lineAt('Arterial Road', 2, [[-600, -3_000], [-600, 3_000]]),
      lineAt('Far Away Road', 1, [[40_000, 0], [41_000, 0]]),
    ],
  };

  it('draws every road as a casing then a fill, class by class, collectors first, freeways last', () => {
    const drawn = drawRoads(map, HERE, { view: 'near', radiusM: 1_500, radiusPx: 150 });
    expect(drawn.metresPerPx).toBe(10);
    // The draw order, stroke by stroke: [class, pass, width].
    expect(drawn.roads.map((r) => `${r.cls} ${r.pass} ${Number(r.widthPx.toFixed(2))}`)).toMatchInlineSnapshot(`
      [
        "3 casing 4",
        "3 fill 2.8",
        "2 casing 6",
        "2 fill 4.2",
        "0 casing 11",
        "0 casing 4",
        "0 fill 7.7",
        "0 fill 2.8",
      ]
    `);
    // Every point drawn is inside the map circle.
    for (const road of drawn.roads) {
      const numbers = road.d.replace(/[ML]/g, ' ').trim().split(/\s+/).map(Number);
      for (let k = 0; k < numbers.length; k += 2) {
        expect(Math.hypot(numbers[k], numbers[k + 1])).toBeLessThanOrEqual(150 + 0.1);
      }
    }
    expect(drawn.labels.length).toBeGreaterThan(0);
    // The points under the names are handed back, for the place names to avoid.
    expect(drawn.labelSamples.length).toBeGreaterThan(0);
  });

  it('draws the whole way at its own widths, without the collector or the ramp', () => {
    const drawn = drawRoads(map, HERE, { view: 'whole', radiusM: 1_500, radiusPx: 150 });
    expect(drawn.view).toBe('whole');
    expect(drawn.roads.filter((r) => r.pass === 'casing').map((r) => [r.cls, r.widthPx])).toEqual([
      [2, 1.6],
      [0, 5.5],
    ]);
  });

  it('keeps names off what it is told to', () => {
    const everywhere = drawRoads(map, HERE, {
      view: 'near',
      radiusM: 1_500,
      radiusPx: 150,
      obstacles: [{ x: 0, y: 0, r: 400 }],
    });
    expect(everywhere.labels).toEqual([]);
    expect(everywhere.labelSamples).toEqual([]);
    expect(everywhere.roads).toHaveLength(8);
  });
});
