import { memo, useId, type CSSProperties } from 'react';
import type { DialCentre } from '../../core/blacksky-dial';
import {
  DIAL_ARROW_SCALE,
  DIAL_LETTER_PX,
  DIAL_PHONE_PX,
  DIAL_RING_PIN_PX,
  ROADS_LABEL_PX,
  ROADS_LOCALITY_LETTER_SPACING_PX,
  ROADS_LOCALITY_PX,
  ROADS_SCALE_BAR_M,
  ROADS_SCALE_LABEL_PX,
} from '../../core/constants';
import { distanceLabel } from '../../core/copy';
import type { PlaceName } from '../../core/localities';
import type { DialMap } from '../../core/roads';

// The compass points on the ring: a letter and where it sits, in degrees. Drawn
// letters, not words to read, so they are not in core/copy.ts; the dial's words
// for a screen reader come in through `description`.
const POINTS = [
  { letter: 'N', deg: 0 },
  { letter: 'E', deg: 90 },
  { letter: 'S', deg: 180 },
  { letter: 'W', deg: 270 },
] as const;
const TICKS = [45, 135, 225, 315];

/** The drawing's width in its own units: the viewBox below, square, centred
 *  on 0 0. Every circle of the dial is a share of it, so it is the one number
 *  the geometry comes from. */
export const DIAL_UNITS = 212;
const HALF = DIAL_UNITS / 2;
/** The ring's line, in the drawing's units; its outer edge is RING_R + half. */
const RING_LINE = 2;
/** The ring fills the dial's box: its outer edge at 97 % of the box's width
 *  (the phone test found the old dial left a wide black margin). */
export const RING_R = HALF * 0.97 - RING_LINE / 2;
/** The map disc, 88 % of the box: as much map as the band for the letters
 *  leaves. The map is cut to MAP_R and its view's radius is drawn at MAP_R. */
export const MAP_R = HALF * 0.88;
/** The compass letters, in the band between the disc and the ring. At
 *  DIAL_LETTER_PX on the phone's dial the band (7.5 units) holds an N or an S
 *  (capitals 6.1 units high) but not an E or a W, which lie across it and are
 *  7.7 units wide. So the letters sit across the disc's edge, a little over
 *  the map and clear of the ring, and on the map they take the arrow's dark
 *  fill and amber edge, so they keep their contrast on the disc and on the
 *  black. */
export const LETTER_R = MAP_R + 2.5;
const LETTER_SIZE = (DIAL_LETTER_PX * DIAL_UNITS) / DIAL_PHONE_PX;
/** The ticks, in the same band, reaching in from the ring. */
const TICK_R = [MAP_R + (RING_R - MAP_R) / 3, RING_R] as const;
/** The pin on the ring, when the place is outside the view: the same drop as
 *  the one inside the disc, DIAL_RING_PIN_PX tall on the phone's dial, its tip
 *  on the ring's line and its body pointing in over the band and the disc's
 *  edge (there is no room outside). Its height in the drawing's units, so it
 *  scales with the dial. */
export const RING_DROP_UNITS = (DIAL_RING_PIN_PX * DIAL_UNITS) / DIAL_PHONE_PX;
/** The drop's path is drawn 22 units tall (see DROP); this scales it to the
 *  ring pin's height. */
const RING_DROP_SCALE = RING_DROP_UNITS / 22;
/** The pin drawn at the place's own spot when it is inside the view: a drop
 *  with a hole, its tip on the spot. Drawn in screen pixels, 22 px tall and
 *  16 wide at any dial size. */
const DROP =
  'M0 0C-3 -5 -8 -8.6 -8 -14A8 8 0 1 1 8 -14C8 -8.6 3 -5 0 0Z' +
  'M3.4 -14A3.4 3.4 0 1 0 -3.4 -14A3.4 3.4 0 1 0 3.4 -14Z';

/** The centre arrow, at DIAL_ARROW_SCALE of the arrow first drawn (tip 46 from
 *  the centre, head 32 wide at 14, shaft 12 wide back to 18 behind). */
const a = (n: number) => Math.round(n * DIAL_ARROW_SCALE * 100) / 100;
const ARROW = `M0 ${a(-46)} ${a(16)} ${a(-14)}H${a(6)}V${a(18)}H${a(-6)}V${a(-14)}H${a(-16)}Z`;

/** The map inside the ring: roads and names in screen pixels, north up, and
 *  how many screen pixels one unit of the drawing is, so they can be set at
 *  their true pixel sizes whatever size the dial is drawn at. */
export type DialMapLayer = { map: DialMap; places?: PlaceName[]; pxPerUnit: number };

/** The dial: a ring that turns with the phone, the place as a pin on the ring,
 *  an arrow at the centre pointing at that pin, and a notch marking the top of
 *  the phone. Turn until the arrow stands straight up and the pin is under the
 *  notch, and the place lies dead ahead.
 *
 *  It is drawn once. Nothing here reads the heading: the ring, the pin and the
 *  arrow turn in the stylesheet from `--heading`, which the compass hook writes
 *  onto the document root once per display frame, so the phone can turn sixty
 *  times a second without one React render. The only thing React changes is
 *  `--bearing` when the position moves, and the arrow's fill when trust in the
 *  position changes. With no `--heading` the stylesheet falls back to 0, which
 *  is north up.
 *
 *  Deliberately absent: a line joining the centre to the pin, and any road
 *  picked out from the others. The arrow stops well short of the ring. The dial
 *  says which way the place lies, never which way to travel. BS_Enhancement-AC5
 *  adds the roads round the person, all drawn alike, when the phone holds them. */
export default function BlackSkyDial({
  bearingDeg,
  centre,
  description,
  map,
  placeAt,
}: {
  bearingDeg: number;
  centre: DialCentre;
  description: string;
  /** BS_Enhancement-AC5: the roads, when the phone holds them. Absent, the
   *  dial is exactly as it was: this card adds, it never takes away. */
  map?: DialMapLayer;
  /** Where the place is on the map, in its pixels, north up, when it is inside
   *  the map's circle. Absent, the pin sits on the ring. */
  placeAt?: [number, number];
}) {
  const id = useId();
  const inside = placeAt !== undefined && map !== undefined;
  // The person and the place on the map, in the drawing's units. The person is
  // the centre unless the map has been dragged.
  const toUnits = ([x, y]: [number, number]) => (map ? [x / map.pxPerUnit, y / map.pxPerUnit] : [0, 0]);
  const [personX, personY] = map ? toUnits(map.map.personPx) : [0, 0];
  const [placeX, placeY] = inside ? toUnits(placeAt) : [0, 0];
  return (
    <svg
      className="blacksky-dial"
      viewBox={`${-HALF} ${-HALF} ${DIAL_UNITS} ${DIAL_UNITS}`}
      role="img"
      aria-label={description}
      data-centre={centre}
    >
      {/* A square drawing, the ring near its edge, so the dial fills the width
          it is given; its centre, 0 0, is where everything turns. The top of
          the phone: fixed, a notch from the box's edge into the ring. */}
      <path className="blacksky-dial-notch" d={`M-8 ${-HALF}H8L0 ${-RING_R}Z`} />
      <g className={map ? 'blacksky-dial-ring on-map' : 'blacksky-dial-ring'}>
        {/* BS_Enhancement-AC5: the map is the first thing inside the ring's
            group, so it turns with the ring by the same --heading, under the
            ring, the letters, the arrow and the pin, and is never redrawn per
            sensor reading. Cut to its own circle, inside the ring. */}
        {map ? <MapLayer layer={map} clipId={`${id}-clip`} idPrefix={id} /> : null}
        <circle r={RING_R} />
        {TICKS.map((deg) => (
          <line key={deg} y1={-TICK_R[0]} y2={-TICK_R[1]} transform={`rotate(${deg})`} />
        ))}
        {POINTS.map(({ letter, deg }) => (
          // Two turns: the outer one carries the letter round the ring, the
          // inner one (in the stylesheet) keeps it upright as the ring turns.
          <g key={letter} transform={`rotate(${deg}) translate(0 ${-LETTER_R})`}>
            <g transform={`rotate(${-deg})`}>
              <text
                className="blacksky-dial-letter"
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={LETTER_SIZE}
                // On the map, the amber edge is 2.5 screen pixels at any size.
                strokeWidth={map ? 2.5 / map.pxPerUnit : undefined}
              >
                {letter}
              </text>
            </g>
          </g>
        ))}
      </g>
      {/* The scale bar: fixed to the dial's frame, outside the turning group,
          so it never turns; in the disc's lower left, where the ring leaves
          the most map free of the arrow and the pin. */}
      {map ? <ScaleBar metresPerPx={map.map.metresPerPx} pxPerUnit={map.pxPerUnit} /> : null}
      {/* The arrow: from the centre toward the pin, long enough to be read at a
          glance, its tip well short of the ring so it never touches the pin
          there. Always an outline, so the map under it shows through: an amber
          line over a dark one a pixel wider each side, which keeps it 3 to 1
          or better on the light disc and on the black alike. Dashed when the
          position is old or marked (dialCentre 'outline'). */}
      {/* It stands where the person is on the map: the centre, or carried off
          with the map when it has been dragged, cut off at the disc's edge.
          Placed like the map (turned by the heading), then pointed at the
          place by the bearing like the pin. */}
      <g clipPath={map ? `url(#${id}-disc)` : undefined}>
        {map ? (
          <defs>
            <clipPath id={`${id}-disc`}>
              <circle r={MAP_R} />
            </clipPath>
          </defs>
        ) : null}
        <g className="blacksky-dial-at" style={{ '--at-x': personX, '--at-y': personY } as CSSProperties}>
          <g
            className="blacksky-dial-arrow"
            data-stale={centre === 'outline' ? 'true' : 'false'}
            style={{ '--bearing': bearingDeg } as CSSProperties}
          >
            <path className="blacksky-arrow-edge" d={ARROW} />
            <path className="blacksky-arrow-line" d={ARROW} />
          </g>
        </g>
      </g>
      {/* One bearing, set once on the two things that point at the place, so the
          arrow and the pin can never disagree. Drawn after the arrow: with roads,
          a close place brings the pin in off the ring to its true spot, and
          there it must not hide under the arrow. */}
      <g
        className="blacksky-dial-pin"
        style={{ '--bearing': bearingDeg } as CSSProperties}
        data-at={inside ? 'inside' : 'ring'}
        data-r={inside ? Math.hypot(placeX, placeY) : RING_R}
      >
        {inside ? (
          // Inside the view: a drop whose tip is the place's true spot on the
          // map, carried with the map as it turns and as it is dragged, and
          // standing upright on the screen.
          <g className="blacksky-dial-at" style={{ '--at-x': placeX, '--at-y': placeY } as CSSProperties}>
            <g transform={`scale(${1 / map.pxPerUnit})`}>
              <path className="blacksky-dial-drop" d={DROP} fillRule="evenodd" />
            </g>
          </g>
        ) : (
          // On the ring: the drop at DIAL_RING_PIN_PX on the phone's dial,
          // turned tip out, so its point touches the ring at the bearing and
          // its body lies over the band. It turns with the bearing, like the
          // marker it replaced.
          <g transform={`translate(0 ${-RING_R}) scale(${RING_DROP_SCALE} ${-RING_DROP_SCALE})`}>
            <path className="blacksky-dial-drop on-ring" d={DROP} fillRule="evenodd" />
          </g>
        )}
      </g>
    </svg>
  );
}

/** A bar ROADS_SCALE_BAR_M long at the map's scale, with its length above it,
 *  in the map's label colours. Drawn in screen pixels, like the roads. */
function ScaleBar({ metresPerPx, pxPerUnit }: { metresPerPx: number; pxPerUnit: number }) {
  const length = ROADS_SCALE_BAR_M / metresPerPx;
  // The bar's left end, in the drawing's units: down and left of the centre,
  // well inside the disc (0.83 of its radius).
  const x = -MAP_R * 0.55;
  const y = MAP_R * 0.62;
  // End ticks set a pixel in, so the bar's box is exactly its length.
  const bar = `M0 0H${length}M1 -5V0M${length - 1} -5V0`;
  return (
    <g className="blacksky-scale" transform={`translate(${x} ${y}) scale(${1 / pxPerUnit})`}>
      <path className="blacksky-scale-halo" d={bar} />
      <path className="blacksky-scale-bar" d={bar} data-metres={ROADS_SCALE_BAR_M} />
      <text className="blacksky-scale-label" x="0" y="-8" fontSize={ROADS_SCALE_LABEL_PX}>
        {distanceLabel(ROADS_SCALE_BAR_M)}
      </text>
    </g>
  );
}

/** The class names the stylesheet weighs each road by. */
const ROAD_KIND: Record<number, string> = { 0: 'freeway', 1: 'highway', 2: 'arterial', 3: 'collector' };

/** The roads and their names. Worked out in screen pixels, so a line of 2 px
 *  is 2 px however large the dial is; the inner group scales them back into
 *  the drawing's units. One path per road. Memoised: the layer only changes on
 *  a redraw, so the screen's one second tick never walks every road again. */
const MapLayer = memo(function MapLayer({
  layer,
  clipId,
  idPrefix,
}: {
  layer: DialMapLayer;
  clipId: string;
  idPrefix: string;
}) {
  const { map, places = [], pxPerUnit } = layer;
  return (
    <g
      className="blacksky-dial-map"
      clipPath={`url(#${clipId})`}
      data-view={map.view}
      data-metres-per-px={map.metresPerPx}
      data-pan={`${Math.round(map.offset.north)} ${Math.round(map.offset.east)}`}
    >
      <defs>
        <clipPath id={clipId}>
          <circle r={MAP_R} />
        </clipPath>
      </defs>
      {/* A light map on the black screen: the disc, then every road as its
          casing and its fill, in the order the rule gives. */}
      <circle className="blacksky-map-disc" r={MAP_R} />
      <g transform={`scale(${1 / pxPerUnit})`}>
        {map.roads.map((road, i) => (
          <path
            key={i}
            className={`blacksky-road ${ROAD_KIND[road.cls] ?? 'collector'} ${road.pass}`}
            d={road.d}
            strokeWidth={road.widthPx}
          />
        ))}
        {map.labels.map((label, i) => (
          // Each name is set twice, along its stretch both ways; the stylesheet
          // shows the one that reads the right way up at the dial's current
          // turn, so a name never stands on its head and nothing re-renders.
          <g
            key={label.name}
            className="blacksky-road-label"
            // The size comes from the same constant the label rule fits names
            // at, so what is drawn is what was measured.
            fontSize={ROADS_LABEL_PX}
            style={{ '--label-deg': label.angleDeg } as CSSProperties}
          >
            <defs>
              <path id={`${idPrefix}-l${i}`} d={label.d} />
              <path id={`${idPrefix}-r${i}`} d={label.dReversed} />
            </defs>
            <text className="upright" dy="0.35em">
              <textPath href={`#${idPrefix}-l${i}`} startOffset="50%" textAnchor="middle">
                {label.name}
              </textPath>
            </text>
            <text className="turned" dy="0.35em" aria-hidden="true">
              <textPath href={`#${idPrefix}-r${i}`} startOffset="50%" textAnchor="middle">
                {label.name}
              </textPath>
            </text>
          </g>
        ))}
        {places.map((place) => (
          // A locality name: carried round with the map to its point, and
          // turned back by the stylesheet about its own centre, so it always
          // reads upright, like the ring's letters.
          <g key={place.name} transform={`translate(${place.x} ${place.y})`}>
            <text
              className="blacksky-locality"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={ROADS_LOCALITY_PX}
              letterSpacing={ROADS_LOCALITY_LETTER_SPACING_PX}
            >
              {place.name}
            </text>
          </g>
        ))}
      </g>
    </g>
  );
});
