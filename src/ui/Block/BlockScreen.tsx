import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import * as copy from '../../core/copy';
import { BLOCK_SECONDS, blockTileView, hazardsForDay, highestBlock, scoreBlock } from '../../core/block';
import { melbourneDay } from '../../core/day';
import type { BlockPlay } from '../../core/types';
import { listBlockPlays, saveBlockPlay } from '../../data/db';
import { focusMain } from '../components/focusMain';
import * as audio from '../Drill/audio';
import SoundButton from '../Drill/SoundButton';
import BlockDebrief from './BlockDebrief';
import BlockGame, { type BlockOutcome } from './BlockGame';
import TabLabel from '../components/TabLabel';

type Stage = 'intro' | 'game' | 'debrief' | 'unavailable';

/** An id for the record. A page opened over plain http has no randomUUID. */
const newId = (): string =>
  crypto.randomUUID?.() ??
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');

type Props = {
  /** A fixed time, for tests. The day is settled from it once. */
  now?: number;
  /** The length of the game, in seconds. Only the test harness passes anything else. */
  seconds?: number;
  loadPlays?: () => Promise<BlockPlay[]>;
  savePlay?: (play: BlockPlay) => Promise<void>;
};

/** Ready the Block — what the game asks, three minutes over the yard, then
 *  the report. Every finished play is kept; the card shows today's highest
 *  and the highest of all. */
export default function BlockScreen({ now, seconds = BLOCK_SECONDS, loadPlays = listBlockPlays, savePlay = saveBlockPlay }: Props) {
  const navigate = useNavigate();
  // The day is settled as the screen opens, so a game played across
  // midnight is kept as the day it started.
  const [day] = useState(() => melbourneDay(now ?? Date.now()));
  const [hazards] = useState(() => hazardsForDay(day));
  const [stage, setStage] = useState<Stage>('intro');
  const [round, setRound] = useState(0);
  const [outcome, setOutcome] = useState<BlockOutcome | null>(null);
  const [plays, setPlays] = useState<BlockPlay[]>([]);
  const [highest, setHighest] = useState<number | null>(null);

  useEffect(() => {
    loadPlays().then(setPlays, () => undefined);
  }, [loadPlays]);
  // The sound stops with the game, however it is left.
  useEffect(() => audio.suspend, []);
  useEffect(() => {
    if (stage === 'debrief' || stage === 'unavailable') focusMain();
  }, [stage]);

  const back = useCallback(() => navigate('/rehearse'), [navigate]);
  const start = () => {
    audio.unlock(); // Sound may only start from inside a tap.
    setRound((n) => n + 1);
    setStage('game');
  };

  const finish = async (result: BlockOutcome) => {
    setOutcome(result);
    setStage('debrief');
    const play: BlockPlay = {
      id: newId(),
      day,
      finishedAt: Date.now(),
      score: scoreBlock({ found: result.found.length, wrongTaps: result.wrongTaps, hints: result.hints }),
      hazards: hazards.map((hazard) => hazard.id),
      found: result.found,
      wrongTaps: result.wrongTaps,
      hints: result.hints,
    };
    // A store that refuses costs the report nothing but the highest score.
    try {
      await savePlay(play);
      const all = await loadPlays();
      setPlays(all);
      setHighest(highestBlock(all));
    } catch {
      setHighest(null);
    }
  };

  const today = blockTileView(plays, day).today;

  return (
    <main className="page drill-page block-page">
      <div className="drill-head">
        <TabLabel tab="rehearse" text={copy.BLOCK_LABEL} />
        {stage === 'intro' ? <SoundButton /> : null}
      </div>
      {stage === 'intro' ? (
        <>
          <div className="hero">
            <h1>{copy.BLOCK_INTRO_HEADING}</h1>
          </div>
          <ul className="block-facts">
            {copy.BLOCK_INTRO_FACTS.map(({ figure, label }) => (
              <li key={label}>
                <span className="block-fact-figure figure">{figure}</span>
                <span className="block-fact-label">{label}</span>
              </li>
            ))}
          </ul>
          <p className="block-costs muted">{copy.BLOCK_INTRO_COSTS}</p>
          {today !== null ? <p className="muted">{copy.BLOCK_TODAY_ALREADY(today)}</p> : null}
          <div className="actions">
            {/* Start alone: the Back bar at the top is the way out before a
                round, so a second way back here would only repeat it. */}
            <button type="button" className="action main-action" onClick={start}>
              {copy.START_BLOCK}
            </button>
          </div>
        </>
      ) : null}
      {stage === 'game' ? (
        <BlockGame
          key={round}
          day={day}
          hazards={hazards}
          seconds={seconds}
          onEnd={finish}
          onUnavailable={() => setStage('unavailable')}
          onLeave={() => setStage('intro')}
        />
      ) : null}
      {stage === 'debrief' && outcome ? (
        <BlockDebrief hazards={hazards} outcome={outcome} highest={highest} onAgain={start} onDone={back} />
      ) : null}
      {stage === 'unavailable' ? (
        <>
          <div className="card" role="status" aria-live="polite">
            <p>{copy.BLOCK_UNAVAILABLE}</p>
          </div>
          <div className="actions">
            <button type="button" className="action main-action" onClick={back}>
              {copy.BACK_TO_REHEARSE}
            </button>
          </div>
        </>
      ) : null}
    </main>
  );
}
