import { useId, type CSSProperties } from 'react';
import type { DialCentre } from '../../core/blacksky-dial';
import {
  DIAL_ARROW_SCALE,
  ROADS_LABEL_PX,
  ROADS_LOCALITY_LETTER_SPACING_PX,
  ROADS_LOCALITY_PX,
} from '../../core/constants';
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

/** The dial's circles, in the drawing's own units. The map is cut to MAP_R and
 *  its view's radius is drawn at MAP_R; the ring stands outside it at RING_R,
 *  with the ticks and the compass letters beyond it, so a road or a name never
 *  runs under a letter (the phone test found the letters inside the map were
 *  lost in it). The pin sits on the ring when the place is outside the view. */
export const MAP_R = 70;
export const RING_R = 78;
const TICK_R = [78, 84] as const;
const LETTER_R = 86;
/** The drawing's width in its own units: the viewBox below, square, cut close
 *  to the letters, the pin on the ring and the notch above the N. */
export const DIAL_UNITS = 212;
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
  pinAtR,
}: {
  bearingDeg: number;
  centre: DialCentre;
  description: string;
  /** BS_Enhancement-AC5: the roads, when the phone holds them. Absent, the
   *  dial is exactly as it was: this card adds, it never takes away. */
  map?: DialMapLayer;
  /** How far from the centre the pin sits, in drawing units, when the place is
   *  inside the map's view. Absent, it sits on the ring. */
  pinAtR?: number;
}) {
  const id = useId();
  const inside = pinAtR !== undefined && map !== undefined;
  return (
    <svg
      className="blacksky-dial"
      viewBox={`-106 -107 ${DIAL_UNITS} ${DIAL_UNITS}`}
      role="img"
      aria-label={description}
      data-centre={centre}
    >
      {/* A square drawing, cut close to the letters (radius 86 and their own
          height), the pin on the ring and the notch above the N, so the dial
          fills the width it is given; its centre, 0 0, is where everything
          turns. The top of the phone: fixed, above the letters. */}
      <path className="blacksky-dial-notch" d="M-8 -106H8L0 -95Z" />
      <g className="blacksky-dial-ring">
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
              <text className="blacksky-dial-letter" textAnchor="middle" dominantBaseline="central">
                {letter}
              </text>
            </g>
          </g>
        ))}
      </g>
      {/* The arrow: from the centre toward the pin, long enough to be read at a
          glance, its tip well short of the ring so it never touches the pin
          there. Hollow when the position is old or marked. */}
      {/* On the light map disc the arrow is dark with an amber edge, so it
          keeps its contrast against the disc and against the roads. */}
      <g
        className={map ? 'blacksky-dial-arrow on-map' : 'blacksky-dial-arrow'}
        style={{ '--bearing': bearingDeg } as CSSProperties}
      >
        <path className={centre === 'outline' ? 'hollow' : undefined} d={ARROW} />
      </g>
      {/* One bearing, set once on the two things that point at the place, so the
          arrow and the pin can never disagree. Drawn after the arrow: with roads,
          a close place brings the pin in off the ring to its true spot, and
          there it must not hide under the arrow. */}
      <g
        className="blacksky-dial-pin"
        style={{ '--bearing': bearingDeg } as CSSProperties}
        data-at={inside ? 'inside' : 'ring'}
        data-r={inside ? pinAtR : RING_R}
      >
        {inside ? (
          // Inside the view: a drop whose tip is the place's true spot. It is
          // carried out along the bearing like the ring marker, then turned
          // back by the stylesheet so it always stands upright on the screen.
          <g transform={`translate(0 ${-pinAtR}) scale(${1 / map.pxPerUnit})`}>
            <path className="blacksky-dial-drop" d={DROP} fillRule="evenodd" />
          </g>
        ) : (
          <>
            <circle cy={-RING_R} r="11" />
            <circle className="blacksky-dial-pin-eye" cy={-RING_R} r="4" />
          </>
        )}
      </g>
    </svg>
  );
}

/** The class names the stylesheet weighs each road by. */
const ROAD_KIND: Record<number, string> = { 0: 'freeway', 1: 'highway', 2: 'arterial', 3: 'collector' };

/** The roads and their names. Worked out in screen pixels, so a line of 2 px
 *  is 2 px however large the dial is; the inner group scales them back into
 *  the drawing's units. One path per road. */
function MapLayer({ layer, clipId, idPrefix }: { layer: DialMapLayer; clipId: string; idPrefix: string }) {
  const { map, places = [], pxPerUnit } = layer;
  return (
    <g className="blacksky-dial-map" clipPath={`url(#${clipId})`}>
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
}
