import * as copy from '../../core/copy';
import { titleCase } from '../../core/home';
import Glyph from '../components/Glyph';
import Hint from '../components/Hint';
import Head from './Head';
import { conditionRows, type RehearsalCondition } from '../../core/rehearsal-condition';
import type { PackIcon } from '../../core/types';

/** E5-US1-AC1 — the user says what the rehearsal is run without.
 *
 *  One tap chooses, and the tap is the whole interaction. There is no radio
 *  group and no separate confirm, for two reasons: a pre-checked radio is
 *  exactly what "nothing is pre-selected" forbids, and a confirm step would
 *  need a filled control on a screen that must not have one. Choosing is
 *  therefore the only way past this screen, and nothing is chosen until it is.
 *
 *  Choosing is setup, not commitment (E5-US1-AC5): it writes nothing and starts
 *  nothing. It hands the condition to the journey screen, where "I'm going now"
 *  is what starts the rehearsal.
 *
 *  Both rows are identical markup with identical weight. Nothing marks one as
 *  likelier, more realistic or more serious, and the row model carries no field
 *  that could. */
export default function Condition({
  packName,
  packAddress,
  packIcon,
  onChoose,
}: {
  /** The title, its drawing and the line under it, so the screen says which
   *  place is rehearsed, as the pack page does. */
  packName: string;
  packAddress: string;
  packIcon: PackIcon;
  onChoose: (condition: RehearsalCondition) => void;
}) {
  return (
    <main className="page rehearsal-condition">
      <Head title={packName} titleIcon={packIcon} detail={titleCase(packAddress)} />
      <h2 className="kicker section-label">{copy.CHOOSE_CONDITION_HEADING}</h2>

      <ul className="list condition-list">
        {conditionRows().map((row) => (
          <li key={row.condition}>
            {/* The app's existing tappable-row treatment, shared with the
                address candidate list rather than copied from it: one rule
                serves both, so the two lists cannot drift apart.
                .condition-action adds only the second line. */}
            <button
              type="button"
              className="candidate-action condition-action condition-choice"
              onClick={() => onChoose(row.condition)}
            >
              <Glyph kind={row.condition === 'no-data' ? 'offline' : 'locate'} />
              <span className="condition-choice-text">
                <span className="condition-label">{row.label}</span>
                <span className="condition-detail">{row.detail}</span>
              </span>
              <svg className="card-chevron" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
                <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
      {/* What a rehearsal is, last and closed, once for both options: the
          options lead, and a first-timer finds it before tapping. */}
      <Hint label={copy.ABOUT_REHEARSAL} asText titled={false}>
        <ul className="info-lines glyph-lines">
          <li><Glyph kind="go" line />{copy.JOURNEY_WHAT_IT_IS}</li>
          <li><Glyph kind="clock" line />{copy.JOURNEY_WHAT_IT_IS_FOR}</li>
        </ul>
      </Hint>
    </main>
  );
}
