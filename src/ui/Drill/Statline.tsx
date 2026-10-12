import * as copy from '../../core/copy';
import { CLASSIC, type DrillRules } from '../../core/drill-twists';
import Glyph from '../components/Glyph';
import FactTiles from '../Games/FactTiles';

/** E9-US1-AC1 — one quiet screen before the film: what the drill asks in
 *  three tiles drawn as the game draws them (its clock, its bag count and the
 *  door), this drill's twist, and Start. Back at the top is the way out, as on
 *  the other games. How to steer and grab is
 *  taught by the guide over the real controls, so it is not said here. The
 *  tap on Start is also what lets the phone play sound. */
export default function Statline({ rules = CLASSIC, onStart }: { rules?: DrillRules; onStart: () => void }) {
  const classic = rules === CLASSIC;
  return (
    <>
      <div className="hero">
        <h1>{classic ? copy.DRILL_INTRO_HEADING : copy.DRILL_INTRO_HEADING_FOR(rules.seconds)}</h1>
      </div>
      <FactTiles
        facts={[
          { figure: <span className="drill-fact-clock">{copy.DRILL_CLOCK(rules.seconds)}</span>, label: copy.DRILL_INTRO_TIME },
          {
            // Drawn as the game's bag count, read as the number to pack.
            figure: (
              <span className="drill-fact-bag">
                <Glyph kind="bag" size={18} line />
                <span aria-hidden="true">{`0/${rules.bagLimit}`}</span>
                <span className="visually-hidden">{rules.bagLimit}</span>
              </span>
            ),
            label: copy.DRILL_INTRO_BAG,
          },
          {
            figure: (
              <span className="drill-fact-door">
                <Glyph kind="door" size={18} line />
                <span className="visually-hidden">{copy.DRILL_INTRO_DOOR_HIDDEN}</span>
              </span>
            ),
            label: copy.DRILL_INTRO_DOOR,
          },
        ]}
      />
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
      </div>
    </>
  );
}
