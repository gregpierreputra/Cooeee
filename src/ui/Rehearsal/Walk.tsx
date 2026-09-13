import { useEffect, useState } from 'react';
import * as copy from '../../core/copy';
import type { RehearsalRun } from '../../core/rehearsal-run';
import { walkStep, type WalkStep } from '../../core/rehearsal-walk';
import type { CompletePackContent } from '../../core/types';
import { getCompletePackContent } from '../../data/db';
import HoldButton from '../components/HoldButton';
import { advanceWalkPosition } from './run-state';

type WalkProps = {
  run: RehearsalRun;
  step: WalkStep;
  loadContent?: (id: string) => Promise<CompletePackContent | undefined>;
};

/** E5-US1-AC5 — one step of the walk: the pack, then BlackSky.
 *
 *  The rehearsal renders its OWN screens. BlackSky.tsx is never mounted here, so
 *  the live mode's latch, its position request and its resume behaviour cannot
 *  be reached or changed from a rehearsal. The shared HoldButton is the only
 *  piece taken from it: the same deliberate two-second hold, on the same words.
 *
 *  Reads the pack and writes nothing. The finished record is written by the
 *  result, once, after both steps, exactly as before this walk existed.
 *
 *  The bar is not rendered here: Run, which every screen of a run sits inside,
 *  renders it, so both steps carry it by structure. */
export default function Walk({ run, step, loadContent = getCompletePackContent }: WalkProps) {
  const [content, setContent] = useState<CompletePackContent | null>(null);

  useEffect(() => {
    let live = true;
    loadContent(run.packId).then((read) => {
      if (live && read) setContent(read);
    });
    return () => {
      live = false;
    };
  }, [loadContent, run.packId]);

  if (content === null) return null;
  const view = walkStep(step, run.condition, content);

  return (
    <>
      <p className="kicker walk-counter">{view.counter}</p>
      <h2>{view.heading}</h2>

      {/* Every line carries its state as a sentence. There is no tick, no icon
          and no colour doing that job, so greyscale changes nothing. */}
      <ul className="list walk-lines">
        {view.lines.map((line) => (
          <li key={line.gapType} className="card walk-line">
            <h3>{line.title}</h3>
            {/* A line that holds shows what the pack holds, above the sentence
                saying so. A gap has nothing to show, so it shows no slot. */}
            {line.values.map((value, index) => (
              <p key={`${index}:${value}`} className="walk-value">
                {value}
              </p>
            ))}
            <p>{line.statement}</p>
          </li>
        ))}
      </ul>

      <div className="actions">
        {step === 'pack' ? (
          // The only way to step 2, and it is the real control's hold.
          <HoldButton onHold={advanceWalkPosition} hint={copy.HOLD_TO_ENTER}>
            <span className="blacksky-hold-label">{copy.HOLD_FOR_BLACKSKY}</span>
            <span className="blacksky-hold-sub">{copy.NEXT_STEP}</span>
          </HoldButton>
        ) : (
          // Not filled: seeing the result fixes nothing.
          <button type="button" className="action walk-advance" onClick={advanceWalkPosition}>
            {copy.SEE_WHAT_IT_FOUND}
          </button>
        )}
      </div>
    </>
  );
}
