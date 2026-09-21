import * as copy from '../../core/copy';

/** E7-US1-AC1 — one quiet screen before the film: what the drill asks, and the
 *  two ways on. The tap on Start is also what lets the phone play sound. */
export default function Statline({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  return (
    <>
      <div className="hero">
        <h1>{copy.DRILL_INTRO_HEADING}</h1>
        <p>{copy.DRILL_STAT_DETAIL}</p>
      </div>
      <div className="actions">
        <button type="button" className="action main-action" onClick={onStart}>
          {copy.START_DRILL}
        </button>
        <button type="button" className="action" onClick={onSkip}>
          {copy.SKIP_DRILL}
        </button>
      </div>
    </>
  );
}
