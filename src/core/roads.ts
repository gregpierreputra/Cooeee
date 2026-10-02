// Roads inside the dial (BS_Enhancement-AC5): the pure rules. Which lines are
// near, where they fall on the dial, how wide they are drawn, which view the
// dial shows and which few names it carries. No drawing and no I/O here: the
// dial component turns what these return into SVG, and the screen hands in the
// file's bytes.
//
// Everything is worked out NORTH UP, in screen pixels from the dial's centre
// (x east, y down). The dial turns the whole drawing by the heading in the
// stylesheet, the same as the ring, so nothing here depends on the heading and
// nothing is recomputed when the phone turns.
//
// Deliberately absent, as the card requires: any highlighting of one road, any
// line from the person to the place, and any word about which way to travel.

import {
  ROADS_CASING_EDGE,
  ROADS_CLASS_LIMITS,
  ROADS_LABEL_COUNT,
  ROADS_LABEL_GAP_PX,
  ROADS_LABEL_MIN_STRAIGHT,
  ROADS_LABEL_PAD_PX,
  ROADS_LABEL_PX,
  ROADS_LABEL_STRAIGHT_SLACK,
  ROADS_LABEL_STRETCH,
  ROADS_MAX_RADIUS_M,
  ROADS_MIN_RADIUS_M,
  ROADS_NEAR_RADIUS_M,
  ROADS_RAMP_IN_WHOLE_WAY,
  ROADS_RAMP_MAX_M,
  ROADS_REDRAW_M,
  ROADS_REDRAW_SHARE,
  ROADS_WHOLE_WAY_MARGIN,
  ROADS_WIDTH_PX,
} from './constants';
import type { PanOffset } from './pan';
import { decodeRoadFile } from './roads-format';
import type { LatLon } from './types';

/** A road as the dial uses it: the decoded line, plus what the filter and the
 *  width rule need, worked out once when the file is read. */
export type RoadLine = {
  name: string;
  cls: number;
  /** lon, lat pairs. */
  lonLat: Float64Array;
  /** minLon, minLat, maxLon, maxLat. */
  box: [number, number, number, number];
  lengthM: number;
};

export type RoadMap = { lines: RoadLine[] };

/** The two views, one tap apart. */
export type MapView = 'whole' | 'near';

type Point = [number, number];

// The same flat-earth scale as the projection below. A few metres out across a
// 30 km view is far below a pixel.
const EARTH_R = 6_371_008.8;
const M_PER_DEG = (EARTH_R * Math.PI) / 180;

/** The file into lines, each with its bounding box and length. Throws on a file
 *  that is not whole; the screen then draws the plain dial. */
export function decodeRoads(buffer: ArrayBuffer): RoadMap {
  const lines = decodeRoadFile(buffer).lines.map(({ name, cls, lonLat }) => {
    let minLon = Infinity;
    let minLat = Infinity;
    let maxLon = -Infinity;
    let maxLat = -Infinity;
    let lengthM = 0;
    for (let k = 0; k < lonLat.length; k += 2) {
      const lon = lonLat[k];
      const lat = lonLat[k + 1];
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      if (k > 0) {
        const dx = (lon - lonLat[k - 2]) * M_PER_DEG * Math.cos((lat * Math.PI) / 180);
        const dy = (lat - lonLat[k - 1]) * M_PER_DEG;
        lengthM += Math.hypot(dx, dy);
      }
    }
    return { name, cls, lonLat, box: [minLon, minLat, maxLon, maxLat] as RoadLine['box'], lengthM };
  });
  return { lines };
}

/** Lines whose bounding box reaches a circle of `radiusM` round `centre`. A
 *  straight scan: sixteen thousand boxes take well under a millisecond, and an
 *  index would be one more thing to get wrong. A box that touches the circle
 *  exactly counts. The clip below drops whatever of a line is still outside. */
export function linesNear(map: RoadMap, centre: LatLon, radiusM: number): RoadLine[] {
  const mx = M_PER_DEG * Math.cos((centre.lat * Math.PI) / 180);
  const r2 = radiusM * radiusM;
  return map.lines.filter(({ box: [minLon, minLat, maxLon, maxLat] }) => {
    // The point of the box nearest the centre, in metres from it.
    const dx = (Math.max(minLon, Math.min(centre.lon, maxLon)) - centre.lon) * mx;
    const dy = (Math.max(minLat, Math.min(centre.lat, maxLat)) - centre.lat) * M_PER_DEG;
    return dx * dx + dy * dy <= r2;
  });
}

/** Equirectangular round the person: good to well under a pixel across 30 km,
 *  and the same scale east-west and north-south at the centre, so the dial's
 *  shapes are true where the person is. Returns dial pixels, north up. */
export function project(centre: LatLon, metresPerPx: number, lon: number, lat: number): Point {
  const mx = M_PER_DEG * Math.cos((centre.lat * Math.PI) / 180);
  return [((lon - centre.lon) * mx) / metresPerPx, (-(lat - centre.lat) * M_PER_DEG) / metresPerPx];
}

/** The spot `distanceM` from `from` along `bearingDeg`, on the same flat scale
 *  as the projection: where the place is, from its distance and bearing. */
export function offsetLatLon(from: LatLon, distanceM: number, bearingDeg: number): LatLon {
  const rad = (bearingDeg * Math.PI) / 180;
  const lat = from.lat + (distanceM * Math.cos(rad)) / M_PER_DEG;
  const lon = from.lon + (distanceM * Math.sin(rad)) / (M_PER_DEG * Math.cos((from.lat * Math.PI) / 180));
  return { lat, lon };
}

/** The spot `north` and `east` metres from `from`, on the projection's scale. */
export function shiftLatLon(from: LatLon, { north, east }: PanOffset): LatLon {
  return {
    lat: from.lat + north / M_PER_DEG,
    lon: from.lon + east / (M_PER_DEG * Math.cos((from.lat * Math.PI) / 180)),
  };
}

/** The ground the dial shows, as a radius in metres. "Near me" is fixed.
 *  "Whole way" reaches the place and a margin beyond it, within the limits, so
 *  a close place still has road round it and a far one never shrinks every road
 *  to a hair. */
export function viewRadiusM(view: MapView, distanceM: number): number {
  if (view === 'near') return ROADS_NEAR_RADIUS_M;
  const wanted = distanceM * (1 + ROADS_WHOLE_WAY_MARGIN);
  return Math.min(ROADS_MAX_RADIUS_M, Math.max(ROADS_MIN_RADIUS_M, wanted));
}

/** How far the person may move before the map is drawn again: 50 m, or 1 % of
 *  the view's radius when that is more. A fixed distance would redraw the far
 *  view for movements it cannot show; a share alone would redraw the near view
 *  for every wobble of the GPS. Redraw only when the move is MORE than this. */
export const redrawDistanceM = (radiusM: number): number =>
  Math.max(ROADS_REDRAW_M, ROADS_REDRAW_SHARE * radiusM);

/** Where the place's pin sits when the place is inside the view: along its
 *  bearing, at its true distance. The same bearing the arrow uses, so the two
 *  can never disagree. Null when it is outside, and the pin stays on the ring. */
export function placeInView(
  distanceM: number,
  bearingDeg: number,
  radiusM: number,
  radiusPx: number,
): { x: number; y: number; r: number } | null {
  if (distanceM >= radiusM) return null;
  const r = (distanceM / radiusM) * radiusPx;
  const rad = (bearingDeg * Math.PI) / 180;
  return { x: r * Math.sin(rad), y: -r * Math.cos(rad), r };
}

/** A freeway ramp: a class 0 line under ROADS_RAMP_MAX_M. Ramps are freeway
 *  class too, and drawn as freeway they turned every interchange into a knot. */
export const isRamp = (line: Pick<RoadLine, 'cls' | 'lengthM'>): boolean =>
  line.cls === 0 && line.lengthM < ROADS_RAMP_MAX_M;

/** Whether a view draws a line at all, before the class rule: in the whole way
 *  no ramps (ROADS_RAMP_IN_WHOLE_WAY). */
export const drawnInView = (line: Pick<RoadLine, 'cls' | 'lengthM'>, view: MapView): boolean =>
  view === 'near' || ROADS_RAMP_IN_WHOLE_WAY || !isRamp(line);

/** The width a line is drawn at in a view, its casing, in screen pixels. A
 *  freeway is the widest line on the dial; its ramps, drawn near the person
 *  only, take the collector width in the freeway's colours, so the
 *  carriageways read as the freeway. */
export function roadWidthPx(line: Pick<RoadLine, 'cls' | 'lengthM'>, view: MapView): number {
  const widths = ROADS_WIDTH_PX[view];
  if (line.cls === 0) return isRamp(line) ? widths.collector : widths.freeway;
  if (line.cls === 1) return widths.highway;
  if (line.cls === 2) return widths.arterial;
  return widths.collector;
}

/** The fill drawn over a casing of `casingPx`: narrower by the edge each side. */
export function fillWidthPx(casingPx: number): number {
  const edge = Math.max(ROADS_CASING_EDGE.minPx, casingPx * ROADS_CASING_EDGE.share);
  return Math.max(0, casingPx - 2 * edge);
}

/** The highest road class the dial draws (see ROADS_CLASS_LIMITS): every class
 *  near the person; in the whole way no collectors, and in its widest views
 *  only freeways and highways unless main roads are scarce there.
 *  `mainLinesInView` is how many lines of classes 0 to 2 the view holds. */
export function highestClassDrawn(view: MapView, radiusM: number, mainLinesInView: number): number {
  if (view === 'near') return 3;
  if (radiusM <= ROADS_CLASS_LIMITS.mainUpToM) return 2;
  return mainLinesInView < ROADS_CLASS_LIMITS.sparseLines ? 2 : 1;
}

/** A polyline cut to the parts inside the circle of `r` round 0 0: a list of
 *  runs, each entering and leaving at the edge. */
export function clipToCircle(points: Point[], r: number): Point[][] {
  const runs: Point[][] = [];
  let run: Point[] = [];
  const close = () => {
    if (run.length >= 2) runs.push(run);
    run = [];
  };
  for (let k = 1; k < points.length; k++) {
    const [px, py] = points[k - 1];
    const [qx, qy] = points[k];
    const dx = qx - px;
    const dy = qy - py;
    const a = dx * dx + dy * dy;
    if (a === 0) continue;
    const b = 2 * (px * dx + py * dy);
    const disc = b * b - 4 * a * (px * px + py * py - r * r);
    // Where the segment is inside, as a share of it from p: [t0, t1].
    let t0 = 0;
    let t1 = 0;
    if (disc > 0) {
      const s = Math.sqrt(disc);
      t0 = Math.max(0, (-b - s) / (2 * a));
      t1 = Math.min(1, (-b + s) / (2 * a));
    }
    if (t0 >= t1) {
      close();
      continue;
    }
    const enter: Point = [px + t0 * dx, py + t0 * dy];
    if (t0 > 0 || run.length === 0) {
      close();
      run = [enter];
    }
    run.push([px + t1 * dx, py + t1 * dy]);
    if (t1 < 1) close();
  }
  close();
  return runs;
}

// ------------------------------------------------------------- polylines

export const polylineLength = (run: Point[]): number => {
  let total = 0;
  for (let k = 1; k < run.length; k++) total += Math.hypot(run[k][0] - run[k - 1][0], run[k][1] - run[k - 1][1]);
  return total;
};

/** The piece of a polyline between two distances along it. */
export function cutPolyline(run: Point[], from: number, to: number): Point[] {
  const out: Point[] = [];
  let walked = 0;
  for (let k = 1; k < run.length && walked <= to; k++) {
    const [px, py] = run[k - 1];
    const [qx, qy] = run[k];
    const seg = Math.hypot(qx - px, qy - py);
    const lo = Math.max(from, walked);
    const hi = Math.min(to, walked + seg);
    if (seg > 0 && lo <= hi) {
      for (const d of out.length === 0 ? [lo, hi] : [hi]) {
        const t = (d - walked) / seg;
        out.push([px + t * (qx - px), py + t * (qy - py)]);
      }
    }
    walked += seg;
  }
  return out;
}

/** Points about every `step` pixels along a polyline, both ends included. */
function resample(run: Point[], step: number): Point[] {
  const total = polylineLength(run);
  const n = Math.max(1, Math.round(total / step));
  const out: Point[] = [run[0]];
  let k = 1;
  let walked = 0;
  for (let i = 1; i <= n; i++) {
    const target = (total * i) / n;
    while (k < run.length - 1 && walked + Math.hypot(run[k][0] - run[k - 1][0], run[k][1] - run[k - 1][1]) < target) {
      walked += Math.hypot(run[k][0] - run[k - 1][0], run[k][1] - run[k - 1][1]);
      k += 1;
    }
    const [px, py] = run[k - 1];
    const [qx, qy] = run[k];
    const seg = Math.hypot(qx - px, qy - py);
    const t = seg > 0 ? Math.min(1, (target - walked) / seg) : 0;
    out.push([px + t * (qx - px), py + t * (qy - py)]);
  }
  return out;
}

/** How straight a polyline is: the distance between its ends over its length,
 *  1 for a straight line, near 0 for a hairpin. */
export function straightness(run: Point[]): number {
  const length = polylineLength(run);
  if (length === 0) return 1;
  const [ax, ay] = run[0];
  const [bx, by] = run[run.length - 1];
  return Math.hypot(bx - ax, by - ay) / length;
}

/** The straightest stretches of `length` pixels along a run, tried every few
 *  pixels, best first. Stretches within ROADS_LABEL_STRAIGHT_SLACK of the
 *  straightest count as equally straight, and of those the ones nearer the
 *  middle of the run come first: on a straight road every stretch ties, and
 *  the first would sit at the map's edge. */
function straightestStretches(run: Point[], length: number): Point[][] {
  const total = polylineLength(run);
  const tried: { from: number; straight: number }[] = [];
  for (let from = 0; from + length <= total; from += 4) {
    tried.push({ from, straight: straightness(cutPolyline(run, from, from + length)) });
  }
  if (tried.length === 0) return [cutPolyline(run, 0, total)];
  const best = Math.max(...tried.map((t) => t.straight));
  const middle = (total - length) / 2;
  return tried
    .filter((t) => t.straight >= best - ROADS_LABEL_STRAIGHT_SLACK)
    .sort((a, b) => Math.abs(a.from - middle) - Math.abs(b.from - middle))
    .map((t) => cutPolyline(run, t.from, t.from + length));
}

// ----------------------------------------------------------------- labels

/** Something a name must keep clear of, in dial pixels, north up: the pin, the
 *  arrow and the ring's letters. */
export type Obstacle = { x: number; y: number; r: number };

export type RoadLabel = {
  name: string;
  /** The stretch the name is set along, left to right as drawn north up. */
  d: string;
  /** The same stretch the other way, for when the dial has turned the name
   *  upside down: the stylesheet shows whichever reads the right way up. */
  dReversed: string;
  /** The stretch's direction, degrees clockwise from east, north up. */
  angleDeg: number;
};

/** The width of a name at the label size. The screen passes a real measure
 *  from the font; this estimate stands in for the tests. */
export const estimateTextPx = (name: string): number => name.length * ROADS_LABEL_PX * 0.58;

const named = (name: string) => name !== '' && name.toLowerCase() !== 'unnamed';

/** The runs of one road joined where they meet end to end on the dial and
 *  carry on the same way. The file's lines break wherever a divided road splits
 *  into its carriageways, so a freeway in view is many short runs; a name needs
 *  the road, not a piece of it. Two runs that meet but double back (the two
 *  carriageways of one road where they rejoin) are not joined: a name set round
 *  that hairpin would fold on itself. Only for placing names: the roads are
 *  drawn as they are. */
export function chainRuns(runs: Point[][]): Point[][] {
  const direction = (from: Point, to: Point) => Math.atan2(to[1] - from[1], to[0] - from[0]);
  // Leaving `a` by its last step and entering `b` by its first: joined only if
  // the turn between them is under a right angle.
  const carriesOn = (a: Point[], b: Point[]) => {
    const out = direction(a[a.length - 2], a[a.length - 1]);
    const into = direction(b[0], b[1]);
    return Math.cos(into - out) > 0;
  };
  const near = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= 1.5;
  const reversed = (run: Point[]) => [...run].reverse();
  const left = runs.map((run) => [...run]);
  const chains: Point[][] = [];
  while (left.length > 0) {
    let chain = left.shift()!;
    for (let grew = true; grew; ) {
      grew = false;
      for (let i = 0; i < left.length; i++) {
        const run = left[i];
        const head = chain[0];
        const tail = chain[chain.length - 1];
        if (near(tail, run[0]) && carriesOn(chain, run)) chain = chain.concat(run.slice(1));
        else if (near(tail, run[run.length - 1]) && carriesOn(chain, reversed(run)))
          chain = chain.concat(reversed(run).slice(1));
        else if (near(head, run[run.length - 1]) && carriesOn(run, chain)) chain = run.concat(chain.slice(1));
        else if (near(head, run[0]) && carriesOn(reversed(run), chain)) chain = reversed(run).concat(chain.slice(1));
        else continue;
        left.splice(i, 1);
        grew = true;
        break;
      }
    }
    chains.push(chain);
  }
  return chains;
}

/** Freeways first, then highways, then every other class together: the roads
 *  people recognise get named before a longer arterial does. */
const labelRank = (cls: number) => Math.min(cls, 2);

/** THE LABEL RULE. Named roads in view (a road's lines of one name, their runs
 *  chained where they meet), freeways first, then highways, then the rest, and
 *  longest first within each; the name may take up to 90 % of the road's
 *  longest chain, on its straightest stretches, at 14 px, on a stretch at least
 *  90 % straight (no hairpin, no wiggle), or it is passed over. Room means length, and a
 *  spot in such a stretch clear of the map's edge, the pin, the arrow and every
 *  name already placed: each equally straight stretch is tried, nearest the
 *  middle of the road first, and in each the name from the stretch's middle
 *  outwards. A road through the person's own spot would otherwise never be
 *  named, since its middle is under the arrow. Nowhere clear, and the line is
 *  skipped. One name once: the two carriageways of one road are two lines. At
 *  most four. */
export function chooseLabels(
  drawn: { name: string; cls: number; runs: Point[][] }[],
  radiusPx: number,
  obstacles: Obstacle[],
  measure: (name: string) => number = estimateTextPx,
): RoadLabel[] {
  return placeLabels(drawn, radiusPx, obstacles, measure).labels;
}

/** The label rule, and the points sampled along every name it placed, which
 *  the locality names must keep clear of: road names win. */
export function placeLabels(
  drawn: { name: string; cls: number; runs: Point[][] }[],
  radiusPx: number,
  obstacles: Obstacle[],
  measure: (name: string) => number = estimateTextPx,
): { labels: RoadLabel[]; samples: Point[] } {
  const labels: RoadLabel[] = [];
  const taken: Point[] = [];
  const roads = new Map<string, { rank: number; runs: Point[][] }>();
  for (const line of drawn) {
    if (!named(line.name) || line.runs.length === 0) continue;
    const road = roads.get(line.name);
    if (road) {
      road.rank = Math.min(road.rank, labelRank(line.cls));
      road.runs.push(...line.runs);
    } else {
      roads.set(line.name, { rank: labelRank(line.cls), runs: [...line.runs] });
    }
  }
  const ranked = [...roads].map(([name, { rank, runs }]) => {
    const chains = chainRuns(runs).map((run) => ({ run, length: polylineLength(run) }));
    return {
      name,
      rank,
      visible: chains.reduce((sum, c) => sum + c.length, 0),
      longest: chains.reduce((a, b) => (b.length > a.length ? b : a)),
    };
  })
    .sort((a, b) => a.rank - b.rank || b.visible - a.visible);
  const half = ROADS_LABEL_PX / 2;

  for (const { name, longest } of ranked) {
    if (labels.length === ROADS_LABEL_COUNT) break;
    const need = measure(name) + 2 * ROADS_LABEL_PAD_PX;
    const stretchLength = longest.length * ROADS_LABEL_STRETCH;
    if (stretchLength < need) continue; // no room
    const clear = ([x, y]: Point) =>
      Math.hypot(x, y) <= radiusPx - half &&
      obstacles.every((o) => Math.hypot(x - o.x, y - o.y) >= o.r + half) &&
      taken.every(([tx, ty]) => Math.hypot(x - tx, y - ty) >= ROADS_LABEL_PX + ROADS_LABEL_GAP_PX);
    let span: Point[] | null = null;
    let samples: Point[] = [];
    for (const stretch of straightestStretches(longest.run, stretchLength)) {
      const slack = (polylineLength(stretch) - need) / 2;
      for (let shift = 0; shift <= slack && !span; shift += 4) {
        for (const offset of shift === 0 ? [0] : [-shift, shift]) {
          const candidate = cutPolyline(stretch, slack + offset, slack + offset + need);
          const points = resample(candidate, 3);
          if (straightness(candidate) >= ROADS_LABEL_MIN_STRAIGHT && points.every(clear)) {
            span = candidate;
            samples = points;
            break;
          }
        }
      }
      if (span) break;
    }
    if (!span) continue; // skip on collision
    taken.push(...samples);
    if (span[span.length - 1][0] < span[0][0]) span = [...span].reverse();
    const [sx, sy] = span[0];
    const [ex, ey] = span[span.length - 1];
    labels.push({
      name,
      d: pathData(span),
      dReversed: pathData([...span].reverse()),
      angleDeg: (Math.atan2(ey - sy, ex - sx) * 180) / Math.PI,
    });
  }
  return { labels, samples: taken };
}

// ------------------------------------------------------------------ draw

const fmt = (v: number) => (Math.round(v * 10) / 10).toString();

/** SVG path data for one or more runs: one M per run. */
export function pathData(...runs: Point[][]): string {
  return runs.map((run) => 'M' + run.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join('L')).join('');
}

/** One stroke of one road: its casing, or the fill drawn over it. */
export type DialRoad = { d: string; widthPx: number; cls: number; pass: 'casing' | 'fill' };
export type DialMap = {
  /** The view drawn: the stylesheet weighs some roads by it. */
  view: MapView;
  /** Where the person is on the map, in its pixels, north up: the centre, or
   *  away from it when the map has been dragged. */
  personPx: Point;
  /** The drag the map was drawn with (metres north and east of the person). */
  offset: PanOffset;
  roads: DialRoad[];
  labels: RoadLabel[];
  /** Points along every name placed, so nothing else is set on top of one. */
  labelSamples: Point[];
  metresPerPx: number;
};

/** What one view of the map needs besides the roads and where the person is. */
export type DrawOptions = {
  view: MapView;
  radiusM: number;
  /** The map circle's radius in screen pixels. */
  radiusPx: number;
  obstacles?: Obstacle[];
  measure?: (name: string) => number;
  /** How far the map has been dragged from the person: its centre is there.
   *  None, and the person is the centre. */
  offset?: PanOffset;
};

/** Everything the dial draws for one position and one view: every line in view
 *  of the classes the view allows (highestClassDrawn), clipped to the map's
 *  circle (in the whole way, no ramps), and the names. Each road is two
 *  strokes, a casing and a fill, in
 *  this order: collectors, arterials, highways, freeways, and within each class
 *  every casing before any fill, so the fills of one class join up where its
 *  roads meet and a lesser road never cuts across a greater one. */
export function drawRoads(map: RoadMap, person: LatLon, options: DrawOptions): DialMap {
  const { view, radiusM, radiusPx, obstacles = [], measure, offset = { north: 0, east: 0 } } = options;
  const metresPerPx = radiusM / radiusPx;
  const centre = shiftLatLon(person, offset);
  // Collectors are only ever drawn near the person, so in the whole way they
  // are not even projected: in a 30 km view they are most of the lines.
  const mostClasses = highestClassDrawn(view, radiusM, 0);
  let drawn: { line: RoadLine; runs: Point[][] }[] = [];
  for (const line of linesNear(map, centre, radiusM)) {
    if (line.cls > mostClasses || !drawnInView(line, view)) continue;
    const points: Point[] = [];
    for (let k = 0; k < line.lonLat.length; k += 2) {
      points.push(project(centre, metresPerPx, line.lonLat[k], line.lonLat[k + 1]));
    }
    const runs = clipToCircle(points, radiusPx);
    if (runs.length > 0) drawn.push({ line, runs });
  }
  const highest = highestClassDrawn(view, radiusM, drawn.filter(({ line }) => line.cls <= 2).length);
  drawn = drawn.filter(({ line }) => line.cls <= highest);
  const roads: DialRoad[] = [];
  for (let cls = 3; cls >= 0; cls--) {
    const ofClass = drawn.filter(({ line }) => line.cls === cls);
    const strokes = ofClass.map(({ line, runs }) => ({ d: pathData(...runs), widthPx: roadWidthPx(line, view) }));
    for (const { d, widthPx } of strokes) roads.push({ d, widthPx, cls, pass: 'casing' });
    for (const { d, widthPx } of strokes) roads.push({ d, widthPx: fillWidthPx(widthPx), cls, pass: 'fill' });
  }
  const { labels, samples } = placeLabels(
    drawn.map(({ line, runs }) => ({ name: line.name, cls: line.cls, runs })),
    radiusPx,
    obstacles,
    measure,
  );
  const personPx: Point = [-offset.east / metresPerPx, offset.north / metresPerPx];
  return { view, personPx, offset, roads, labels, labelSamples: samples, metresPerPx };
}
