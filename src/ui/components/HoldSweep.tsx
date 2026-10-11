/** The ring a hold sweeps round a round hold button, from the top, for the two
 *  seconds of the hold (see .hold-sweep in the stylesheet). Drawn as a circle's
 *  stroke: a stroke offset animates in every browser, where a gradient's angle
 *  does not repaint in Safari. */
export default function HoldSweep() {
  return (
    <svg className="hold-sweep" viewBox="0 0 74 74" aria-hidden="true" focusable="false">
      <circle cx="37" cy="37" r="35.5" pathLength="100" />
    </svg>
  );
}
