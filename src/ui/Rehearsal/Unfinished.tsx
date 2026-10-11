import Glyph from '../components/Glyph';
import Head from './Head';
import { unfinishedView } from '../../core/rehearsal-ending';
import type { UnfinishedRehearsal } from '../../core/types';
import { resumeWithEnding } from './run-state';

/** E5-US1-AC5 — returning to a rehearsal that was started and has no ending.
 *
 *  It asks, and it only asks. The app does not decide she walked and does not
 *  decide she did not: nothing is pre-selected, both answers are identical rows
 *  of identical weight, and leaving without answering leaves the rehearsal
 *  exactly as it was, unfinished, to be asked about next time.
 *
 *  No rehearsal bar. The bar marks a rehearsal that is RUNNING, and after a cold
 *  start nothing is: that is why this asks rather than resuming a screen. The
 *  kicker still names it a rehearsal, as the choice of condition does.
 *
 *  The title and the line under it are the hero, as every rehearsal screen
 *  opens. Answering reaches the existing result, which records the rehearsal finished,
 *  with her ending, over the kept row. */
export default function Unfinished({ rehearsal }: { rehearsal: UnfinishedRehearsal }) {
  const view = unfinishedView(rehearsal);

  return (
    <main className="page rehearsal-condition rehearsal-unfinished">
      <Head title={view.heading} detail={view.detail} />

      <ul className="list condition-list">
        {view.rows.map((row) => (
          <li key={row.ending}>
            {/* The same ringed row as the choice of condition, so two equal
                answers look equal and neither reads as the expected one: the
                place she reached, or the home she stayed at, drawn alike. */}
            <button
              type="button"
              className="candidate-action condition-action condition-choice"
              onClick={() => resumeWithEnding(rehearsal, row.ending)}
            >
              <Glyph kind={row.ending === 'walked' ? 'place' : 'home'} />
              <span className="condition-choice-text">
                <span className="condition-label">{row.label}</span>
              </span>
              <svg className="card-chevron" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
                <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
      {/* Leaving answers nothing, by the Back control above: no second way
          out here, and nothing filled, since nothing here fixes anything. */}
    </main>
  );
}
