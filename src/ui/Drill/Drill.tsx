import { useCallback, useEffect, useState } from 'react';
import * as copy from '../../core/copy';
import { melbourneDay } from '../../core/day';
import { highestForTwist } from '../../core/drill-history';
import { scoreDrill } from '../../core/drill-score';
import { rulesFor, twistForDay } from '../../core/drill-twists';
import { listAllDrills, saveDrill } from '../../data/db';
import { focusMain } from '../components/focusMain';
import * as audio from './audio';
import Debrief from './Debrief';
import { pinnedTwist } from './drill-state';
import Game, { type DrillOutcome } from './Game';
import SoundButton from './SoundButton';
import Statline from './Statline';
import TabLabel from '../components/TabLabel';

type Stage = 'statline' | 'game' | 'again' | 'debrief' | 'unavailable';

/** An id for the record. A page opened over plain http has no randomUUID. */
const newId = (): string =>
  crypto.randomUUID?.() ??
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');

type Props = {
  packId: string;
  onDone: () => void;
  /** The length of the drill, in seconds, when not the twist's own. Only the
   *  test harness passes it. */
  seconds?: number;
  /** The twist to play, when not the day's. Only the test harness passes it. */
  twist?: string;
};

/** E9 — the drill in front of a rehearsal: one fact, the opening picture,
 *  two minutes in the house, then the debrief. `onDone` hands over to the
 *  rehearsal, whether the drill was played or skipped. */
export default function Drill({ packId, onDone, seconds: secondsOverride, twist }: Props) {
  // The day's twist, settled once as the drill opens, so it cannot change
  // under a person playing across midnight.
  const [rules] = useState(() => rulesFor(twist ?? pinnedTwist() ?? twistForDay(melbourneDay(Date.now())).id));
  const seconds = secondsOverride ?? rules.seconds;
  const [stage, setStage] = useState<Stage>('statline');
  const [outcome, setOutcome] = useState<DrillOutcome | null>(null);
  const [highest, setHighest] = useState<number | null>(null);

  const unavailable = useCallback(() => setStage('unavailable'), []);
  // The sound stops with the drill, however it is left.
  useEffect(() => audio.suspend, []);
  // The report and the unavailable card replace the control that led to them.
  // The film places its own focus.
  useEffect(() => {
    if (stage === 'debrief' || stage === 'unavailable') focusMain();
  }, [stage]);

  const finish = async (result: DrillOutcome) => {
    setOutcome(result);
    setStage('debrief');
    // The record is for the pack page. A store that refuses costs the debrief
    // nothing. The score is worked out here from the bag, never read from the screen.
    try {
      await saveDrill({
        id: newId(),
        packId,
        finishedAt: Date.now(),
        reachedDoor: result.reachedDoor,
        score: result.reachedDoor ? scoreDrill(result.packed, rules) : 0,
        packed: result.packed,
        twist: rules.twist,
      });
      // Every pack's drills under this twist: the scores are out of the same bag.
      setHighest(highestForTwist(await listAllDrills(), rules.twist));
    } catch {
      setHighest(null);
    }
  };

  const start = (next: Stage) => {
    audio.unlock(); // Sound may only start from inside a tap.
    setStage(next);
  };

  return (
    <main className="page drill-page">
      <div className="drill-head">
        <TabLabel tab="rehearse" text={copy.DRILL_LABEL} />
        {/* Sound plays only from the film on, so the control sits where it
            matters: on this first screen and over the game, not the report. */}
        {stage === 'statline' ? <SoundButton /> : null}
      </div>
      {stage === 'statline' ? <Statline rules={rules} onStart={() => start('game')} onSkip={onDone} /> : null}
      {stage === 'game' || stage === 'again' ? (
        <Game key={stage} opening={stage === 'game'} seconds={seconds} rules={rules} onEnd={finish} onUnavailable={unavailable} onLeave={onDone} />
      ) : null}
      {stage === 'debrief' && outcome ? (
        <Debrief outcome={outcome} rules={rules} highest={highest} onAgain={() => start('again')} onDone={onDone} />
      ) : null}
      {stage === 'unavailable' ? (
        <>
          <div className="card" role="status" aria-live="polite">
            <p>{copy.DRILL_UNAVAILABLE}</p>
          </div>
          <div className="actions">
            <button type="button" className="action main-action" onClick={onDone}>
              {copy.GO_ON_TO_REHEARSAL}
            </button>
          </div>
        </>
      ) : null}
    </main>
  );
}
