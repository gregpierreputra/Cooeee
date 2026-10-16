import { useEffect, useRef, useState } from 'react';
import * as copy from '../../core/copy';
import { drillRows, type DrillRow } from '../../core/drill-history';
import type { Drill } from '../../core/types';
import { clearDrills, listAllDrills } from '../../data/db';
import Glyph from '../components/Glyph';
import Section from '../components/Section';
import ShortList from '../components/ShortList';
import { DrillWhy, ScoreRing, Sprite } from './DrillArt';

/** E9 — every drill on the phone, newest first, on the drill's own screen, as
 *  a drill belongs to no pack. Under the list, every result can be cleared,
 *  after one question, as a pack or a note is deleted. */
export default function PastDrills({
  load = listAllDrills,
  clear = clearDrills,
}: {
  load?: () => Promise<Drill[]>;
  clear?: () => Promise<void>;
}) {
  const [drills, setDrills] = useState<DrillRow[]>([]);
  const [asking, setAsking] = useState(false);
  const keepRef = useRef<HTMLButtonElement>(null);
  const emptyRef = useRef<HTMLDivElement>(null);
  const cleared = useRef(false);

  useEffect(() => {
    let live = true;
    load().then(
      (rows) => {
        if (live) setDrills(drillRows(rows));
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [load]);

  // The question takes focus on the choice that changes nothing; once cleared,
  // focus lands on the empty list rather than on nothing.
  useEffect(() => {
    if (asking) keepRef.current?.focus();
  }, [asking]);
  useEffect(() => {
    if (cleared.current && drills.length === 0) emptyRef.current?.focus();
  }, [drills]);

  async function clearAll() {
    try {
      await clear();
      cleared.current = true;
      setDrills([]);
    } finally {
      setAsking(false);
    }
  }

  return (
    <Section kind="rehearse" title={copy.DRILLS} count={drills.length}>
      {drills.length === 0 ? (
        <div ref={emptyRef} tabIndex={-1} className="empty-state">
          <p>{copy.NOT_YET_DRILLED}</p>
        </div>
      ) : (
        <>
          <ShortList
            items={drills}
            className="list history-list"
            render={(row) => (
              // Set as a rehearsal is: the twist as the teal label, as a
              // rehearsal's condition is, with the date, the outcome in bold,
              // then the bag.
              <li key={row.id} className="card history-row practice-card">
                <div className="practice-card-head">
                  <p className="place-kind">{row.label}</p>
                  <p className="muted figure practice-date">{row.date}</p>
                </div>
                {/* The score as the debrief's ring with its verdict; away from
                    the door, its door mark and no number, as on the debrief. */}
                <div className="drill-outcome">
                  {row.score !== null ? (
                    <ScoreRing score={row.score} />
                  ) : (
                    <span className="debrief-over-mark">
                      <Glyph kind="door" />
                    </span>
                  )}
                  <div>
                    <p className="practice-outcome">{row.score !== null ? copy.DRILL_ROW_DOOR : copy.DRILL_ROW_AWAY}</p>
                    {row.verdict ? <p className="muted">{row.verdict}</p> : null}
                  </div>
                </div>
                <DrillBag row={row} />
              </li>
            )}
          />
          {asking ? (
            <div className="card past-drills-confirm">
              <p>{copy.CLEAR_DRILLS_QUESTION}</p>
              <div className="card-confirm-actions">
                <button ref={keepRef} type="button" className="card-confirm-no" onClick={() => setAsking(false)}>
                  {copy.KEEP_THEM}
                </button>
                <button type="button" className="card-confirm-yes with-glyph" onClick={() => void clearAll()}>
                  <Glyph kind="trash" line />
                  {copy.CLEAR_DRILLS_YES}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="note-delete with-glyph" onClick={() => setAsking(true)}>
              <Glyph kind="trash" line />
              {copy.CLEAR_DRILLS}
            </button>
          )}
        </>
      )}
    </Section>
  );
}

/** What one drill's bag held: the essentials packed, the bag as the game's
 *  own pictures edged by what each did, with a slot for each unused space,
 *  then the essentials left in the house and the things that cost points by
 *  name, as the debrief names them, so nothing rests on colour alone. A tap
 *  on a picture says what it is and why, as on the debrief; never a hover. */
function DrillBag({ row }: { row: DrillRow }) {
  const [chosen, setChosen] = useState<DrillRow['bag'][number] | null>(null);
  return (
    <div className="practice-found">
      <p className="with-glyph practice-found-line">
        <Glyph kind="bag" line />
        {row.essentials}
      </p>
      <ul className="debrief-tiles drill-card-tiles" aria-label={copy.IN_YOUR_BAG}>
        {row.bag.map((item, index) => (
          <li key={`${item.id}-${index}`}>
            <button
              type="button"
              className={`debrief-tile kind-${item.kind}`}
              aria-label={item.name}
              aria-pressed={chosen?.id === item.id}
              onClick={() => setChosen(chosen?.id === item.id ? null : item)}
            >
              <Sprite id={item.id} size={28} />
            </button>
          </li>
        ))}
        {Array.from({ length: Math.max(0, row.bagLimit - row.bag.length) }, (_, index) => (
          <li key={`empty-${index}`} className="debrief-empty" aria-hidden="true" />
        ))}
      </ul>
      {/* The reason as a speech bubble pointing up at the tapped picture's
          column; until a tap, only the small hint. */}
      <div aria-live="polite">
        {chosen ? (
          <DrillWhy key={chosen.id} {...chosen} index={row.bag.indexOf(chosen)} />
        ) : row.bag.length > 0 ? (
          <p className="muted place-note">{copy.TAP_FOR_WHY}</p>
        ) : null}
      </div>
      {/* Labelled rows, as on the debrief: a picture, the label in bold, the
          names in grey. */}
      {row.leftBehind.length > 0 ? (
        <p className="with-glyph place-note drill-row">
          <Glyph kind="stay" line />
          <span>
            <b>{copy.LEFT_BEHIND}</b> <span className="muted">{row.leftBehind.join(', ')}</span>
          </span>
        </p>
      ) : null}
      {row.costYou.length > 0 ? (
        <p className="with-glyph place-note drill-row">
          <Glyph kind="caution" line />
          <span>
            <b>{copy.KIND_LABELS.bulky}</b> <span className="muted">{row.costYou.join(', ')}</span>
          </span>
        </p>
      ) : null}
    </div>
  );
}
