import { useEffect, useState } from 'react';
import { TICK_MS } from '../../core/constants';
import * as copy from '../../core/copy';
import { formatDistanceM } from '../../core/destination';
import { siteNameBlock } from '../../core/blacksky-dial';
import { shownPackName } from '../../core/home';
import { packIcon } from '../../core/pack';
import {
  conditionLabel,
  connectionLine,
  howToLine,
  type RehearsalCondition,
} from '../../core/rehearsal-condition';
import { journeyEndingRows, unfinishedFrom } from '../../core/rehearsal-ending';
import { journeyNotes, journeyPlaces, type JourneyPlace } from '../../core/rehearsal-journey';
import { elapsedClock, type RehearsalRun } from '../../core/rehearsal-run';
import type { CompletePackContent, PackIcon, UnfinishedRehearsal } from '../../core/types';
import { getCompletePackWithoutFiles, saveStartedRehearsal } from '../../data/db';
import Glyph from '../components/Glyph';
import NoteText from '../components/NoteText';
import Section from '../components/Section';
import FactTiles from '../Games/FactTiles';
import { focusMain } from '../components/focusMain';
import { useOnline } from '../components/useOnline';
import Head from './Head';
import { endWith, startRun, walkedSoFar } from './run-state';

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
type Journey = {
  packName: string;
  packIcon: PackIcon;
  places: JourneyPlace[];
  notes: { id: string; text: string }[];
};
const NONE: Journey = { packName: '', packIcon: 'place', places: [], notes: [] };

function useJourney(packId: string, loadContent: LoadContent): Journey | null {
  const [journey, setJourney] = useState<Journey | null>(null);
  useEffect(() => {
    let live = true;
    loadContent(packId).then((content) => {
      if (live) {
        setJourney(
          content
            ? {
                packName: shownPackName(content.pack.name),
                packIcon: packIcon(content.pack),
                places: journeyPlaces(content),
                notes: journeyNotes(content),
              }
            : NONE,
        );
      }
    }, () => {
      // A pack that cannot be read lists no places, as a pack with none does, so
      // the running rehearsal can still be given its ending.
      if (live) setJourney(NONE);
    });
    return () => {
      live = false;
    };
  }, [loadContent, packId]);
  return journey;
}

/** The places, under a ringed head as on the pack page, each set as there:
 *  the site in bold, the town and where it is, then the saved date. The kind
 *  is said once, over the list. A pack with none says so in the result's own
 *  sentence. */
function Places({ places }: { places: JourneyPlace[] }) {
  return (
    <Section kind="place" title={copy.JOURNEY_PLACES_LABEL} heading className="journey-places">
      {places.length > 0 ? (
        <>
          <p className="muted place-note">{copy.SAVED_PLACES_KIND(places.length)}</p>
          <ul className="list journey-place-list">
            {places.map((place) => {
              const { site, line } = siteNameBlock(place.name);
              return (
                <li key={place.id} className="card journey-place">
                  <p className="nearby-place-name">{site}</p>
                  {/* The town and where it is as one grey line, then the
                      saved date as the card's foot, as a pack card ends. */}
                  {line || place.where ? <p className="muted">{[line, place.where].filter(Boolean).join(', ')}</p> : null}
                  <p className="muted figure saved-place-footer with-glyph">
                    <Glyph kind="saved" line />
                    {place.savedLine}
                  </p>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="muted place-note">{copy.GAP_MEANING_PACK_CONTENT}</p>
      )}
    </Section>
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
  loadContent = getCompletePackWithoutFiles,
  keep = saveStartedRehearsal,
}: {
  packId: string;
  condition: RehearsalCondition;
  onGone: () => void;
  loadContent?: LoadContent;
  keep?: (started: UnfinishedRehearsal) => Promise<void>;
}) {
  const journey = useJourney(packId, loadContent);
  // Drawn only once the pack is read, after the choice that led here has gone.
  const ready = journey !== null;
  useEffect(() => {
    if (ready) focusMain();
  }, [ready]);
  if (journey === null) return null;

  return (
    <main className="page rehearsal-journey">
      {/* The option chosen is the title, as on the choice and the bar, with
          the pack under it in its own drawing and teal. */}
      <Head title={conditionLabel(condition)} pack={{ name: journey.packName, icon: journey.packIcon }} />
      {/* The official instruction, in the red line it wears everywhere. */}
      <p className="official-channels emergency-line">
        <Glyph kind="calls" line />
        <span>{copy.OFFICIAL_INSTRUCTIONS_FIRST}</span>
      </p>

      {/* What to do, in order, as rows of one card, each led by its drawing.
          Left open: the first step is what makes the rehearsal real. No
          numbers: nothing on this screen is counted. E5-US6: the first step
          makes the condition real on the phone, not pretended. */}
      <Section kind="go" title={copy.BEFORE_YOU_GO} heading>
        <ol className="card journey-steps">
          {([
            { glyph: condition === 'no-data' ? 'offline' : 'locate', title: copy.MAKE_IT_REAL, detail: howToLine(condition) },
            { glyph: 'moon', title: copy.STEP_GO_WITH_BLACKSKY, detail: copy.STEP_GO_WITH_BLACKSKY_DETAIL },
            { glyph: 'found', title: copy.STEP_SAY_HOW_IT_ENDED, detail: copy.STEP_SAY_HOW_IT_ENDED_DETAIL },
          ] as const).map((step) => (
            <li key={step.title} className="journey-step">
              <Glyph kind={step.glyph} />
              <div>
                <p className="journey-step-title">{step.title}</p>
                <p className="muted">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>
      <Places places={journey.places} />

      {/* The one thing to do on this screen, filled as every screen's start is. */}
      <div className="actions">
        <button
          type="button"
          className="action main-action journey-go with-glyph"
          onClick={() => {
            onGone();
            const run = startRun(packId, condition);
            keep(unfinishedFrom(run)).catch(() => undefined);
          }}
        >
          <Glyph kind="go" line />
          {copy.I_AM_GOING_NOW}
        </button>
      </div>
    </main>
  );
}

/** The time since she went and the distance her phone has counted, as two
 *  figure tiles at the top of the running screen, redrawn every second. Only
 *  these redraw. They are not announced: a screen reader would hear them
 *  every second. */
function TrackTiles({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);
  const walked = walkedSoFar();
  return (
    <div aria-live="off">
      <FactTiles
        className="journey-track"
        facts={[
          { figure: elapsedClock(now - startedAt), label: copy.TRACK_ELAPSED },
          walked === null
            ? { figure: '–', label: copy.TRACK_NOT_COUNTED }
            : { figure: formatDistanceM(walked), label: copy.TRACK_WALKED },
        ]}
      />
    </div>
  );
}

/** While she is out. Rendered inside Run, so the bar is on it. What to do, the
 *  places, the real hold into the real BlackSky, and the two endings beside it,
 *  identical controls told apart by their words alone. */
export function JourneyRunning({
  run,
  loadContent = getCompletePackWithoutFiles,
}: {
  run: RehearsalRun;
  loadContent?: LoadContent;
}) {
  const journey = useJourney(run.packId, loadContent);
  // E5-US6 — what the browser reports, stated and never acted on.
  const online = useOnline();
  const connection = connectionLine(run.condition, online);
  if (journey === null) return null;

  return (
    <>
      <Head title={copy.JOURNEY_RUNNING_HEADING} />
      <TrackTiles startedAt={run.startedAt} />
      {/* E5-US6 — what the browser reports: amber while the phone is still
          online, a calm line once it is offline as on the day. */}
      {connection ? (
        <p
          className={`official-channels with-glyph journey-connection${online ? ' caution-line' : ''}`}
          role="status"
        >
          <Glyph kind={online ? 'online' : 'offline'} line />
          <span>{connection}</span>
        </p>
      ) : null}

      {/* BlackSky is reached by its own real hold in the bottom bar, as on the
          day, so this screen points to it in an amber note rather than
          repeating it. Its name in bold, as the bar names it. */}
      <p className="journey-blacksky with-glyph">
        <Glyph kind="moon" line />
        <span>
          {copy.HOLD_BLACKSKY_NOTICE_LEAD}
          <b>{copy.BLACKSKY_TITLE}</b>
          {copy.HOLD_BLACKSKY_NOTICE_REST}
        </span>
      </p>

      <Places places={journey.places} />

      {/* E5-US7 — her own notes, read here as BlackSky shows them on the day.
          A paragraph each, not list items: the places list above is the one
          list on this screen, and a screen reader's count of it stays true. */}
      <Section kind="note" title={copy.NOTES} heading className="journey-notes">
        {journey.notes.length > 0 ? (
          journey.notes.map((note) => (
            <div key={note.id} className="card journey-note">
              <NoteText text={note.text} />
            </div>
          ))
        ) : (
          <p className="muted place-note">{copy.NO_NOTES_ON_JOURNEY}</p>
        )}
      </Section>

      {/* The endings sit in their own card, apart from the hold above and the
          Leave control below: they finish the rehearsal, the other two do not.
          Inside it the two stay identical, each led by a drawing of the same
          size and weight: the place she reached, or the home she stayed at. */}
      <section className="card journey-endings">
        <span className="kicker">{copy.JOURNEY_ENDINGS_LABEL}</span>
        <div className="actions">
          {journeyEndingRows().map((row) => (
            <button key={row.ending} type="button" className="action with-glyph" onClick={() => endWith(row.ending)}>
              <Glyph kind={row.ending === 'walked' ? 'place' : 'home'} line />
              {row.label}
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
