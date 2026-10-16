/** The turning arc of Busy closed into a ring, with a tick drawn inside: the
 *  work it stood for is done. An outline only, so it never reads as the filled
 *  tick of a pack already saved. A picture only: the words beside it say what
 *  is ready, and with reduced motion it simply appears. */
export default function ReadyMark({ size = 18 }: { size?: number }) {
  return (
    <svg className="ready-mark" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      {/* Starts at the top, where Busy's arc starts, and closes clockwise. */}
      <circle
        className="ready-mark-ring"
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        pathLength={1}
        transform="rotate(-90 12 12)"
      />
      <path
        className="ready-mark-tick"
        d="M8 12.5l2.75 2.75L16 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
      />
    </svg>
  );
}
