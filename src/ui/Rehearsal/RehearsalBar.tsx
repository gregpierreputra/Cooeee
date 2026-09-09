import { barParts, type RehearsalRun } from '../../core/rehearsal-run';

/** E5-US1-AC2 — the bar that says this is a rehearsal.
 *
 *  ONE component, rendered by the wrapper every run screen sits inside, so the
 *  marker cannot be present on one screen of a run and missing from the next:
 *  there is no second copy of it to forget.
 *
 *  It says two things in words — the word Rehearsal, and the condition being
 *  rehearsed without. Nothing about it depends on colour: strip every colour
 *  out and both facts are still written on it, which is what WCAG 1.4.1 asks
 *  and what a phone in bright sun delivers whether we ask or not. */
export default function RehearsalBar({ run }: { run: RehearsalRun }) {
  const { marker, condition } = barParts(run);

  return (
    <div className="rehearsal-bar">
      <b className="rehearsal-bar-marker">{marker}</b>
      <span className="rehearsal-bar-condition">{condition}</span>
    </div>
  );
}
