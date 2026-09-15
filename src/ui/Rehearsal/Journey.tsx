import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import * as copy from '../../core/copy';
import { conditionWithout, type RehearsalCondition } from '../../core/rehearsal-condition';
import { journeyEndingRows, unfinishedFrom } from '../../core/rehearsal-ending';
import { journeyPlaces, type JourneyPlace } from '../../core/rehearsal-journey';
import type { RehearsalRun } from '../../core/rehearsal-run';
import type { CompletePackContent, UnfinishedRehearsal } from '../../core/types';
import { getCompletePackContent, saveStartedRehearsal } from '../../data/db';
import HoldButton from '../components/HoldButton';
import { endWith, startRun } from './run-state';

type LoadContent = (id: string) => Promise<CompletePackContent | undefined>;

/** E5-US1-AC5 — the journey screen: one screen, two states.
 *
 *  The rehearsal is the journey itself. It brackets the journey and does not
 *  contain it: this screen owns the start and the end, and what she uses in
 *  between is the real BlackSky, reached by the real two-second hold, unmarked
 *  and behaving exactly as it will on the day. BlackSky.tsx is never imported
 *  here; the hold navigates to its route, the way Home does.
 *
 *  The places are named as places to practise knowing the way to, and nothing
 *  here reads as where she plans to go on the day. */

/** The official places the pack holds, read from the pack. null until read, and
 *  nothing is drawn for that wait. */
function usePlaces(packId: string, loadContent: LoadContent): JourneyPlace[] | null {
  const [places, setPlaces] = useState<JourneyPlace[] | null>(null);
  useEffect(() => {
    let live = true;
    loadContent(packId).then((content) => {
      if (live) setPlaces(content ? journeyPlaces(content) : []);
    });
    return () => {
      live = false;
    };
  }, [loadContent, packId]);
  return places;
}

/** The places, by the destinations list's name and the shared provenance line.
 *  A pack with none says so in the result's own sentence. */
function Places({ places }: { places: JourneyPlace[] }) {
  return (
    <section className="journey-places">
      <h3>{copy.GAP_PLACES}</h3>
      {places.length > 0 ? (
        <ul className="list journey-place-list">
          {places.map((place) => (
            <li key={place.id} className="card journey-place">
              <p className="journey-place-name">{place.name}</p>
              <p className="muted">{place.publisherLine}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p>{copy.GAP_MEANING_PACK_CONTENT}</p>
      )}
    </section>
  );
}

/** Before she goes. Nothing is kept yet and nothing is running, so there is no
 *  bar. One control, and it is the commitment: it starts the clock and keeps the
 *  started rehearsal, so a walk with the phone locked and the app evicted
 *  survives a cold start. If the device refuses that write, the run still goes
 *  ahead in memory, and a cold start then finds nothing to ask about: no ending
 *  is guessed either way. */
export function JourneyBefore({
  packId,
  condition,
  onGone,
  loadContent = getCompletePackContent,
  keep = saveStartedRehearsal,
}: {
  packId: string;
  condition: RehearsalCondition;
  onGone: () => void;
  loadContent?: LoadContent;
  keep?: (started: UnfinishedRehearsal) => Promise<void>;
}) {
  const places = usePlaces(packId, loadContent);
  if (places === null) return null;

  return (
    <main className="page rehearsal-journey">
      <span className="kicker">{copy.REHEARSAL_LABEL}</span>
      <h2>{copy.JOURNEY_BEFORE_HEADING}</h2>
      <p>{copy.JOURNEY_CONDITION_LINE(conditionWithout(condition))}</p>
      <p>{copy.JOURNEY_WHAT_IT_IS}</p>
      <p>{copy.JOURNEY_WHAT_IT_IS_FOR}</p>
      <p>{copy.OFFICIAL_INSTRUCTIONS_FIRST}</p>
      <Places places={places} />

      {/* Not filled: going on a practice walk fixes nothing. */}
      <div className="actions">
        <button
          type="button"
          className="action journey-go"
          onClick={() => {
            onGone();
            const run = startRun(packId, condition);
            keep(unfinishedFrom(run)).catch(() => undefined);
          }}
        >
          {copy.I_AM_GOING_NOW}
        </button>
      </div>
    </main>
  );
}

/** While she is out. Rendered inside Run, so the bar is on it. What to do, the
 *  places, the real hold into the real BlackSky, and the two endings beside it,
 *  identical controls told apart by their words alone. */
export function JourneyRunning({
  run,
  loadContent = getCompletePackContent,
}: {
  run: RehearsalRun;
  loadContent?: LoadContent;
}) {
  const navigate = useNavigate();
  const places = usePlaces(run.packId, loadContent);
  if (places === null) return null;

  return (
    <>
      <h2>{copy.JOURNEY_RUNNING_HEADING}</h2>
      <p>{copy.JOURNEY_RUNNING_DETAIL}</p>
      <Places places={places} />

      <div className="actions journey-hold">
        <HoldButton onHold={() => navigate('/blacksky')} hint={copy.HOLD_TO_ENTER}>
          <span className="blacksky-hold-label">{copy.HOLD_FOR_BLACKSKY}</span>
        </HoldButton>
      </div>

      <div className="actions journey-endings">
        {journeyEndingRows().map((row) => (
          <button key={row.ending} type="button" className="action" onClick={() => endWith(row.ending)}>
            {row.label}
          </button>
        ))}
      </div>
    </>
  );
}
