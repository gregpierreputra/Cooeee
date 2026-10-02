import { describe, expect, it } from 'vitest';
import {
  decodeRoadFile,
  douglasPeucker,
  encodeRoads,
  joinByNameAndClass,
  metresPerDegree,
  roundHalfEven,
  simplifyToGrid,
  type SourceLine,
} from '../../src/core/roads-format';

// BS_Enhancement-AC5: the roads file. The writer is the build script's; the
// reader is the app's. Both are tested here on a small fixture, and the writer
// against bytes the measurement script roads.py wrote for the same fixture with
// its own code, so the port cannot drift from what proved the file size.

const FRAME = { gridM: 5, lon0: 145, lat0: -37 };

// Eight pieces, as the layer cuts them: a road in two pieces meeting end to end
// (the second drawn the other way), three pieces of one road meeting at one
// point, a freeway, a name with letters outside ASCII, and a line shorter than
// the grid.
const FIXTURE: SourceLine[] = [
  { cls: 1, name: 'Burwood Highway', points: [[145.3, -37.88], [145.31, -37.8801], [145.32, -37.8799]] },
  { cls: 1, name: 'Burwood Highway', points: [[145.33, -37.88], [145.325, -37.8802], [145.32, -37.8799]] },
  { cls: 2, name: 'Old Coach Road', points: [[145.34, -37.87], [145.3401, -37.875], [145.34, -37.88]] },
  { cls: 2, name: 'Old Coach Road', points: [[145.34, -37.88], [145.3402, -37.885]] },
  { cls: 2, name: 'Old Coach Road', points: [[145.34, -37.88], [145.345, -37.8801]] },
  { cls: 0, name: 'Monash Freeway', points: [[145.2, -37.9], [145.21, -37.905], [145.2201, -37.9101], [145.23, -37.915]] },
  { cls: 3, name: "Rue d'Été", points: [[145.1, -37.8], [145.1002, -37.8003]] },
  { cls: 3, name: '', points: [[145.0, -37.0], [145.00001, -37.00001]] },
];

// Written by roads.py's own join, simplify and encode (map-size-test, 21 Sep)
// for exactly this fixture.
const ROADS_PY_BYTES =
  '565244310000a040000000000020624000000000008042c00600000005000f427572776f6f6420486967687761790e4d6f6e61736820467265657761790e4f6c6420436f61636820526f61640b527565206427c38974c3a9010102d85b89b002ab0800020302ba5e89b00200ba03020302c25ee7b10207de01020302ec5f8db002b10104000202f43f95bc02ab089805030402ec1bc39402070c';

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

describe('the writer', () => {
  it('writes the same bytes as roads.py for the same pieces', () => {
    const { bytes, lines, dropped } = encodeRoads(joinByNameAndClass(FIXTURE), 25, FRAME);
    expect(hex(bytes)).toBe(ROADS_PY_BYTES);
    expect(lines).toBe(6);
    expect(dropped).toBe(1);
  });

  it('joins two pieces that meet end to end, whichever way the second runs', () => {
    const joined = joinByNameAndClass(FIXTURE.slice(0, 2));
    expect(joined).toHaveLength(1);
    // Grown forward, turned round, then grown from the other end, as roads.py
    // does, so the road comes out starting from the second piece's far end.
    expect(joined[0].points).toEqual([
      [145.33, -37.88],
      [145.325, -37.8802],
      [145.32, -37.8799],
      [145.31, -37.8801],
      [145.3, -37.88],
    ]);
  });

  it('leaves a junction of three as a break', () => {
    expect(joinByNameAndClass(FIXTURE.slice(2, 5))).toHaveLength(3);
  });

  it('never joins across a name or a class', () => {
    const a: SourceLine = { cls: 2, name: 'A Road', points: [[145, -37], [145.01, -37]] };
    const b: SourceLine = { cls: 2, name: 'B Road', points: [[145.01, -37], [145.02, -37]] };
    const c: SourceLine = { cls: 3, name: 'A Road', points: [[145.01, -37], [145.02, -37]] };
    expect(joinByNameAndClass([a, b])).toHaveLength(2);
    expect(joinByNameAndClass([a, c])).toHaveLength(2);
  });

  it('does not join a loop to itself', () => {
    const loop: SourceLine = { cls: 2, name: 'Ring Road', points: [[145, -37], [145.01, -37], [145, -37.01], [145, -37]] };
    expect(joinByNameAndClass([loop])[0].points).toHaveLength(4);
  });
});

describe('the simplification', () => {
  it('keeps a bend that leaves the line by more than the tolerance and drops one that does not', () => {
    expect(douglasPeucker([[0, 0], [50, 30], [100, 0]], 25)).toEqual([[0, 0], [50, 30], [100, 0]]);
    expect(douglasPeucker([[0, 0], [50, 20], [100, 0]], 25)).toEqual([[0, 0], [100, 0]]);
  });

  it('leaves a line of two points, and a line that doubles back to its start, as they are', () => {
    expect(douglasPeucker([[0, 0], [10, 0]], 25)).toEqual([[0, 0], [10, 0]]);
    expect(douglasPeucker([[0, 0], [100, 0], [0, 0]], 25)).toEqual([[0, 0], [100, 0], [0, 0]]);
  });

  it('rounds a half to the even cell, as Python does', () => {
    expect([0.5, 1.5, 2.5, -0.5, -1.5, 2.4, 2.6].map(roundHalfEven)).toEqual([0, 2, 2, 0, -2, 2, 3]);
  });

  it('snaps to the grid, drops repeats, and leaves nothing of a line shorter than a cell', () => {
    expect(simplifyToGrid([[0, 0], [1, 1], [12, 0]], 25, 5)).toEqual([[0, 0], [2, 0]]);
    expect(simplifyToGrid([[0, 0], [1, 1]], 25, 5)).toBeNull();
  });
});

describe('the reader', () => {
  it('reads back what was written: classes, names, and every point within half a cell', () => {
    const joined = joinByNameAndClass(FIXTURE);
    const { bytes } = encodeRoads(joined, 25, FRAME);
    const { frame, lines } = decodeRoadFile(bytes.buffer as ArrayBuffer);
    expect(frame).toEqual(FRAME);
    expect(lines.map((l) => [l.cls, l.name])).toEqual([
      [1, 'Burwood Highway'],
      [2, 'Old Coach Road'],
      [2, 'Old Coach Road'],
      [2, 'Old Coach Road'],
      [0, 'Monash Freeway'],
      [3, "Rue d'Été"],
    ]);
    const { mx, my } = metresPerDegree(FRAME.lat0);
    // Each decoded end point sits on the grid within half a cell of the source.
    joined.slice(0, 6).forEach((source, i) => {
      const got = lines[i].lonLat;
      for (const [k, [lon, lat]] of [[0, source.points[0]], [got.length / 2 - 1, source.points.at(-1)!]] as const) {
        expect(Math.abs(got[2 * k] - lon) * mx).toBeLessThanOrEqual(2.5 + 1e-6);
        expect(Math.abs(got[2 * k + 1] - lat) * my).toBeLessThanOrEqual(2.5 + 1e-6);
      }
    });
  });

  it('refuses a file that is not a whole roads file', () => {
    const { bytes } = encodeRoads(joinByNameAndClass(FIXTURE), 25, FRAME);
    expect(() => decodeRoadFile(new ArrayBuffer(10))).toThrow(RangeError);
    const wrongMagic = bytes.slice();
    wrongMagic[0] = 0x58;
    expect(() => decodeRoadFile(wrongMagic.buffer as ArrayBuffer)).toThrow(TypeError);
    expect(() => decodeRoadFile(bytes.slice(0, 40).buffer as ArrayBuffer)).toThrow(RangeError);
    expect(() => decodeRoadFile(bytes.slice(0, bytes.length - 3).buffer as ArrayBuffer)).toThrow(RangeError);
    // One more line promised than the body holds.
    const moreLines = bytes.slice();
    new DataView(moreLines.buffer).setUint32(24, 7, true);
    expect(() => decodeRoadFile(moreLines.buffer as ArrayBuffer)).toThrow(RangeError);
  });

  it('refuses a line whose name is not in the table', () => {
    const line: SourceLine = { cls: 2, name: 'A Road', points: [[145, -37], [145.01, -37]] };
    const { bytes } = encodeRoads([line], 25, FRAME);
    // Header 28, then the table: count 1, length 6, "A Road"; the line's class
    // byte, then its name index, set here past the one name there is.
    const bad = bytes.slice();
    bad[28 + 1 + 1 + 6 + 1] = 5;
    expect(() => decodeRoadFile(bad.buffer as ArrayBuffer)).toThrow(RangeError);
  });

  it('writes and reads a number of more than one byte', () => {
    // A point 100 km east of the origin: its first cell is 20,000, three bytes.
    const far: SourceLine = { cls: 1, name: 'Far Road', points: [[146.13, -37], [146.14, -37]] };
    const { bytes } = encodeRoads([far], 25, FRAME);
    const [line] = decodeRoadFile(bytes.buffer as ArrayBuffer).lines;
    expect(line.lonLat[0]).toBeCloseTo(146.13, 4);
  });
});
