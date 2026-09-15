import { Link } from 'react-router';
import * as copy from '../../core/copy';
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
 *  Answering reaches the existing result, which records the rehearsal finished,
 *  with her ending, over the kept row. */
export default function Unfinished({ rehearsal }: { rehearsal: UnfinishedRehearsal }) {
  const view = unfinishedView(rehearsal);

  return (
    <main className="page rehearsal-condition rehearsal-unfinished">
      <Head />
      <h2>{view.heading}</h2>
      <p>{view.detail}</p>

      <ul className="list condition-list">
        {view.rows.map((row) => (
          <li key={row.ending}>
            {/* The same tappable row as the choice of condition, so two equal
                answers look equal and neither reads as the expected one. */}
            <button
              type="button"
              className="candidate-action condition-action"
              onClick={() => resumeWithEnding(rehearsal, row.ending)}
            >
              <span className="condition-label">{row.label}</span>
              <span className="condition-detail">{row.detail}</span>
            </button>
          </li>
        ))}
      </ul>

      {/* Leaving answers nothing. No filled control: nothing here fixes anything. */}
      <div className="actions">
        <Link className="action" to={`/packs/${rehearsal.packId}`}>
          {copy.BACK_TO_THIS_PACK}
        </Link>
      </div>
    </main>
  );
}
