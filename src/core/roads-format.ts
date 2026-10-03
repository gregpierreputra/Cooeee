// The roads file (BS_Enhancement-AC5): its binary format, and the steps that
// make it from the Vicmap Transport road layer. Ported line for line from the
// measurement script that proved the file size (roads.py, run on 21 Sep), so
// that `npm run build:data:roads` writes the same bytes from the same pages.
// That is why some choices below look fussy: the join order, the rounding and
// the name table all copy Python's behaviour exactly.
//
// No imports on purpose: the build script loads this file directly under Node,
// which resolves only explicit-extension specifiers.
//
// THE FORMAT, little-endian:
//   "VRD1"                         4 bytes, the magic
//   grid size in metres            float32 (5)
//   lon0, lat0                     float64 each, the origin of the grid
//   line count                     uint32
//   name table                     varint count, then per name: varint byte
//                                  length and its UTF-8 bytes, sorted
//   per line                       1 byte class code, varint name index,
//                                  varint point count, then the first point
//                                  and every later step as zigzag varints of
//                                  whole grid cells east and north.
// A step is usually a few cells, so most take one or two bytes: that, and one
// line per road instead of one per piece between two junctions, is what makes
// the state's main roads a few hundred kilobytes.

/** A line as the source layer gives it, points as [lon, lat]. */
export type SourceLine = { cls: number; name: string; points: [number, number][] };

/** Where the grid sits: its size and its origin. Stored in the header, so the
 *  reader needs nothing from the writer but the file. */
export type GridFrame = { gridM: number; lon0: number; lat0: number };

/** A decoded line: its class, its name and its points as lon, lat pairs. */
export type DecodedLine = { cls: number; name: string; lonLat: Float64Array };

export const ROADS_MAGIC = 'VRD1';
const HEADER_BYTES = 28;

/** Metres per degree at the grid's origin. A flat projection is plenty for a
 *  5 m grid across one state: this is the scale the steps are counted in, not a
 *  survey. The latitude figure is the one roads.py used. */
export const metresPerDegree = (lat0: number) => ({
  // x * (pi / 180), the way Python's math.radians computes it, so the two
  // scripts agree to the last bit.
  mx: 111320 * Math.cos(lat0 * (Math.PI / 180)),
  my: 110574,
});

// ----------------------------------------------------------------------- join

/** Pieces of the same class and name joined end to end. The source cuts every
 *  road at every junction, so a road is hundreds of short pieces and each would
 *  pay for its own header and start point. Two pieces are joined where they,
 *  and only they, meet end to end; a junction of three stays a break, which is
 *  also where a divided road splits into its two carriageways. */
export function joinByNameAndClass(lines: SourceLine[]): SourceLine[] {
  const groups = new Map<string, number[]>();
  lines.forEach((line, i) => {
    const key = `${line.cls}\u0000${line.name}`;
    const members = groups.get(key);
    if (members) members.push(i);
    else groups.set(key, [i]);
  });
  // Exact coordinates as the key: the layer repeats the shared end point of two
  // pieces to the last digit, and a number prints back to the same string.
  const at = (p: [number, number]) => `${p[0]},${p[1]}`;
  const joined: SourceLine[] = [];
  for (const members of groups.values()) {
    const nodes = new Map<string, number[]>();
    const touch = (p: [number, number], i: number) => {
      const key = at(p);
      const list = nodes.get(key);
      if (list) list.push(i);
      else nodes.set(key, [i]);
    };
    for (const i of members) {
      const points = lines[i].points;
      touch(points[0], i);
      touch(points[points.length - 1], i);
    }
    const used = new Set<number>();
    const grow = (chain: [number, number][]) => {
      for (;;) {
        const end = chain[chain.length - 1];
        const meeting = nodes.get(at(end)) ?? [];
        const free = meeting.filter((j) => !used.has(j));
        if (meeting.length !== 2 || free.length !== 1) return;
        const next = lines[free[0]].points;
        used.add(free[0]);
        const forward = next[0][0] === end[0] && next[0][1] === end[1];
        const ordered = forward ? next : [...next].reverse();
        for (let k = 1; k < ordered.length; k++) chain.push(ordered[k]);
      }
    };
    for (const i of members) {
      if (used.has(i)) continue;
      used.add(i);
      const chain = [...lines[i].points];
      grow(chain);
      chain.reverse();
      grow(chain);
      joined.push({ cls: lines[i].cls, name: lines[i].name, points: chain });
    }
  }
  return joined;
}

// ------------------------------------------------------------------- simplify

/** Douglas-Peucker on points in metres: keep a point only where leaving it out
 *  would move the line by more than `tolM`. The point kept on a tie is the
 *  first of them, as in roads.py. */
export function douglasPeucker(points: [number, number][], tolM: number): [number, number][] {
  if (points.length < 3) return points;
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  const tol2 = tolM * tolM;
  while (stack.length > 0) {
    const [lo, hi] = stack.pop()!;
    const [ax, ay] = points[lo];
    const [bx, by] = points[hi];
    const dx = bx - ax;
    const dy = by - ay;
    const seg2 = dx * dx + dy * dy;
    let worst = -1;
    let worstAt = -1;
    for (let k = lo + 1; k < hi; k++) {
      const px = points[k][0] - ax;
      const py = points[k][1] - ay;
      let d2: number;
      if (seg2 === 0) {
        d2 = px * px + py * py;
      } else {
        const t = Math.max(0, Math.min(1, (px * dx + py * dy) / seg2));
        const ex = px - t * dx;
        const ey = py - t * dy;
        d2 = ex * ex + ey * ey;
      }
      if (d2 > worst) {
        worst = d2;
        worstAt = k;
      }
    }
    if (worst > tol2) {
      keep[worstAt] = true;
      stack.push([lo, worstAt], [worstAt, hi]);
    }
  }
  return points.filter((_, k) => keep[k]);
}

/** Python's round(): halves go to the even neighbour. Math.round sends them up,
 *  which would move a point one cell on an exact half and change the bytes. */
export function roundHalfEven(value: number): number {
  const floor = Math.floor(value);
  const diff = value - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  return floor % 2 === 0 ? floor : floor + 1;
}

/** One line simplified in metres, snapped to the grid, repeats dropped. Null
 *  when fewer than two cells are left: a line shorter than the grid has
 *  nothing to draw. */
export function simplifyToGrid(
  pointsM: [number, number][],
  tolM: number,
  gridM: number,
): [number, number][] | null {
  const cells = douglasPeucker(pointsM, tolM).map(
    ([x, y]) => [roundHalfEven(x / gridM), roundHalfEven(y / gridM)] as [number, number],
  );
  const kept = [cells[0]];
  for (const cell of cells.slice(1)) {
    const last = kept[kept.length - 1];
    if (cell[0] !== last[0] || cell[1] !== last[1]) kept.push(cell);
  }
  return kept.length >= 2 ? kept : null;
}

// ---------------------------------------------------------------------- write

function varint(out: number[], n: number) {
  // Arithmetic, not bit operators: those stop at 32 bits.
  while (n >= 128) {
    out.push((n % 128) + 128);
    n = Math.floor(n / 128);
  }
  out.push(n);
}

const zigzag = (n: number) => (n >= 0 ? 2 * n : -2 * n - 1);

export type EncodeResult = { bytes: Uint8Array; lines: number; dropped: number; points: number };

/** The whole file from joined lines. Every name is in the table, even one whose
 *  only line simplified to nothing, because roads.py built it that way and the
 *  two must write the same bytes. */
export function encodeRoads(lines: SourceLine[], tolM: number, frame: GridFrame): EncodeResult {
  const { mx, my } = metresPerDegree(frame.lat0);
  const names = [...new Set(lines.map((line) => line.name))].sort();
  const nameIndex = new Map(names.map((name, i) => [name, i]));
  const utf8 = new TextEncoder();

  const table: number[] = [];
  varint(table, names.length);
  for (const name of names) {
    const raw = utf8.encode(name);
    varint(table, raw.length);
    for (const byte of raw) table.push(byte);
  }

  const body: number[] = [];
  let kept = 0;
  let dropped = 0;
  let points = 0;
  for (const line of lines) {
    const metres = line.points.map(
      ([lon, lat]) => [(lon - frame.lon0) * mx, (lat - frame.lat0) * my] as [number, number],
    );
    const cells = simplifyToGrid(metres, tolM, frame.gridM);
    if (!cells) {
      dropped += 1;
      continue;
    }
    kept += 1;
    points += cells.length;
    body.push(line.cls);
    varint(body, nameIndex.get(line.name)!);
    varint(body, cells.length);
    varint(body, zigzag(cells[0][0]));
    varint(body, zigzag(cells[0][1]));
    for (let k = 1; k < cells.length; k++) {
      varint(body, zigzag(cells[k][0] - cells[k - 1][0]));
      varint(body, zigzag(cells[k][1] - cells[k - 1][1]));
    }
  }

  const bytes = new Uint8Array(HEADER_BYTES + table.length + body.length);
  const view = new DataView(bytes.buffer);
  for (let k = 0; k < 4; k++) bytes[k] = ROADS_MAGIC.charCodeAt(k);
  view.setFloat32(4, frame.gridM, true);
  view.setFloat64(8, frame.lon0, true);
  view.setFloat64(16, frame.lat0, true);
  view.setUint32(24, kept, true);
  bytes.set(table, HEADER_BYTES);
  bytes.set(body, HEADER_BYTES + table.length);
  return { bytes, lines: kept, dropped, points };
}

// ----------------------------------------------------------------------- read

/** The file back into lines. Throws on anything that is not a whole roads
 *  file: a wrong magic, a count past the end, a name index out of range. The
 *  screen treats a throw as no road data and draws the plain dial. */
export function decodeRoadFile(buffer: ArrayBuffer): { frame: GridFrame; lines: DecodedLine[] } {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < HEADER_BYTES) throw new RangeError('roads file: shorter than its header');
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (magic !== ROADS_MAGIC) throw new TypeError('roads file: not a roads file');
  const view = new DataView(buffer);
  const frame = {
    gridM: view.getFloat32(4, true),
    lon0: view.getFloat64(8, true),
    lat0: view.getFloat64(16, true),
  };
  const count = view.getUint32(24, true);

  let at = HEADER_BYTES;
  const readVarint = () => {
    let n = 0;
    let scale = 1;
    for (;;) {
      if (at >= bytes.length) throw new RangeError('roads file: ends inside a number');
      const byte = bytes[at++];
      n += (byte % 128) * scale;
      if (byte < 128) return n;
      scale *= 128;
    }
  };
  const unzigzag = (n: number) => (n % 2 === 0 ? n / 2 : -(n + 1) / 2);

  const utf8 = new TextDecoder();
  const names: string[] = [];
  const nameCount = readVarint();
  for (let i = 0; i < nameCount; i++) {
    const length = readVarint();
    if (at + length > bytes.length) throw new RangeError('roads file: ends inside a name');
    names.push(utf8.decode(bytes.subarray(at, at + length)));
    at += length;
  }

  const { mx, my } = metresPerDegree(frame.lat0);
  const lonPerCell = frame.gridM / mx;
  const latPerCell = frame.gridM / my;
  const lines: DecodedLine[] = [];
  for (let i = 0; i < count; i++) {
    if (at >= bytes.length) throw new RangeError('roads file: fewer lines than its header says');
    const cls = bytes[at++];
    const name = names[readVarint()];
    if (name === undefined) throw new RangeError('roads file: a name index past the table');
    const n = readVarint();
    const lonLat = new Float64Array(n * 2);
    let x = 0;
    let y = 0;
    for (let k = 0; k < n; k++) {
      x += unzigzag(readVarint());
      y += unzigzag(readVarint());
      lonLat[2 * k] = frame.lon0 + x * lonPerCell;
      lonLat[2 * k + 1] = frame.lat0 + y * latPerCell;
    }
    lines.push({ cls, name, lonLat });
  }
  return { frame, lines };
}
