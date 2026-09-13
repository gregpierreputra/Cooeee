import { useCallback, useEffect, useState } from 'react';
import * as copy from '../../core/copy';
import { detectGaps } from '../../core/rehearsal-checks';
import { endingRecord } from '../../core/rehearsal-ending';
import { comparableEarlier, rehearsalProgress } from '../../core/rehearsal-progress';
import { rehearsalResult } from '../../core/rehearsal-result';
import type { RehearsalRun } from '../../core/rehearsal-run';
import type { ActionCompletion, CompletePackContent, Rehearsal } from '../../core/types';
import {
  getCompletePackContent,
  listActionCompletions,
  listRehearsalsForPack,
  markActionDone,
  saveFinishedRehearsal,
  undoActionDone,
} from '../../data/db';
import ProgressView from './Progress';

type ResultProps = {
  run: RehearsalRun;
  loadContent?: (id: string) => Promise<CompletePackContent | undefined>;
  loadCompletions?: (packId: string) => Promise<ActionCompletion[]>;
  loadRehearsals?: (packId: string) => Promise<Rehearsal[]>;
  save?: (rehearsal: Rehearsal) => Promise<void>;
  mark?: (packId: string, actionId: string, doneAt: number) => Promise<void>;
  undo?: (packId: string, actionId: string) => Promise<void>;
  now?: () => number;
};

/** E5-US2-AC1 — what the rehearsal found, and what the reader has done about it.
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
  loadCompletions = listActionCompletions,
  loadRehearsals = listRehearsalsForPack,
  save = saveFinishedRehearsal,
  mark = markActionDone,
  undo = undoActionDone,
  now = Date.now,
}: ResultProps) {
  const [finished, setFinished] = useState<Rehearsal | null>(null);
  /** The earlier rehearsal this one is compared against, or null when there is
   *  none. Read BEFORE this run is recorded, so this run cannot be compared
   *  with itself. */
  const [earlier, setEarlier] = useState<Rehearsal | null>(null);
  const [completions, setCompletions] = useState<ActionCompletion[]>([]);
  /** Whether the run itself reached the device. A rehearsal that could not be
   *  kept still ran, and still has something to tell the reader. */
  const [runKept, setRunKept] = useState(true);
  /** The action whose last marking could not be kept, if any. */
  const [notKept, setNotKept] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([
      loadContent(run.packId),
      loadCompletions(run.packId).catch(() => []),
      loadRehearsals(run.packId).catch(() => []),
    ]).then(
      ([content, alreadyDone, previous]) => {
        if (!live || !content) return;
        const record: Rehearsal = {
          id: run.id,
          packId: run.packId,
          condition: run.condition,
          startedAt: run.startedAt,
          packVerifiedAt: content.pack.verifiedAt,
          gaps: detectGaps(run.condition, content),
          // E5-US1-AC5: her ending, the moment she gave it, and on a walked
          // rehearsal the time between its start and that moment. Never
          // supplied here, and never judged anywhere.
          ...(run.ending
            ? endingRecord(run.startedAt, run.ending, run.endedAt ?? now())
            : { finishedAt: now() }),
        };
        setCompletions(alreadyDone);
        setEarlier(comparableEarlier(previous, record));
        setFinished(record);
        // Not awaited before rendering: withholding a result that exists would
        // be the blank screen this epic forbids. But a write that fails is not
        // allowed to vanish either — the reader is told the run was not kept,
        // because "we could not keep this" and "this did not happen" are
        // different statements (rule 0.1).
        save(record).catch(() => {
          if (live) setRunKept(false);
        });
      },
    );
    return () => {
      live = false;
    };
  }, [loadContent, loadCompletions, loadRehearsals, run, save, now]);

  /** Mark, or unmark, one action.
   *
   *  The row is updated first and corrected if the write fails, so a completion
   *  is never shown with a date it does not hold: a date on screen for a record
   *  that did not store would be the product asserting something it cannot back.
   *
   *  Unmarking is the SAME control, tapped again. It is the reader correcting
   *  their own record, which is not the product deciding a completion has gone
   *  stale — nothing here or anywhere else expires one. */
  const toggle = useCallback(
    (actionId: string, wasDone: boolean) => {
      setNotKept(null);
      const before = completions;
      const doneAt = now();
      setCompletions(
        wasDone
          ? before.filter((row) => row.actionId !== actionId)
          : [...before, { id: `${run.packId}:${actionId}`, packId: run.packId, actionId, doneAt }],
      );
      const written = wasDone ? undo(run.packId, actionId) : mark(run.packId, actionId, doneAt);
      written.catch(() => {
        setCompletions(before);
        setNotKept(actionId);
      });
    },
    [completions, mark, undo, now, run.packId],
  );

  if (finished === null) return null;
  const result = rehearsalResult(finished, completions);
  const progress = rehearsalProgress(finished, earlier, completions);

  if (result.state === 'no-gaps') {
    return (
      <>
        <h2>{result.heading}</h2>
        <p className="muted">{result.conditionLine}</p>
        {runKept ? null : <p className="muted">{copy.RUN_NOT_KEPT}</p>}
        <p>{result.detail}</p>
        <ProgressView progress={progress} />
      </>
    );
  }

  return (
    <>
      <h2>{copy.RESULT_HEADING}</h2>
      <p className="muted">{result.conditionLine}</p>
      {runKept ? null : <p className="muted">{copy.RUN_NOT_KEPT}</p>}
      <ProgressView progress={progress} />

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

            {/* The date is shown only where a completion is actually held. */}
            {row.doneOn ? <p className="gap-done">{copy.ACTION_DONE_ON(row.doneOn)}</p> : null}
            <button
              type="button"
              className="action gap-mark"
              onClick={() => toggle(row.actionId, row.doneOn !== null)}
            >
              {row.doneOn ? copy.UNDO_ACTION_DONE : copy.MARK_ACTION_DONE}
            </button>
            {notKept === row.actionId ? (
              <p className="muted" role="status">
                {copy.ACTION_NOT_KEPT}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
