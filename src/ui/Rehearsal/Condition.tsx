import { useState } from 'react';
import { Link } from 'react-router';
import * as copy from '../../core/copy';
import {
  conditionLabel,
  conditionRows,
  type RehearsalCondition,
} from '../../core/rehearsal-condition';

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
export default function Condition({
  packId,
  onChosen,
}: {
  packId: string;
  /** Where the chosen condition goes next. Held in memory by the caller: this
   *  PR writes nothing, and the store belongs to the PR that adds gaps and
   *  actions, which are the first things that have to survive a reload. */
  onChosen?: (condition: RehearsalCondition) => void;
}) {
  // null until the user taps. There is no default, and no value stands in for
  // one: a condition nobody chose is not a condition the rehearsal may run.
  const [chosen, setChosen] = useState<RehearsalCondition | null>(null);

  if (chosen) {
    // ponytail: a plain line, not a bar. D-C settled that a running rehearsal
    // carries a persistent bar across every screen, top to bottom, readable in
    // greyscale; the PR that runs a rehearsal builds it. This line exists only
    // to show the chosen condition reached the next screen, and is replaced by
    // that bar rather than grown into it.
    return (
      <main className="page rehearsal-condition">
        <span className="kicker">{copy.REHEARSAL_LABEL}</span>
        <div className="card" role="status" aria-live="polite">
          <h2>{copy.REHEARSING_WITHOUT(conditionLabel(chosen))}</h2>
        </div>
        <div className="actions">
          <Link className="action" to={`/packs/${packId}`}>
            {copy.BACK_TO_THIS_PACK}
          </Link>
        </div>
      </main>
    );
  }

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
              onClick={() => {
                setChosen(row.condition);
                onChosen?.(row.condition);
              }}
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
