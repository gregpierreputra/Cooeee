import { Link } from 'react-router';
import * as copy from '../../core/copy';
import { conditionRows } from '../../core/rehearsal-condition';
import { startRun } from './run-state';

/** E5-US1-AC1 — the user says what the rehearsal is run without.
 *
 *  One tap chooses, and the tap is the whole interaction. There is no radio
 *  group and no separate confirm, for two reasons: a pre-checked radio is
 *  exactly what "nothing is pre-selected" forbids, and a confirm step would
 *  need a filled control on a screen that must not have one. Choosing is
 *  therefore the only way past this screen, and nothing is chosen until it is.
 *
 *  Both rows are identical markup with identical weight. Nothing marks one as
 *  likelier, more realistic or more serious, and the row model carries no field
 *  that could. */
export default function Condition({ packId }: { packId: string }) {
  // The tap starts the run, and the run is held above this component (see
  // run-state.ts) rather than in it: a rehearsal has to survive the user
  // leaving this screen and coming back, which component state would not.
  // Nothing is chosen until the tap, because there is no state here to default.
  return (
    <main className="page rehearsal-condition">
      <span className="kicker">{copy.REHEARSAL_LABEL}</span>
      <h2>{copy.CHOOSE_CONDITION_HEADING}</h2>

      <ul className="list condition-list">
        {conditionRows().map((row) => (
          <li key={row.condition}>
            {/* The app's existing tappable-row treatment, shared with the
                address candidate list rather than copied from it: one rule
                serves both, so the two lists cannot drift apart.
                .condition-action adds only the second line. */}
            <button
              type="button"
              className="candidate-action condition-action"
              onClick={() => startRun(packId, row.condition)}
            >
              <span className="condition-label">{row.label}</span>
              <span className="condition-detail">{row.detail}</span>
            </button>
          </li>
        ))}
      </ul>

      {/* No filled control on this screen. The filled control means "this is
          what would fix it", and nothing here fixes anything. */}
      <div className="actions">
        <Link className="action" to={`/packs/${packId}`}>
          {copy.BACK_TO_THIS_PACK}
        </Link>
      </div>
    </main>
  );
}
