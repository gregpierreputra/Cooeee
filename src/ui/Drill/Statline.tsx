import { useEffect, useRef, useState } from 'react';
import * as copy from '../../core/copy';
import { ATLAS } from '../../core/drill-atlas';
import { TILE } from '../../core/drill-layout';
import { CLASSIC, type DrillRules } from '../../core/drill-twists';
import Glyph from '../components/Glyph';
import FactTiles from '../Games/FactTiles';
import PastDrills from './PastDrills';
import { HOUSE_HEIGHT, HOUSE_WIDTH, drawSnapshot, loadArt } from './render';

/** The rooms whose first thing to pack is ringed in the picture, spread
 *  across the house so the rings never crowd one another. */
const RINGED_ROOMS = ['kitchen', 'study', 'main bedroom'];
/** The front door's middle, in tiles. */
const DOOR_AT = { x: 24.5, y: 1.6 };

/** The house from above as the game draws it, with the things to pack and
 *  the figure at the start, and amber rings round the door and a few of the
 *  things, marked as the tiles below mark them. A picture only: the tiles say
 *  what it shows. Drawn from the art kept with the app, and left out if that
 *  cannot load. */
function HouseSnapshot({ rules }: { rules: DrillRules }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawn, setDrawn] = useState(true);
  useEffect(() => {
    let live = true;
    loadArt()
      .then((art) => live && canvasRef.current && drawSnapshot(canvasRef.current, art, rules, 2))
      .catch(() => live && setDrawn(false));
    return () => {
      live = false;
    };
  }, [rules]);
  if (!drawn) return null;
  const share = (part: number, whole: number) => `${(100 * part * TILE) / whole}%`;
  const ringed = RINGED_ROOMS.map((room) => rules.items.find((item) => item.room === room)).filter((item) => item !== undefined);
  return (
    <div className="drill-house-snapshot" aria-hidden="true">
      <canvas ref={canvasRef} width={HOUSE_WIDTH} height={HOUSE_HEIGHT} />
      <span className="drill-snapshot-ring" style={{ left: share(DOOR_AT.x, HOUSE_WIDTH), top: share(DOOR_AT.y, HOUSE_HEIGHT) }}>
        <Glyph kind="door" size={16} line />
      </span>
      {ringed.map((item) => (
        <span
          key={item.id}
          className="drill-snapshot-ring"
          style={{ left: share(item.x, HOUSE_WIDTH), top: share(item.y - ATLAS[item.id][3] / TILE / 2, HOUSE_HEIGHT) }}
        >
          <Glyph kind="bag" size={16} line />
        </span>
      ))}
    </div>
  );
}

/** E9-US1-AC1 — one quiet screen before the film: what the drill asks in
 *  three tiles drawn as the game draws them (its clock, its bag count and the
 *  door), this drill's twist, and Start. Back at the top is the way out, as on
 *  the other games. How to steer and grab is
 *  taught by the guide over the real controls, so it is not said here. The
 *  tap on Start is also what lets the phone play sound. */
export default function Statline({ rules = CLASSIC, onStart }: { rules?: DrillRules; onStart: () => void }) {
  const classic = rules === CLASSIC;
  return (
    <>
      <div className="hero">
        <h1>{classic ? copy.DRILL_INTRO_HEADING : copy.DRILL_INTRO_HEADING_FOR(rules.seconds)}</h1>
      </div>
      <HouseSnapshot rules={rules} />
      <FactTiles
        facts={[
          { figure: <span className="drill-fact-clock">{copy.DRILL_CLOCK(rules.seconds)}</span>, label: copy.DRILL_INTRO_TIME },
          {
            // Drawn as the game's bag count, read as the number to pack.
            figure: (
              <span className="drill-fact-bag">
                <Glyph kind="bag" size={18} line />
                <span aria-hidden="true">{`0/${rules.bagLimit}`}</span>
                <span className="visually-hidden">{rules.bagLimit}</span>
              </span>
            ),
            label: copy.DRILL_INTRO_BAG,
          },
          {
            figure: (
              <span className="drill-fact-door">
                <Glyph kind="door" size={18} line />
                <span className="visually-hidden">{copy.DRILL_INTRO_DOOR_HIDDEN}</span>
              </span>
            ),
            label: copy.DRILL_INTRO_DOOR,
          },
        ]}
      />
      {classic ? null : (
        <section className="card drill-twist" aria-labelledby="drill-twist-label">
          <p id="drill-twist-label" className="kicker">{copy.DRILL_TWIST_LABEL}</p>
          <p className="drill-twist-name">{rules.name}</p>
          <p>{rules.rule}</p>
        </section>
      )}
      <div className="actions">
        <button type="button" className="action main-action" onClick={onStart}>
          {copy.START_DRILL}
        </button>
      </div>
      {/* Every past drill, under Start, as the drill belongs to no pack. */}
      <PastDrills />
    </>
  );
}
