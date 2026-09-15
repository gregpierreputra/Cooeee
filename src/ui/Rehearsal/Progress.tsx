import * as copy from '../../core/copy';
import type { GapRow } from '../../core/rehearsal-result';
import type { PackChange, Progress } from '../../core/rehearsal-progress';

/** E5-US2-AC2, AC3 and AC4 — one component in three states, because they are
 *  three readings of the same question and splitting them would let the screen
 *  drift between them.
 *
 *  Every group is told apart by its HEADING. There is no colour, no dot, no
 *  badge and no arrow anywhere here: strip every colour out of the page and it
 *  still says which list is which, which is what WCAG 1.4.1 asks and what a
 *  phone in sunlight delivers whether we ask or not.
 *
 *  And there is no figure of any kind. Not a total, not a count, not a
 *  percentage, not a bar, not a chart, and not an empty one standing in for a
 *  comparison that does not exist yet. A summary of what someone has not done
 *  is a mark, and this product does not mark its reader. */
export default function ProgressView({ progress }: { progress: Progress }) {
  // AC3. The first rehearsal says what is not there yet and stops. The gap list
  // itself is rendered by the result, in full, either way: a first rehearsal is
  // a whole result, not a partial one.
  if (progress.state === 'first') {
    return (
      <section className="progress">
        <h3>{copy.FIRST_REHEARSAL_HEADING}</h3>
        <p className="muted">{copy.FIRST_REHEARSAL_DETAIL}</p>
      </section>
    );
  }

  const groups: { heading: string; rows: GapRow[] }[] = [
    { heading: copy.GROUP_NEWLY_DETECTED, rows: progress.newlyDetected },
    { heading: copy.GROUP_DONE_SINCE, rows: progress.completedSince },
    { heading: copy.GROUP_STILL_OPEN, rows: progress.stillOpen },
  ];

  return (
    <section className="progress">
      <h3>{copy.PROGRESS_HEADING}</h3>
      <p className="muted">{progress.earlierOn}</p>
      <PackChangeLine change={progress.packChange} />

      {/* A group with nothing in it is simply not there. An empty list under a
          heading would be a zero written out in words. */}
      {groups
        .filter(({ rows }) => rows.length > 0)
        .map(({ heading, rows }) => (
          <div key={heading} className="progress-group">
            <span className="kicker">{heading}</span>
            <ul className="list progress-list">
              {rows.map((row) => (
                <li key={`${heading}:${row.gapType}:${row.hazardLine}`}>{row.title}</li>
              ))}
            </ul>
          </div>
        ))}
    </section>
  );
}

/** AC4. Says the PACK changed, and when, and keeps that apart from anything the
 *  reader did. The comparison above it stands either way: it is annotated, never
 *  suppressed and never offered as like for like. */
function PackChangeLine({ change }: { change: PackChange }) {
  if (change.state === 'unchanged') return null;
  return (
    <p className="progress-pack-change">
      {change.state === 'changed'
        ? copy.PACK_CHANGED_ON(change.changedOn)
        : copy.PACK_CHANGE_UNKNOWN}
    </p>
  );
}
