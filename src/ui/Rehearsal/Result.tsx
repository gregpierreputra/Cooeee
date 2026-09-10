import { useEffect, useState } from 'react';
import * as copy from '../../core/copy';
import { detectGaps } from '../../core/rehearsal-checks';
import { rehearsalResult, type RehearsalResult } from '../../core/rehearsal-result';
import type { RehearsalRun } from '../../core/rehearsal-run';
import type { CompletePackContent, Rehearsal } from '../../core/types';
import { getCompletePackContent, saveFinishedRehearsal } from '../../data/db';

type ResultProps = {
  run: RehearsalRun;
  loadContent?: (id: string) => Promise<CompletePackContent | undefined>;
  save?: (rehearsal: Rehearsal) => Promise<void>;
  now?: () => number;
};

/** E5-US2-AC1 — what the rehearsal found.
 *
 *  The run walks the fixed journey against the chosen condition, and the moment
 *  it has an answer it HAS FINISHED: there is no step to wait for, so the
 *  finished record is written here and only here, once. The id is the run's own,
 *  so coming back to this screen rewrites the same row rather than recording
 *  the same rehearsal a second time.
 *
 *  Nothing on this screen counts what it found. There is no total, no
 *  percentage, no grade, no pass, no fail and no verdict, and there is nothing
 *  in the model behind it that one could be derived from. A rehearsal says what
 *  could not be relied on; it does not mark the reader's work. */
export default function Result({
  run,
  loadContent = getCompletePackContent,
  save = saveFinishedRehearsal,
  now = Date.now,
}: ResultProps) {
  const [result, setResult] = useState<RehearsalResult | null>(null);

  useEffect(() => {
    let live = true;
    loadContent(run.packId).then((content) => {
      if (!live || !content) return;
      const finished: Rehearsal = {
        id: run.id,
        packId: run.packId,
        condition: run.condition,
        startedAt: run.startedAt,
        finishedAt: now(),
        gaps: detectGaps(run.condition, content),
      };
      // Rendered from the record that was written, not from a second pass over
      // the pack: what the reader sees is what the run found.
      setResult(rehearsalResult(finished));
      // The write is not awaited before rendering. A rehearsal that could not
      // be recorded still ran, and still has something to tell the reader;
      // withholding it would be the blank screen this epic forbids.
      save(finished).catch(() => {});
    });
    return () => {
      live = false;
    };
  }, [loadContent, run, save, now]);

  if (result === null) return null;

  if (result.state === 'no-gaps') {
    return (
      <>
        <h2>{result.heading}</h2>
        <p className="muted">{result.conditionLine}</p>
        <p>{result.detail}</p>
      </>
    );
  }

  return (
    <>
      <h2>{copy.RESULT_HEADING}</h2>
      <p className="muted">{result.conditionLine}</p>

      <ul className="list gap-list">
        {result.rows.map((row) => (
          <li key={`${row.gapType}:${row.hazardLine}`} className="card gap-row">
            <span className="kicker">{row.hazardLine}</span>
            <h3>{row.title}</h3>
            {/* Which of the two kinds this is, said in words. The two kinds are
                told apart by this sentence and by nothing else: no severity, no
                ranking, no separate list, no colour. */}
            <p className="muted">{row.meaning}</p>
            <p className="gap-action-label">{copy.ACTION_LABEL}</p>
            <p>{row.action}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
