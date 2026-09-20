import type { CSSProperties } from 'react';
import type { DialCentre } from '../../core/blacksky-dial';

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
 *  Deliberately absent: a line joining the centre to the pin, and any road. The
 *  arrow stops well short of the ring. The dial says which way the place lies,
 *  never which way to travel. */
export default function BlackSkyDial({
  bearingDeg,
  centre,
  description,
}: {
  bearingDeg: number;
  centre: DialCentre;
  description: string;
}) {
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
        <circle r="78" />
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
      {/* One bearing, set once on the two things that point at the place, so the
          arrow and the pin can never disagree. */}
      <g className="blacksky-dial-pin" style={{ '--bearing': bearingDeg } as CSSProperties}>
        <circle cy="-78" r="11" />
        <circle className="blacksky-dial-pin-eye" cy="-78" r="4" />
      </g>
      {/* The arrow: from the centre toward the pin, long enough to be read at a
          glance, its tip short of the ring letters so it never covers one and
          never touches the pin. Hollow when the position is old or marked. */}
      <g className="blacksky-dial-arrow" style={{ '--bearing': bearingDeg } as CSSProperties}>
        <path className={centre === 'outline' ? 'hollow' : undefined} d="M0 -46 16 -14H6V18H-6V-14H-16Z" />
      </g>
    </svg>
  );
}
