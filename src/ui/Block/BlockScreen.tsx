import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import * as copy from '../../core/copy';
import { BLOCK_SECONDS, blockTileView, hazardsForDay, highestBlock, scoreBlock } from '../../core/block';
import { BLOCK_ATLAS, BLOCK_SHEET } from '../../core/block-atlas';
import { BLOCK_DECOYS, BLOCK_PICKS } from '../../core/block-hazards';
import { BLOCK_HEIGHT, BLOCK_SCENERY, BLOCK_TILE, BLOCK_WIDTH, type Placed } from '../../core/block-layout';
import { melbourneDay } from '../../core/day';
import type { BlockPlay } from '../../core/types';
import { listBlockPlays, saveBlockPlay } from '../../data/db';
import { focusMain } from '../components/focusMain';
import * as audio from '../Drill/audio';
import SoundButton from '../Drill/SoundButton';
import BlockDebrief from './BlockDebrief';
import BlockGame, { type BlockOutcome } from './BlockGame';
import Glyph from '../components/Glyph';
import TabLabel from '../components/TabLabel';
import FactTiles from '../Games/FactTiles';

type Stage = 'intro' | 'game' | 'debrief' | 'unavailable';

/** One harmless thing standing in the yard picture, as the game stands it:
 *  the middle of its bottom edge at its place, sized and placed in shares of
 *  the yard so it scales with the picture. */
function YardThing({ sprite, x, y }: Placed) {
  const [sx, sy, w, h] = BLOCK_ATLAS[sprite];
  const share = (part: number, whole: number) => `${(100 * part) / whole}%`;
  return (
    <span
      className="block-yard-thing"
      style={{
        left: share(x * BLOCK_TILE, BLOCK_WIDTH),
        top: share(y * BLOCK_TILE, BLOCK_HEIGHT),
        width: share(w, BLOCK_WIDTH),
        height: share(h, BLOCK_HEIGHT),
        backgroundSize: `${share(BLOCK_SHEET[0], w)} ${share(BLOCK_SHEET[1], h)}`,
        backgroundPosition: `${share(sx, BLOCK_SHEET[0] - w)} ${share(sy, BLOCK_SHEET[1] - h)}`,
      }}
    />
  );
}

/** The scenery and the harmless things, front to back as the game draws
 *  them. The day's fire risks are left out, so nothing is given away. */
const YARD_THINGS = [...BLOCK_SCENERY, ...BLOCK_DECOYS].sort((a, b) => a.y - b.y);

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
          {/* The yard to be searched, from above, as the game draws it with
              its harmless things, and a few rings where risks may hide: a
              picture only, so nothing in it is given away. */}
          <div className="block-yard" aria-hidden="true">
            <img src="/block/yard.png" alt="" />
            {YARD_THINGS.map((thing) => (
              <YardThing key={`${thing.sprite}-${thing.x}-${thing.y}`} sprite={thing.sprite} x={thing.x} y={thing.y} />
            ))}
            {['roof', 'deck', 'yard', 'shed'].map((spot) => (
              <span key={spot} className={`block-yard-ring ${spot}`}>?</span>
            ))}
          </div>
          {/* Drawn as the game draws them: its found count, its clock, a tap. */}
          <FactTiles
            facts={[
              {
                figure: (
                  <span className="drill-fact-bag">
                    <Glyph kind="found" size={18} line />
                    <span aria-hidden="true">{`0/${BLOCK_PICKS}`}</span>
                    <span className="visually-hidden">{copy.BLOCK_INTRO_RISKS_HIDDEN}</span>
                  </span>
                ),
                label: copy.BLOCK_INTRO_RISKS,
              },
              { figure: <span className="drill-fact-clock">{copy.DRILL_CLOCK(BLOCK_SECONDS)}</span>, label: copy.BLOCK_INTRO_TIME },
              {
                figure: (
                  <span className="drill-fact-door">
                    <Glyph kind="tap" size={18} line />
                    {copy.BLOCK_INTRO_TAP_FIGURE}
                  </span>
                ),
                label: copy.BLOCK_INTRO_TAP,
              },
            ]}
          />
          {/* What costs points: two tiles side by side under their label,
              each the points off led by its drawing, and what for under it,
              as the facts above set a figure over its words. */}
          <section className="block-costs" aria-labelledby="block-costs-label">
            <span id="block-costs-label" className="kicker section-label">{copy.BLOCK_COSTS_LABEL}</span>
            <ul className="block-cost-list">
              {copy.BLOCK_COSTS.map(({ figure, label }, index) => (
                <li key={label} className="card block-cost">
                  <strong className="figure with-glyph">
                    <Glyph kind={index === 0 ? 'close' : 'locate'} line />
                    {figure}
                  </strong>
                  <span>{label}</span>
                </li>
              ))}
            </ul>
          </section>
          {today !== null ? (
            <section className="card block-today" aria-labelledby="block-today-label">
              <span id="block-today-label" className="kicker section-label">{copy.BLOCK_TODAY_LABEL}</span>
              <p className="block-today-score">
                <span className="block-today-figure figure">{today}</span> {copy.BLOCK_OUT_OF}
              </p>
              <p className="muted with-glyph">
                <Glyph kind="clock" line />
                {copy.BLOCK_NEW_YARD}
              </p>
            </section>
          ) : null}
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
