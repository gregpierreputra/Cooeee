import { useState } from 'react';
import * as copy from '../../core/copy';
import { BAG_LIMIT, type DrillItem } from '../../core/drill-items';
import { debriefRows, kindOf, leftBehind, scoreBreakdown, scoreDrill } from '../../core/drill-score';
import Glyph from '../components/Glyph';
import { ATLAS, SHEET } from '../../core/drill-atlas';
import type { DrillOutcome } from './Game';

const TILE_SIZE = 40; // css pixels a thing's picture fits inside

/** One thing's own picture from the game, drawn from the sprite sheet. */
function Sprite({ id }: { id: string }) {
  const [x, y, w, h] = ATLAS[id];
  const scale = Math.min(TILE_SIZE / w, TILE_SIZE / h, 3);
  return (
    <span
      className="debrief-sprite"
      aria-hidden="true"
      style={{
        width: w * scale,
        height: h * scale,
        backgroundSize: `${SHEET[0] * scale}px ${SHEET[1] * scale}px`,
        backgroundPosition: `${-x * scale}px ${-y * scale}px`,
      }}
    />
  );
}

/** The score as a ring filled to the score, green, amber or red. */
function ScoreRing({ score }: { score: number }) {
  const band = score >= 80 ? 'good' : score >= 50 ? 'fair' : 'poor';
  const length = 2 * Math.PI * 52;
  return (
    <svg className={`debrief-ring ${band}`} viewBox="0 0 120 120" role="img" aria-label={copy.DEBRIEF_SCORE(score)}>
      <circle className="track" cx="60" cy="60" r="52" />
      {score > 0 ? <circle className="fill" cx="60" cy="60" r="52" strokeDasharray={`${(length * score) / 100} ${length}`} /> : null}
      <text x="60" y="68" textAnchor="middle">{score}</text>
    </svg>
  );
}

type Props = {
  outcome: DrillOutcome;
  /** The highest score of this pack's drills that reached the door, this one included. */
  highest: number | null;
  onAgain: () => void;
  onDone: () => void;
};

/** E7-US3 — the report after the minute, read at a glance: a ring for the
 *  score, the bag as pictures edged by what each did, a bar of how the points
 *  add up, and the essentials left behind. Each reason is one tap away rather
 *  than printed. Away from the door there is no number anywhere. */
export default function Debrief({ outcome, highest, onAgain, onDone }: Props) {
  const [chosen, setChosen] = useState<DrillItem | null>(null);
  const scored = outcome.reachedDoor;
  const score = scoreDrill(outcome.packed);
  const packed = debriefRows(outcome.packed).map((row) => row.item);
  const left = leftBehind(outcome.packed);
  const groups = scoreBreakdown(outcome.packed);
  const gained = groups.filter((group) => group.points > 0).reduce((sum, group) => sum + group.points, 0);
  const lost = -groups.filter((group) => group.points < 0).reduce((sum, group) => sum + group.points, 0);

  const tile = (item: DrillItem, faded = false) => {
    const points = copy.SIGNED_POINTS(item.weight);
    return (
      <li key={item.id}>
        <button
          type="button"
          className={`debrief-tile kind-${kindOf(item.weight)}${faded ? ' faded' : ''}`}
          aria-label={scored && !faded ? copy.TILE_LABEL(item.name, points) : item.name}
          aria-pressed={chosen?.id === item.id}
          onClick={() => setChosen(chosen?.id === item.id ? null : item)}
        >
          <Sprite id={item.id} />
          {scored && !faded ? <span className="debrief-points figure">{points}</span> : null}
        </button>
      </li>
    );
  };

  return (
    <>
      <section className={`debrief-hero ${scored ? 'scored' : 'over'}`}>
        {scored ? (
          <ScoreRing score={score} />
        ) : (
          <span className="debrief-over-mark">
            <Glyph kind="door" />
          </span>
        )}
        {/* A live region round the heading, so the outcome is read out when the
            report opens, while the heading stays a heading. */}
        <div role="status">
          <h1>{scored ? copy.VERDICT(score) : copy.OVER_HEADING}</h1>
          {scored ? (
            highest !== null ? <p className="muted">{copy.HIGHEST_SO_FAR(highest)}</p> : null
          ) : (
            <p className="muted">{copy.OVER_DETAIL}</p>
          )}
        </div>
      </section>

      <section className="debrief-block" aria-labelledby="debrief-bag">
        <h2 id="debrief-bag" className="debrief-label">
          <Glyph kind="bag" />
          {copy.IN_YOUR_BAG}
          <span className="figure">{copy.OF_LIMIT(packed.length, BAG_LIMIT)}</span>
        </h2>
        <ul className="debrief-tiles">
          {packed.map((item) => tile(item))}
          {Array.from({ length: BAG_LIMIT - packed.length }, (_, i) => (
            <li key={`empty-${i}`} className="debrief-empty" aria-hidden="true" />
          ))}
        </ul>
        {scored ? (
          <div className="debrief-bar" aria-hidden="true">
            <span className="gained" style={{ width: `${Math.min(100, gained)}%` }} />
            <span className="lost" style={{ width: `${Math.min(100, lost)}%` }} />
          </div>
        ) : null}
        <ul className="debrief-key" aria-hidden="true">
          {(['essential', 'listed', 'neutral', 'bulky'] as const).map((kind) => (
            <li key={kind} className={`kind-${kind}`}>
              {copy.KIND_LABELS[kind]}
            </li>
          ))}
        </ul>
      </section>

      {left.length > 0 ? (
        <section className="debrief-block" aria-labelledby="debrief-left">
          <h2 id="debrief-left" className="debrief-label">
            <Glyph kind="stay" />
            {copy.LEFT_BEHIND}
          </h2>
          <ul className="debrief-tiles">{left.map((item) => tile(item, true))}</ul>
        </section>
      ) : null}

      {/* The one reason in view: the thing last tapped, or the hint to tap. */}
      <p className="debrief-why" aria-live="polite">
        {chosen ? (
          <>
            <b>{chosen.name}</b> {chosen.why}
          </>
        ) : (
          copy.TAP_FOR_WHY
        )}
      </p>
      <p className="muted debrief-source">{copy.DRILL_SOURCE}</p>

      <div className="actions">
        <button type="button" className="action main-action" onClick={onDone}>
          {copy.GO_ON_TO_REHEARSAL}
        </button>
        <button type="button" className="action" onClick={onAgain}>
          {scored ? copy.PLAY_AGAIN : copy.TRY_AGAIN}
        </button>
      </div>
    </>
  );
}
