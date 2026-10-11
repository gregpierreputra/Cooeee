import * as copy from '../../core/copy';
import { CLASSIC, type DrillRules } from '../../core/drill-twists';

/** E9-US1-AC1 — one quiet screen before the film: what the drill asks, this
 *  drill's twist, and the two ways on. The tap on Start is also what lets the
 *  phone play sound. */
export default function Statline({ rules = CLASSIC, onStart, onSkip }: { rules?: DrillRules; onStart: () => void; onSkip: () => void }) {
  const classic = rules === CLASSIC;
  return (
    <>
      <div className="hero">
        <h1>{classic ? copy.DRILL_INTRO_HEADING : copy.DRILL_INTRO_HEADING_FOR(rules.seconds)}</h1>
        <p>{classic ? copy.DRILL_STAT_DETAIL : copy.DRILL_STAT_DETAIL_FOR(rules.seconds, rules.bagLimit)}</p>
      </div>
      {classic ? null : (
        <section className="card drill-twist" aria-labelledby="drill-twist-label">
          <p id="drill-twist-label" className="kicker">{copy.DRILL_TWIST_LABEL}</p>
          <p className="drill-twist-name">{rules.name}</p>
          <p>{rules.rule}</p>
        </section>
      )}
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
