import * as copy from '../../core/copy';
import { ESSENTIAL_COUNT, debriefRows, leftBehind, scoreBreakdown, scoreDrill } from '../../core/drill-score';
import type { DrillOutcome } from './Game';

const EFFECT = { added: copy.ROW_ADDED, took: copy.ROW_TOOK, nothing: copy.ROW_NOTHING };

/** E7-US3 — the score and why, item by item. Away from the door there is no
 *  score: the bag did not leave the house. */
type Props = {
  outcome: DrillOutcome;
  /** The highest score of this pack's drills that reached the door, this one included. */
  highest: number | null;
  onAgain: () => void;
  onDone: () => void;
};

export default function Debrief({ outcome, highest, onAgain, onDone }: Props) {
  const rows = debriefRows(outcome.packed);
  const left = leftBehind(outcome.packed);
  const score = scoreDrill(outcome.packed);
  const groups = scoreBreakdown(outcome.packed);
  const raw = groups.reduce((sum, group) => sum + group.points, 0);
  return (
    <>
      <div className="hero">
        <h1>{outcome.reachedDoor ? copy.DEBRIEF_HEADING : copy.OVER_HEADING}</h1>
        {outcome.reachedDoor ? (
          <>
            <p className="drill-score figure" role="status">{copy.DEBRIEF_SCORE(score)}</p>
            <p className="muted">{copy.DEBRIEF_LEAD}</p>
            {highest !== null ? <p className="muted">{copy.HIGHEST_SO_FAR(highest)}</p> : null}
          </>
        ) : (
          <p>{copy.OVER_DETAIL}</p>
        )}
      </div>
      {/* The why behind the number: what each kind of thing added or took,
          adding up to the score. Only when there is a score to explain. */}
      {outcome.reachedDoor ? (
        <section className="card drill-breakdown" aria-labelledby="drill-breakdown">
          <h2 id="drill-breakdown">{copy.BREAKDOWN_HEADING(score)}</h2>
          <table>
            <tbody>
              {groups.map((group) => (
                <tr key={group.kind}>
                  <th scope="row">
                    {copy.BREAKDOWN_GROUPS[group.kind]}
                    <span className="muted">
                      {group.kind === 'essential'
                        ? copy.BREAKDOWN_OF(group.items.length, ESSENTIAL_COUNT)
                        : copy.BREAKDOWN_COUNT(group.items.length)}
                    </span>
                  </th>
                  <td className={`figure points-${group.kind}`}>{copy.BREAKDOWN_POINTS(group.points)}</td>
                </tr>
              ))}
              <tr className="drill-breakdown-total">
                <th scope="row">{copy.BREAKDOWN_TOTAL}</th>
                <td className="figure">{copy.DEBRIEF_SCORE(score)}</td>
              </tr>
            </tbody>
          </table>
          <p className="muted">{raw < 0 ? copy.BREAKDOWN_FLOOR : copy.BREAKDOWN_TOP}</p>
        </section>
      ) : null}
      {rows.length === 0 ? (
        <p>{copy.NOTHING_PACKED}</p>
      ) : (
        <ul className="list">
          {rows.map(({ item, effect }) => (
            <li key={item.id} className="card history-row">
              <p className="history-date">{item.name}</p>
              {outcome.reachedDoor ? <p className="muted">{`${EFFECT[effect]}, ${copy.BREAKDOWN_POINTS(item.weight)}`}</p> : null}
              <p>{item.why}</p>
            </li>
          ))}
        </ul>
      )}
      {/* What stayed behind is half of the lesson: a bag of three good things
          says nothing about the seven that were never picked up. */}
      {left.length > 0 ? (
        <>
          <h2>{copy.LEFT_IN_HOUSE}</h2>
          <ul className="list">
            {left.map((item) => (
              <li key={item.id} className="card history-row">
                <p className="history-date">{item.name}</p>
                <p>{item.why}</p>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <p className="muted">{copy.DRILL_SOURCE}</p>
      <div className="actions">
        <button type="button" className="action main-action" onClick={onDone}>
          {copy.GO_ON_TO_REHEARSAL}
        </button>
        <button type="button" className="action" onClick={onAgain}>
          {outcome.reachedDoor ? copy.PLAY_AGAIN : copy.TRY_AGAIN}
        </button>
      </div>
    </>
  );
}
