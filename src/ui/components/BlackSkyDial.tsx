import { useId, type CSSProperties } from 'react';
import type { DialCentre } from '../../core/blacksky-dial';
import { ROADS_LABEL_PX } from '../../core/constants';
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

/** The ring's radius, and the circle the map is cut to just inside it, in the
 *  drawing's own units. The screen needs the first to scale the map. */
export const RING_R = 78;
const MAP_CLIP_R = 77;
/** Where the ring's letters sit, in the same units, so the map's names can be
 *  kept off them. */
export const LETTER_R = 57;
/** The drawing's width in its own units (the viewBox below). */
export const DIAL_UNITS = 192;

/** The map inside the ring: roads and names in screen pixels, north up, and
 *  how many screen pixels one unit of the drawing is, so they can be set at
 *  their true pixel sizes whatever size the dial is drawn at. */
export type DialMapLayer = { map: DialMap; pxPerUnit: number };

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
  const pinY = -(pinAtR ?? RING_R);
  return (
    <svg
      className="blacksky-dial"
      viewBox="-96 -100 192 192"
      role="img"
      aria-label={description}
      data-centre={centre}
    >
      {/* A square drawing, cut close to the ring (radius 78, plus the pin and
          the notch above it), so the dial fills the width it is given; its
          centre, 0 0, is where everything turns. The top of the phone: fixed,
          outside the ring. */}
      <path className="blacksky-dial-notch" d="M-8 -100H8L0 -88Z" />
      <g className="blacksky-dial-ring">
        {/* BS_Enhancement-AC5: the map is the first thing inside the ring's
            group, so it turns with the ring by the same --heading, under the
            ring, the letters, the arrow and the pin, and is never redrawn per
            sensor reading. Cut to the inside of the ring. */}
        {map ? <MapLayer layer={map} clipId={`${id}-clip`} idPrefix={id} /> : null}
        <circle r={RING_R} />
        {TICKS.map((deg) => (
          <line key={deg} y1="-78" y2="-70" transform={`rotate(${deg})`} />
        ))}
        {POINTS.map(({ letter, deg }) => (
          // Two turns: the outer one carries the letter round the ring, the
          // inner one (in the stylesheet) keeps it upright as the ring turns.
          <g key={letter} transform={`rotate(${deg}) translate(0 -57)`}>
            <g transform={`rotate(${-deg})`}>
              <text className="blacksky-dial-letter" textAnchor="middle" dominantBaseline="central">
                {letter}
              </text>
            </g>
          </g>
        ))}
      </g>
      {/* The arrow: from the centre toward the pin, long enough to be read at a
          glance, its tip short of the ring letters so it never covers one and
          never touches the pin. Hollow when the position is old or marked. */}
      <g className="blacksky-dial-arrow" style={{ '--bearing': bearingDeg } as CSSProperties}>
        <path className={centre === 'outline' ? 'hollow' : undefined} d="M0 -46 16 -14H6V18H-6V-14H-16Z" />
      </g>
      {/* One bearing, set once on the two things that point at the place, so the
          arrow and the pin can never disagree. Drawn after the arrow: with roads,
          a close place brings the pin in off the ring to its true spot, and
          there it must not hide under the arrow. */}
      <g className="blacksky-dial-pin" style={{ '--bearing': bearingDeg } as CSSProperties}>
        <circle cy={pinY} r="11" />
        <circle className="blacksky-dial-pin-eye" cy={pinY} r="4" />
      </g>
    </svg>
  );
}

/** The roads and their names. Worked out in screen pixels, so a line of 2 px
 *  is 2 px however large the dial is; the inner group scales them back into
 *  the drawing's units. One path per road. */
function MapLayer({ layer, clipId, idPrefix }: { layer: DialMapLayer; clipId: string; idPrefix: string }) {
  const { map, pxPerUnit } = layer;
  return (
    <g className="blacksky-dial-map" clipPath={`url(#${clipId})`}>
      <defs>
        <clipPath id={clipId}>
          <circle r={MAP_CLIP_R} />
        </clipPath>
      </defs>
      <g transform={`scale(${1 / pxPerUnit})`}>
        {map.roads.map((road, i) => (
          <path
            key={i}
            className={road.cls === 0 ? 'blacksky-road freeway' : 'blacksky-road'}
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
      </g>
    </g>
  );
}
