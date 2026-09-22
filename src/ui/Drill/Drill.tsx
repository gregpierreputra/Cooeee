import { useCallback, useEffect, useState } from 'react';
import * as copy from '../../core/copy';
import { DRILL_SECONDS } from '../../core/drill-items';
import { highestScore } from '../../core/drill-history';
import { scoreDrill } from '../../core/drill-score';
import { listDrills, saveDrill } from '../../data/db';
import Glyph from '../components/Glyph';
import * as audio from './audio';
import Debrief from './Debrief';
import Game, { type DrillOutcome } from './Game';
import SoundButton from './SoundButton';
import Statline from './Statline';

type Stage = 'statline' | 'game' | 'again' | 'debrief' | 'unavailable';

/** An id for the record. A page opened over plain http has no randomUUID. */
const newId = (): string =>
  crypto.randomUUID?.() ??
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');

type Props = {
  packId: string;
  onDone: () => void;
  /** The length of the minute. Only the test harness passes anything else. */
  seconds?: number;
};

/** E7 — the drill in front of a rehearsal: one fact, the opening picture, one
 *  minute in the house, then the debrief. `onDone` hands over to the
 *  rehearsal, whether the drill was played or skipped. */
export default function Drill({ packId, onDone, seconds = DRILL_SECONDS }: Props) {
  const [stage, setStage] = useState<Stage>('statline');
  const [outcome, setOutcome] = useState<DrillOutcome | null>(null);
  const [highest, setHighest] = useState<number | null>(null);

  const unavailable = useCallback(() => setStage('unavailable'), []);
  // The sound stops with the drill, however it is left.
  useEffect(() => audio.suspend, []);

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
        score: result.reachedDoor ? scoreDrill(result.packed) : 0,
        packed: result.packed,
      });
      setHighest(highestScore(await listDrills(packId)));
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
        <p className="pack-section-head rehearsal-head">
          <Glyph kind="rehearse" />
          <span className="kicker">{copy.DRILL_LABEL}</span>
        </p>
        {/* Sound plays only from the film on, so the control sits where it
            matters: on this first screen and over the game, not the report. */}
        {stage === 'statline' ? <SoundButton /> : null}
      </div>
      {stage === 'statline' ? <Statline onStart={() => start('game')} onSkip={onDone} /> : null}
      {stage === 'game' || stage === 'again' ? (
        <Game key={stage} opening={stage === 'game'} seconds={seconds} onEnd={finish} onUnavailable={unavailable} onLeave={onDone} />
      ) : null}
      {stage === 'debrief' && outcome ? (
        <Debrief outcome={outcome} highest={highest} onAgain={() => start('again')} onDone={onDone} />
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
