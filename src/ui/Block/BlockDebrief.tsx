import * as copy from '../../core/copy';
import { BLOCK_ATLAS, BLOCK_SHEET } from '../../core/block-atlas';
import { scoreBlock } from '../../core/block';
import { BLOCK_PICKS, type BlockHazard } from '../../core/block-hazards';
import Glyph from '../components/Glyph';
import { ScoreRing, Sprite } from '../Drill/DrillArt';
import type { BlockOutcome } from './BlockGame';

type Props = {
  hazards: BlockHazard[];
  outcome: BlockOutcome;
  /** The highest score of every play, this one included, or null if it could not be read. */
  highest: number | null;
  onAgain: () => void;
  onDone: () => void;
};

/** The report after the three minutes: how many were found and the score,
 *  each of the day's eight risks, found or missed, with why it matters and
 *  what to do, then a card turning it to the person's own home. */
export default function BlockDebrief({ hazards, outcome, highest, onAgain, onDone }: Props) {
  const found = outcome.found.length;
  const score = scoreBlock({ found, wrongTaps: outcome.wrongTaps, hints: outcome.hints });
  return (
    <>
      <section className="debrief-hero scored">
        <ScoreRing score={score} />
        <div role="status">
          <h1>{copy.BLOCK_RESULT(found)}</h1>
          <p className="muted">
            {copy.BLOCK_OUTCOME_LINE(found === BLOCK_PICKS ? copy.BLOCK_IN_TIME : copy.BLOCK_TIME_UP, copy.BLOCK_PENALTIES(outcome.wrongTaps, outcome.hints))}
          </p>
          {highest !== null ? <p className="muted">{copy.HIGHEST_SO_FAR(highest)}</p> : null}
        </div>
      </section>

      <section className="debrief-block" aria-labelledby="block-list-heading">
        <h2 id="block-list-heading" className="debrief-label">
          {copy.BLOCK_LIST_HEADING}
        </h2>
        <ul className="list block-list">
          {hazards.map((hazard) => {
            const spotted = outcome.found.includes(hazard.id);
            return (
              <li key={hazard.id} className={`card block-row ${spotted ? 'spotted' : 'missed'}`}>
                <Sprite id={hazard.sprite} size={48} atlas={BLOCK_ATLAS} sheet={BLOCK_SHEET} className="block-sprite" />
                <div className="block-row-text">
                  <p className="block-row-head">
                    <span className="block-badge">{spotted ? copy.BLOCK_FOUND_BADGE : copy.BLOCK_MISSED_BADGE}</span>
                    <span className="block-row-name">{hazard.name}</span>
                  </p>
                  <p>{hazard.reason}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card debrief-card" aria-labelledby="block-check-home">
        <h2 id="block-check-home" className="debrief-label">
          <Glyph kind="stay" />
          {copy.BLOCK_CHECK_HOME_HEADING}
        </h2>
        <p>{copy.BLOCK_CHECK_HOME}</p>
      </section>
      <p className="muted debrief-source">{copy.BLOCK_SOURCE_LINE}</p>

      <div className="actions">
        <button type="button" className="action main-action" onClick={onDone}>
          {copy.GAME_DONE}
        </button>
        <button type="button" className="action" onClick={onAgain}>
          {copy.BLOCK_LOOK_AGAIN}
        </button>
      </div>
    </>
  );
}
