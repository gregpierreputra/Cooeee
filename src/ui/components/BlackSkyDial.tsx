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

/** The dial: a ring that turns with the phone, the person fixed at the centre,
 *  the place as a pin on the ring, and a notch marking the top of the phone.
 *
 *  It is drawn once. Nothing here reads the heading: the ring and the pin turn
 *  in the stylesheet from `--heading`, which the compass hook writes onto the
 *  document root once per display frame, so the phone can turn sixty times a
 *  second without one React render. The only thing React changes is `--bearing`
 *  when the position moves, and the centre shape when trust in it changes.
 *  With no `--heading` the stylesheet falls back to 0, which is north up.
 *
 *  Deliberately absent: any line from the person to the pin, and any road. The
 *  dial says which way the place lies, never which way to travel. */
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
      viewBox="-92 -100 184 192"
      role="img"
      aria-label={description}
      data-centre={centre}
    >
      {/* The viewBox is cut close to the ring (radius 78, plus the pin) so the
          drawing wastes no height; its centre, 0 0, is still where everything
          turns. The top of the phone: fixed, outside the ring. */}
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
      <g className="blacksky-dial-pin" style={{ '--bearing': bearingDeg } as CSSProperties}>
        <circle cy="-78" r="11" />
        <circle className="blacksky-dial-pin-eye" cy="-78" r="4" />
      </g>
      {/* The person. An arrow claims to know which way they face, so it is
          drawn only when a heading is turning the dial. */}
      {centre === 'dot' ? (
        <circle className="blacksky-dial-person" r="8" />
      ) : centre === 'saved-place' ? (
        <path className="blacksky-dial-person hollow" d="M-19 3 0 -16 19 3V21H7V9H-7V21H-19Z" />
      ) : (
        <path
          className={centre === 'outline' ? 'blacksky-dial-person hollow' : 'blacksky-dial-person'}
          d="M0 -28 17 19 0 9 -17 19Z"
        />
      )}
    </svg>
  );
}
