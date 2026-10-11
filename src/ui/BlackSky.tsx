import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { useNavigate } from 'react-router';
import {
  deriveState,
  estimateFix,
  positionFrom,
  type Confidence,
  type Mark as PositionMark,
  type Placed,
  type Screen,
} from '../core/blacksky';
import {
  dialCentre,
  dialModel,
  positionTrust,
  relativeBearing,
  siteNameBlock,
  type DialLabel,
  type DialModel,
  type PositionTrust,
} from '../core/blacksky-dial';
import {
  latchBlackSky,
  readChosenPack,
  rememberChosenPack,
  unlatchBlackSky,
} from '../core/blacksky-latch';
import {
  firstUtterance,
  isMoving,
  nextUtterance,
  shouldStayAwake,
  sideOf,
  type VoiceRecord,
  type VoiceState,
} from '../core/blacksky-voice';
import {
  FIX_COARSE_M,
  FIX_PREFER_PRECISE_MS,
  FIX_PUBLISH_M,
  DIAL_ARROW_SCALE,
  FIX_STALE_MS,
  HOLD_LEAVE_VIBRATE_MS,
  NAV_HOLD_HINT_MS,
  ROADS_LABEL_PX,
  ROADS_PAN_RETURN_MS,
  ROADS_PAN_TAP_PX,
  TICK_MS,
  VOICE_CHECK_MS,
  WATCH_RESTART_MS,
} from '../core/constants';
import * as copy from '../core/copy';
import { cardinalPoint, distanceM, magneticDeclinationDeg } from '../core/geo';
import { newestPlaceFirst, shownPackName, titleCase } from '../core/home';
import { packIcon } from '../core/pack';
import { isPanned, NO_PAN, panOffset, panShouldReturn, type PanOffset } from '../core/pan';
import { steadyReadout, type ShownReadout } from '../core/readout';
import {
  decodeRoads,
  drawRoads,
  redrawDistanceM,
  viewRadiusM,
  type MapView,
  type Obstacle,
  type RoadMap,
} from '../core/roads';
import type { Destination, Fix, LatLon, NspSnapshot, Pack, PackWithPlaces } from '../core/types';
import { localFlagStore } from '../data/acknowledgement';
import { getNspSnapshot, listCompletePacksWithPlaces } from '../data/db';
import Glyph from './components/Glyph';
import NoteText from './components/NoteText';
import StateCard from './components/StateCard';
import { readRoadsFile } from '../data/roads';
import BlackSkyDial, {
  DIAL_UNITS,
  LETTER_R,
  MAP_R,
  RING_DROP_UNITS,
  RING_R,
  type DialMapLayer,
} from './components/BlackSkyDial';
import HoldButton from './components/HoldButton';
import HoldSweep from './components/HoldSweep';
import Mark from './components/Mark';
import { currentRun } from './Rehearsal/run-state';
import { useCompass } from './components/useCompass';
import { useRevealedPanel } from './components/useRevealedPanel';
import { useVoice } from './components/useVoice';
import { useWakeLock } from './components/useWakeLock';

type BlackSkyProps = {
  loadPacks?: () => Promise<PackWithPlaces[]>;
  loadSites?: () => Promise<NspSnapshot | undefined>;
  /** BS_Enhancement-AC5: the roads file's bytes, or undefined when the phone
   *  does not hold it. Read from the precache only, never the network. */
  loadRoads?: () => Promise<ArrayBuffer | undefined>;
};

/** The one view the screen draws. From the development team's review of 28
 *  Sep: "Near me" only, no switch. Core keeps both views and their rules
 *  (tested), so "Whole way" can come back for a user test; the screen never
 *  draws it. The locality names are drawn in "Whole way" only, so they are
 *  not loaded either. */
const MAP_VIEW: MapView = 'near';

// The roads file is decoded once per loader, however often BlackSky opens: the
// decoded lines do not change while the app runs.
const decodedRoads = new WeakMap<() => Promise<ArrayBuffer | undefined>, Promise<RoadMap | null>>();

function holdRoads(load: () => Promise<ArrayBuffer | undefined>): Promise<RoadMap | null> {
  let held = decodedRoads.get(load);
  if (!held) {
    held = load()
      .then((bytes) => {
        if (!bytes) return null;
        // Measured so the time can be read on a real phone in the browser's
        // performance panel, not guessed.
        const start = performance.now();
        const map = decodeRoads(bytes);
        performance.measure('cooeee:roads-decode', { start, end: performance.now() });
        return map;
      })
      // A file that cannot be read or is not whole is the same as no file: the
      // plain dial, and nothing else on the screen changes.
      .catch(() => null)
      // Only a decoded map is kept. A miss, say before the first download has
      // finished, is tried again the next time BlackSky opens.
      .then((map) => {
        if (!map) decodedRoads.delete(load);
        return map;
      });
    decodedRoads.set(load, held);
  }
  return held;
}

/** The BlackSky screen. Every word on it comes from the local pack store and the
 *  locally stored CFA site list; the ONLY other inputs are the device's own
 *  position and orientation sensors, and those readings never leave the device.
 *  ESLint bans fetch and every network module in this file, so the zero-network
 *  guarantee is enforced, not promised. */
export default function BlackSky({
  loadPacks = listCompletePacksWithPlaces,
  loadSites = getNspSnapshot,
  loadRoads = readRoadsFile,
}: BlackSkyProps) {
  const [packs, setPacks] = useState<PackWithPlaces[] | null>(null);
  const [sites, setSites] = useState<NspSnapshot | null>(null);
  const [fix, setFix] = useState<Fix | null>(null);
  const [permission, setPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [mark, setMark] = useState<PositionMark | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // Which pack to load when several are saved: chosen at the top of the screen
  // and remembered, so a reload or relaunch opens on the same one.
  const [chosenId, setChosenId] = useState(() => readChosenPack(localFlagStore()));
  const choosePack = (id: string) => {
    setChosenId(id);
    rememberChosenPack(localFlagStore(), id);
  };
  // BS_Enhancement-AC1: the place the person picked with Show. Held in memory
  // only, so it lasts exactly as long as this visit to BlackSky and needs no
  // storage key; the main place never changes by itself while it is set.
  const [shownId, setShownId] = useState<string | null>(null);
  const navigate = useNavigate();
  // Said at the top once the phone's Back has been pressed, which does not
  // leave. A reopening says nothing: the dark screen speaks for itself.
  const [notice, setNotice] = useState<string | null>(null);

  // US1-AC4: with no fix, a marked position stands in for one. estimateFix
  // returns null once its growing uncertainty passes the confidence threshold,
  // which drops the screen back to ACQUIRING — the AC2 reference state. While
  // an estimate is active it substitutes the fix entirely, so the GPS
  // permission state no longer decides.
  const estimate = mark ? estimateFix(mark, now) : null;
  const here = estimate ?? fix;
  // The sensors give magnetic north; the bearings are true. The correction
  // depends on where the phone is, which the fix supplies.
  const compass = useCompass(here ? magneticDeclinationDeg(here) : 0);
  const { setMovement } = compass;

  // US3-AC2, the power rule: GPS samples land in this ref (no render). A sample
  // FIX_PUBLISH_M or more from the position on screen is shown at once, so the
  // distance follows a person who is moving; anything smaller is sensor noise
  // and waits for the TICK_MS interval below (one second), so a phone held
  // still renders once per tick. The dial turns with the phone by CSS, not by a render.
  const latestFix = useRef<Fix | null>(null);
  // When a sample last said the person was moving, for the wake lock's hold.
  const lastMovingAt = useRef<number | null>(null);

  // BS_Enhancement-AC5: the roads, loaded lazily once BlackSky is open, so the
  // file costs nothing on any other screen.
  const [roads, setRoads] = useState<RoadMap | null>(null);
  useEffect(() => {
    let live = true;
    void holdRoads(loadRoads).then((map) => {
      if (live) setRoads(map);
    });
    return () => {
      live = false;
    };
  }, [loadRoads]);

  useEffect(() => {
    let live = true;
    loadPacks().then(
      (rows) => {
        if (live) setPacks(rows);
      },
      // A store that cannot be read must not leave a blank screen with no way
      // out: the screen renders as if nothing were saved, Leave included.
      () => {
        if (live) setPacks([]);
      },
    );
    loadSites().then(
      (snapshot) => {
        if (live && snapshot) setSites(snapshot);
      },
      () => undefined, // with no list, the nearest-places pointer is simply absent
    );
    return () => {
      live = false;
    };
  }, [loadPacks, loadSites]);

  // The position watch. Browsers stop delivering positions while the screen is
  // locked or the app is in the background, and some phones never resume a
  // watch they paused: that is how the distance figure froze during walking
  // tests. So the watch is dropped when the screen is hidden (no GPS for a page
  // nobody is looking at) and started fresh the moment it returns.
  // BS_Enhancement-AC4: on that return the clock and the newest position are
  // published at once, not at the next tick, so the person sees figures that
  // are right, or the GPS signal lost bar, before anything else. The wake lock
  // that used to live here is now useWakeLock below, held only while moving or
  // while voice is on.
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setPermission('denied');
      return;
    }
    let watch: number | null = null;
    let watchdog: ReturnType<typeof setInterval> | undefined;
    let heardAt = 0; // when the watch last delivered a position

    const onPosition = (position: GeolocationPosition) => {
      heardAt = Date.now();
      const { heading, speed } = position.coords;
      const next: Fix = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        accuracyM: Math.round(position.coords.accuracy),
        // Receipt time, NOT position.timestamp: staleness is measured against
        // Date.now(), and some mobile engines report GPS timestamps from a
        // different clock. Mixing clock domains would break the 30 s rule.
        at: heardAt,
        // BS_Enhancement-AC2: the direction of movement and the speed, when the
        // browser gives them. A phone standing still reports null or NaN.
        ...(typeof heading === 'number' && Number.isFinite(heading) ? { headingDeg: heading } : {}),
        ...(typeof speed === 'number' && Number.isFinite(speed) ? { speedMps: speed } : {}),
      };
      const last = latestFix.current;
      if (
        last &&
        heardAt - last.at < FIX_PREFER_PRECISE_MS &&
        next.accuracyM > Math.max(FIX_COARSE_M, 2 * last.accuracyM)
      )
        return; // a coarse guess never replaces a fresh precise fix
      if (isMoving(next.speedMps)) lastMovingAt.current = heardAt;
      latestFix.current = next;
      // Straight to the compass hook, every sample, without a render: above
      // walking speed this is what turns the dial.
      setMovement(next.headingDeg, next.speedMps);
      setPermission('granted');
      setMark(null); // a real fix always beats a marked-position estimate
      // The first fix, and every real move after it, renders immediately.
      setFix((shown) => (!shown || distanceM(shown, next) >= FIX_PUBLISH_M ? next : shown));
    };
    // A refusal before any position means there is nothing to point from. A
    // refusal once positions have arrived is taken as the signal going quiet:
    // some phones report one part way through a watch that was working (phone
    // test, 11 Oct), and dropping the dial then would throw away a position the
    // person can still use. That position is kept, ages, and the bar says the
    // signal is lost; the watchdog below keeps asking, so the dial recovers.
    const onError = (error: GeolocationPositionError) => {
      if (error.code === error.PERMISSION_DENIED && latestFix.current === null) setPermission('denied');
    };

    // The most accurate continuous watch the device offers: high accuracy on,
    // and no cached position accepted in place of a fresh sensor read.
    const startWatch = () => {
      heardAt = Date.now();
      watch = navigator.geolocation.watchPosition(onPosition, onError, {
        enableHighAccuracy: true,
        maximumAge: 0,
      });
    };
    const wake = () => {
      if (watch !== null) return;
      startWatch();
      // A watch that has gone quiet reports no error, so it is started again.
      // Checked three times per limit, so the restart comes well before the
      // fix is called old.
      watchdog = setInterval(() => {
        if (watch === null || Date.now() - heardAt < WATCH_RESTART_MS) return;
        navigator.geolocation.clearWatch(watch);
        startWatch();
      }, WATCH_RESTART_MS / 3);
    };
    const sleep = () => {
      clearInterval(watchdog);
      if (watch !== null) navigator.geolocation.clearWatch(watch);
      watch = null;
    };
    const onVisibility = () => {
      if (document.hidden) {
        sleep();
        return;
      }
      setNow(Date.now());
      setFix(latestFix.current);
      wake();
    };

    document.addEventListener('visibilitychange', onVisibility);
    wake();
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      sleep();
    };
  }, [setMovement]);

  // One way out: the hold on Leave below. The phone's back button pops a
  // history entry, so this screen adds one spare entry on arrival and, on
  // every pop, puts itself straight back and says so. The latch in browser
  // storage remembers that BlackSky was the last screen open, so a later visit
  // to the app returns here (BlackSkyResume in app.tsx) until the hold clears
  // it. Absolute paths only, so the navigate captured at mount stays valid.
  useEffect(() => {
    latchBlackSky(localFlagStore());
    navigate('/blacksky');
    const onBack = () => {
      navigate('/blacksky');
      setNotice(copy.BACK_PRESSED);
    };
    window.addEventListener('popstate', onBack);
    return () => window.removeEventListener('popstate', onBack);
  }, []);

  // The tick: publishes the clock AND the newest fix together, once per
  // TICK_MS. The fix's age needs the clock to move (an old fix must be called
  // old), and publishing both in one place keeps renders to one per tick. A
  // hidden page is not drawn: the next tick after it returns catches up.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.hidden) return;
      setNow(Date.now());
      setFix(latestFix.current);
    }, TICK_MS);
    return () => clearInterval(timer);
  }, []);

  // BS_Enhancement-AC3: voice. On or off is memory only, like the Show pick: no
  // storage key, and a fresh visit to BlackSky is always silent until tapped.
  // The rule that decides what to say is pure (core/blacksky-voice.ts); this
  // screen keeps its record between calls and feeds it what is on screen now.
  const voice = useVoice();
  const { speak, cancel } = voice;
  const [voiceOn, setVoiceOn] = useState(false);
  const voiceRecord = useRef<VoiceRecord | null>(null);
  // What the dial shows, refreshed on every render further down. The voice
  // reads it from a timer, so it goes through a ref, and the side is worked out
  // at that moment from the heading the compass hook last painted: the phone
  // turns far more often than the screen renders.
  const voiceInput = useRef<(Omit<VoiceState, 'side' | 'returned'> & { bearingDeg: number }) | null>(
    null,
  );
  const { headingDeg } = compass;
  const readVoiceState = useCallback(
    (returned: boolean): VoiceState | null => {
      if (!voiceInput.current) return null;
      const { bearingDeg, ...shown } = voiceInput.current;
      const heading = headingDeg();
      const side = sideOf(heading === null ? null : relativeBearing(bearingDeg, heading));
      return { ...shown, side, returned };
    },
    [headingDeg],
  );

  useEffect(() => {
    if (!voiceOn) return;
    let returned = false;
    const check = () => {
      // Nothing is said to a page nobody is looking at, or with no dial to read.
      if (document.hidden || !voiceRecord.current) return;
      const state = readVoiceState(returned);
      if (!state) return;
      returned = false;
      const step = nextUtterance(voiceRecord.current, Date.now(), state);
      voiceRecord.current = step.record;
      if (step.utterance) speak(step.utterance.text, step.utterance.cutIn);
    };
    // Leaving the page stops the sentence at once: the person may be making a
    // call, and the app must never talk over it. BS_Enhancement-AC4: coming
    // back is noted, and the next check, which runs after the figures have
    // been refreshed, says the current ones once.
    const onVisibility = () => {
      if (document.hidden) cancel();
      else returned = true;
    };
    const timer = setInterval(check, VOICE_CHECK_MS);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [voiceOn, readVoiceState, speak, cancel]);

  // One tap speaks once and turns repeating on; a second tap stops the sentence
  // and turns it off. The first sentence starts INSIDE this handler: an iPhone
  // only lets a page speak when the first utterance comes straight from a tap.
  const toggleVoice = () => {
    if (voiceOn) {
      cancel();
      voiceRecord.current = null;
      setVoiceOn(false);
      return;
    }
    const state = readVoiceState(false);
    if (!state) return;
    const first = firstUtterance(Date.now(), state);
    voiceRecord.current = first.record;
    speak(first.utterance!.text, true);
    setVoiceOn(true);
  };

  // BS_Enhancement-AC4: the screen is kept awake only while voice is on or the
  // person moved in the last minute. The speed of an old position says nothing
  // about now, so it does not count. Released on Leave, because Leave unmounts
  // this screen.
  const speedMps = fix && now - fix.at <= FIX_STALE_MS ? fix.speedMps : undefined;
  useWakeLock(shouldStayAwake(voiceOn, lastMovingAt.current, now));

  // The page itself, empty, while the store answers: the route's focus lands on
  // it, and the same element carries the screen once it arrives.
  if (packs === null) return <main className="page blacksky" />;

  // One pack needs no choosing. With several, only the chosen one is loaded,
  // and a remembered id that matches no saved pack loads nothing.
  const chosen =
    packs.length === 1 ? packs[0] : (packs.find((p) => p.pack.id === chosenId) ?? null);
  const loaded = chosen ? [chosen] : [];
  const screen = estimate
    ? deriveState(now, loaded, estimate, 'granted', sites)
    : deriveState(now, loaded, fix, permission, sites);
  const notes = chosen?.notes ?? [];
  // The position the dial is drawn from, so the picker can say which packs'
  // areas contain it.
  const from = estimate ?? positionFrom(fix, permission);
  // Listed in Home's order, so the packs read the same on both screens.
  const choices = [...packs].sort((a, b) => newestPlaceFirst(a.pack, b.pack));

  // BS_Enhancement-AC1 and AC2. deriveState says what can be pointed at; the
  // dial rules pick the one main place and say how far to trust the position.
  const model = dialModel(screen, shownId);
  const confidence = 'confidence' in screen ? screen.confidence : undefined;
  const trust = confidence ? positionTrust(confidence, estimate !== null) : null;
  voiceInput.current =
    model && trust
      ? {
          placeId: model.first.id,
          // The site as the screen names it, so the voice, its caption and the
          // name block all say the same thing.
          site: siteNameBlock(model.first.name).site,
          point: cardinalPoint(model.first.bearingDeg),
          distanceM: model.first.distanceM,
          about: trust.about,
          signalLost: trust.bar !== null,
          moving: isMoving(speedMps),
          bearingDeg: model.first.bearingDeg,
        }
      : null;
  const dial =
    model && trust ? (
      <DialBody
        model={model}
        trust={trust}
        // The error of the position, stated beside the figure it qualifies:
        // from a mark, E3-US1-AC4's ESTIMATE over the distance, its figure
        // growing.
        estimated={estimate !== null}
        accuracyM={estimate ? estimate.accuracyM : confidence!.accuracyM}
        compass={compass}
        // BS_Enhancement-AC3: the speaker button, at the right-hand end of the
        // distance row, outlined when off and filled when on. Unavailable: no
        // speech on this phone, so no button is drawn at all.
        rowEnd={
          voice.available ? (
            <button
              type="button"
              className="blacksky-speaker"
              aria-pressed={voiceOn}
              aria-label={copy.VOICE_BUTTON}
              onClick={toggleVoice}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" />
                <path className="waves" d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" />
              </svg>
            </button>
          ) : null
        }
        onShow={setShownId}
        roads={roads && here ? { map: roads, here } : undefined}
      />
    ) : trust ? (
      // Empty: a position, and nothing stored that can be pointed at.
      <StateCard heading={copy.NO_PLACE_TO_POINT_AT} />
    ) : null;
  // The person's own notes, read-only here. Beside the dial they stand open,
  // readable without a tap; on the no-fix reference screen they stay folded
  // until asked for, as that screen was built.
  const notesBlock =
    notes.length > 0 ? (
      <details className="blacksky-notes" open={model !== null}>
        {/* Headed as a pack page section: the drawing, the name and the count,
            with the chevron every toggle carries, turning down while open. */}
        <summary className="pack-section-head">
          <Glyph kind="note" />
          <span className="kicker">{copy.NOTES}</span>
          <span className="section-count">{notes.length}</span>
          <svg className="hint-chevron" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
            <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </summary>
        <ul className="list">
          {notes.map((note) => (
            <li key={note.id} className="card blacksky-note">
              <NoteText text={note.text} />
            </li>
          ))}
        </ul>
      </details>
    ) : null;

  return (
    <main className="page blacksky">
      {/* The mode's name, for a screen reader: on screen the dark page says it. */}
      <h1 className="visually-hidden">{copy.BLACKSKY_TITLE}</h1>
      {/* The one way out: a round hold with the Cooeee mark, on exactly the spot
          of the tab bar's compass that opened BlackSky, with Cooeee under it
          where BlackSky sits under the compass. US3-AC1: leaving takes the same
          deliberate two second hold as entering, so a pocket press cannot drop
          the emergency screen. The sweep goes round outside the button, so a
          thumb covers the button and never the sweep (the phone test of 28 Sep
          found a finger hid the old pill's progress). The page fades to black
          behind it, so text dims out rather than showing through, and the hint
          after a tap floats above it, so nothing moves under the finger. Teal
          while held: the colour of the app it goes back to. First in the page,
          so it is read and reached first, as the top bar was.
          E5-US3-AC3: a rehearsal that is running is where she came from, so
          leaving goes back to it, not to Home.
          ponytail: a cold start inside BlackSky loses the in-memory run and
          leaves to Home; the kept rehearsal is asked about on the pack's next
          visit. Upgrade path: look the unfinished row up on leave. */}
      <div className="blacksky-leave">
        <div className="nav-blacksky-slot">
          <HoldButton
            onHold={() => {
              unlatchBlackSky(localFlagStore());
              const run = currentRun();
              navigate(run ? `/rehearse/${run.packId}` : '/', { replace: true });
            }}
            hint={copy.HOLD_TO_LEAVE}
            hintMs={NAV_HOLD_HINT_MS}
            label={copy.LEAVE_BLACKSKY}
            className="blacksky-leave-button"
            vibrateMs={HOLD_LEAVE_VIBRATE_MS}
          >
            <Mark size={30} />
            <HoldSweep />
          </HoldButton>
          <span className="bottom-nav-label" aria-hidden="true">
            {copy.APP_NAME}
          </span>
          {/* Everything spoken is also shown (WCAG 1.2.1): exactly the words,
              for as long as they are being said, floating just above the hold
              where its hint floats, so they never cover the dial. Not a live
              region: a screen reader would say them on top of the voice. */}
          {voice.caption ? <p className="blacksky-caption">{voice.caption}</p> : null}
        </div>
      </div>
      {/* Why BlackSky is still open after Back was pressed. */}
      {notice ? (
        <p className="muted blacksky-notice" role="status">
          {notice}
        </p>
      ) : null}
      {packs.length > 1 ? (
        <PackPicker
          packs={choices.map(({ pack }) => pack)}
          chosenId={chosen?.pack.id}
          from={from}
          onChoose={choosePack}
        />
      ) : null}
      {/* BS_Enhancement-AC2: the bar. The status element is always in the
          page, empty while the position is fresh, so a screen reader hears the
          words once when they arrive and focus never moves (WCAG 4.1.3). The
          age sits outside it: a figure that changes every tick must not be
          read out every tick. */}
      <div className="blacksky-bar" data-on={trust?.bar ? 'true' : 'false'}>
        <span role="status">{trust?.bar ? copy.GPS_SIGNAL_LOST : null}</span>
        {trust?.bar === 'stale' && confidence ? (
          <span className="figure">{copy.LAST_POSITION_AGE(confidence.ageS)}</span>
        ) : null}
        {trust?.bar === 'mark' ? <span>{copy.FROM_YOUR_SAVED_PLACE}</span> : null}
      </div>
      {/* With no dial yet, the compass is offered here, so an iPhone can turn
          it on before the first position and the dial turns once it arrives. */}
      {model && trust ? null : <TurnOnCompass compass={compass} />}
      {screen.kind === 'NO_PACK' && packs.length > 0 ? (
        // Several packs and none chosen yet: only the dial to the nearest
        // official place, from the position, until one is chosen.
        from ? (
          <>
            {dial}
            {screen.confidence ? <ConfidenceLines confidence={screen.confidence} /> : null}
          </>
        ) : (
          <StateCard heading={copy.NO_GPS_YET} />
        )
      ) : (
        <ScreenBody
          screen={screen}
          estimating={estimate !== null}
          onMark={setMark}
          dial={dial}
          notes={notesBlock}
        />
      )}
      {/* Under the dial, never above it: the dial is the one thing first. */}
      {chosen && !chosen.placesVerified ? <StateCard heading={copy.PLACES_UNVERIFIED} /> : null}
      {/* The loaded pack's reminder closes every state of the screen, once, as
          a quiet note: the dial is what is read first. */}
      <p className="muted blacksky-reminder">{chosen?.pack.reminder || copy.OFFICIAL_INSTRUCTIONS_FIRST}</p>
    </main>
  );
}

/** Several packs: which one to load, asked at the top of the screen. Once one
 *  is chosen the list folds to that pack in the amber ring, with an arrow
 *  at its edge to open the list again, so the dial stays high on the screen. Full-width targets for wet hands.
 *  Each pack keeps its key whether the list is folded or open, so the button
 *  just tapped stays in the page and keeps the focus. */
function PackPicker({
  packs,
  chosenId,
  from,
  onChoose,
}: {
  packs: Pack[];
  chosenId: string | undefined;
  from: LatLon | null;
  onChoose: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const chosen = packs.find((pack) => pack.id === chosenId);
  const folded = chosen !== undefined && !open;
  return (
    <section className="blacksky-picker">
      <span className="kicker">{folded ? copy.PACK_LOADED : copy.CHOOSE_PACK}</span>
      {folded ? null : <p className="muted">{copy.CHOOSE_PACK_HINT}</p>}
      <ul className="list">
        {(folded ? [chosen] : packs).map((pack) => (
          <li key={pack.id}>
            <button
              type="button"
              className="blacksky-pack"
              aria-pressed={folded ? undefined : pack.id === chosenId}
              aria-expanded={folded ? false : undefined}
              onClick={() => {
                if (!folded) onChoose(pack.id);
                setOpen(folded);
              }}
            >
              {/* The pack's own drawing, in amber like everything here. */}
              <Glyph kind={packIcon(pack)} />
              <span className="blacksky-pack-text">
                <span className="pack-name">{shownPackName(pack.name)}</span>
                <span className="blacksky-pack-address">{titleCase(pack.address)}</span>
                {from && distanceM(from, pack) <= pack.radiusKm * 1000 ? (
                  <span className="blacksky-pack-here with-glyph">
                    <Glyph kind="locate" line />
                    {copy.PACK_COVERS_HERE}
                  </span>
                ) : null}
              </span>
              {/* Folded: an arrow centred at the card's right edge says it
                  opens, as on Home's pack cards and the Notes heading. Change
                  is said to a screen reader, with the card's collapsed state. */}
              {folded ? (
                <span className="blacksky-pack-change">
                  <span className="visually-hidden">{copy.CHANGE_PACK}</span>
                  <svg className="hint-chevron" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
                    <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ScreenBody({
  screen,
  estimating,
  onMark,
  dial,
  notes,
}: {
  screen: Screen;
  estimating: boolean;
  onMark: (mark: PositionMark) => void;
  dial: ReactNode;
  notes: ReactNode;
}) {
  switch (screen.kind) {
    // US2-AC2: no pack stored. Nothing is invented or borrowed: the nearest
    // official place on the stored CFA list is on the dial once there is a
    // fix, then the built-in preparation guidance and a reminder to build a
    // pack when next online (from the home screen, after the hold to leave).
    case 'NO_PACK':
      return (
        <>
          {dial}
          {screen.confidence ? <ConfidenceLines confidence={screen.confidence} /> : null}
          <StateCard heading={copy.NO_PACK_HERE} detail={copy.NO_PACKS_HINT} />
          <section className="card blacksky-guidance">
            <h2>{copy.PREPARATION_GUIDANCE_TITLE}</h2>
            <p>{copy.PREP_KIT_LINE}</p>
            <p>{copy.PREP_PLAN_LINE}</p>
          </section>
        </>
      );
    // US1-AC2: no fix at all, so nothing to point from. The saved information
    // stands as reference text — names, addresses and the reminder — and the
    // state line says why. A designed state, not an error: the next derivation
    // with a fix draws the dial on its own.
    case 'ACQUIRING':
      return (
        <>
          {/* The state and what can be done about it, in one card. US1-AC4:
              the mark control. Offered for every ACQUIRING reason — someone
              who denied GPS is exactly who needs it. */}
          <StateCard heading={copy.NO_GPS} detail={copy.MARK_HINT}>
            {/* Two centred lines: the pin leading I'm standing at, then the
                address on its own. Named in one sentence for a screen reader. */}
            <button
              type="button"
              className="blacksky-mark"
              aria-label={copy.MARK_AT_SAVED_PLACE(titleCase(screen.pack.address))}
              onClick={() =>
                onMark({ lat: screen.pack.lat, lon: screen.pack.lon, at: Date.now() })
              }
            >
              <span className="with-glyph">
                <Glyph kind="place" line />
                {copy.MARK_STANDING_AT}
              </span>
              <span>{titleCase(screen.pack.address)}</span>
            </button>
          </StateCard>
          <ReferenceBody places={screen.places} />
          {notes}
        </>
      );
    // US2-AC1: outside the loaded pack's area. The pack is named with the
    // distance to its area's edge — an informational row, never a bearing to
    // an out-of-area point — then the dial to the nearest official place from
    // here, and the notes.
    case 'OUT_OF_AREA':
      return (
        <>
          {/* E3-US2-AC1: the loaded pack named with the distance to its area's
              edge, one plain sentence under the dial. Never a direction to the
              area. */}
          {dial}
          {screen.packs.map(({ pack, distanceKm }) => (
            // A fact about where the person stands, not something missing, so
            // an amber notice, not a state card: the amber edge the app gives
            // what needs attention without being an emergency, and the pack's
            // own drawing.
            <p key={pack.id} className="caution-line blacksky-outside with-glyph">
              <Glyph kind={packIcon(pack)} line />
              {copy.OUTSIDE_PACK_AREA(copy.distanceLabel(distanceKm * 1000), shownPackName(pack.name))}
            </p>
          ))}
          {notes}
          <ConfidenceLines confidence={screen.confidence} />
        </>
      );
    // Inside the loaded pack's area: the card's order. The dial and then the
    // person's own notes come first; the figures and lines EPIC 3 put here
    // follow them, unchanged.
    case 'IN_AREA':
      return (
        <>
          {dial}
          {notes}
          {estimating ? null : <ConfidenceLines confidence={screen.confidence} />}
          {screen.absence?.reason ? <StateCard heading={screen.absence.reason} /> : null}
        </>
      );
  }
}

const DIAL_LABELS: Record<DialLabel, string> = {
  chosen: copy.YOUR_CHOSEN_PLACE,
  nearest: copy.NEAREST_PLACE_OF_LAST_RESORT,
  listed: copy.PLACE_OF_LAST_RESORT,
};

/** BS_Enhancement-AC1: one place as the main subject. Top to bottom: where the
 *  place comes from, its name (site first, suburb second), the distance as the
 *  largest text on the screen with the compass point beside it, the dial, and
 *  every other place folded into one line. No source line, no rank, one pin. */
function DialBody({
  model,
  trust,
  estimated,
  accuracyM,
  compass,
  rowEnd,
  onShow,
  roads,
}: {
  model: DialModel;
  trust: PositionTrust;
  /** The position is a mark the person made, not a fix: ESTIMATE stands over
   *  the distance, and the figure's bubble says what that means. */
  estimated: boolean;
  /** How far the position may be out, metres: the readout holds still within it. */
  accuracyM: number;
  compass: {
    live: boolean;
    needsPermission: boolean;
    enable: () => Promise<void>;
    headingDeg: () => number | null;
  };
  /** What sits at the right-hand end of the distance row: the speaker button,
   *  where there is one. The row keeps that 48 px free either way, so the
   *  figures sit in the same place with or without it. */
  rowEnd?: ReactNode;
  onShow: (id: string) => void;
  /** BS_Enhancement-AC5: the roads and the view, when the phone holds them. */
  roads?: DialRoads;
}) {
  const { first, label, others } = model;
  const frame = useRef<HTMLDivElement>(null);
  // BS_Enhancement-AC5, from the 28 Sep review: the map can be dragged to look
  // around, and comes back to the person on "Back to me" or by itself.
  const [offset, setOffset] = useState<PanOffset>(NO_PAN);
  const [lastTouchAt, setLastTouchAt] = useState<number | null>(null);
  const map = useDialMap(roads, first, useFrameWidth(frame, roads !== undefined), offset);
  const panned = isPanned(offset);
  const pan = usePan(map.layer?.map.metresPerPx ?? 0, compass.headingDeg, setOffset, setLastTouchAt);
  useEffect(() => {
    if (!panned || lastTouchAt === null) return;
    const timer = setTimeout(
      () => {
        if (panShouldReturn(offset, lastTouchAt, Date.now())) setOffset(NO_PAN);
      },
      Math.max(0, ROADS_PAN_RETURN_MS - (Date.now() - lastTouchAt)),
    );
    return () => clearTimeout(timer);
  }, [panned, offset, lastTouchAt]);
  const { site, line } = siteNameBlock(first.name);
  // The distance and the compass point hold still while the position only
  // wobbles within its error (core/readout.ts); the arrow and the pin follow
  // every fix, and the voice keeps its own rule.
  const readout = copy.ACCURACY_READOUT(accuracyM);
  const [explained, setExplained] = useState(false);
  const explainId = useId();
  const explainPanel = useRevealedPanel<HTMLElement>(explained);
  const toggle = useRef<HTMLButtonElement>(null);
  const shownRef = useRef<ShownReadout | null>(null);
  const shown = steadyReadout(
    shownRef.current,
    { placeId: first.id, distanceM: first.distanceM, bearingDeg: first.bearingDeg },
    accuracyM,
  );
  shownRef.current = shown;
  const distance = copy.distanceLabel(shown.distanceM);
  const [figure, unit] = distance.split(' '); // "12.3 km": always a number, a space, a unit
  const point = cardinalPoint(shown.bearingDeg);
  return (
    <section className="blacksky-dial-body">
      <div className="blacksky-dial-head">
        <span className="kicker">{DIAL_LABELS[label]}</span>
        <h2>{site}</h2>
        {line ? <p className="muted">{line}</p> : null}
      </div>
      {/* The distance row: the figure, then the compass point over the
          position's error, then the speaker button's place at the right-hand
          end. The point is a full word, never letters: a lone "E" read as a
          stray letter. It is set small, in the narrow column the big figure
          leaves, and a two-word point breaks at its hyphen (NORTH- / EAST).
          BS_Enhancement-AC2: a figure from an old, vague or estimated position
          is dimmed and says "about", so it never looks more certain than it is. */}
      <div className="blacksky-dial-figures" data-about={trust.about ? 'true' : 'false'}>
        <span className="blacksky-dial-distance">
          {/* From a mark, ESTIMATE (E3-US1-AC4) stands where about does. */}
          {trust.about ? <span className="blacksky-dial-about">{estimated ? copy.ESTIMATE : copy.ABOUT}</span> : null}
          {/* The number at full size, its unit at half: the number is what is
              read at arm's length, and on a 360 px phone a full-size "km" took
              the room the accuracy and the speaker button need on this row. */}
          <span className="blacksky-figure-main figure">
            {figure} <span className="blacksky-figure-unit">{unit}</span>
          </span>
        </span>
        <span className="blacksky-dial-beside">
          <span className="blacksky-figure-point">{point}</span>
          {/* The short "± 10 m" under the point, from a fix or a mark. UAT: the bare figure was not understood. It is named for a
              screen reader and opens its meaning beside the figure it
              qualifies, as every Source in the app opens from its own words. A
              margin no one sees gives it the 44 px tap area without a taller
              row. */}
          <button
            ref={toggle}
            type="button"
            className="blacksky-dial-readout blacksky-readout-toggle figure"
            aria-label={`${estimated ? copy.ESTIMATE : copy.ACCURACY_LABEL} ${readout}`}
            aria-expanded={explained}
            aria-controls={explainId}
            onClick={() => setExplained((open) => !open)}
          >
            {readout}
            <svg className="hint-chevron" viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" focusable="false">
              <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </span>
        {rowEnd ? <span className="blacksky-dial-row-end">{rowEnd}</span> : null}
        {/* What the figure means: a bubble over the top of the dial, its
            pointer under the figure, until the figure is tapped again. Over
            the dial, not a row of its own, so opening it never moves the dial. */}
        {explained ? (
          <section
            id={explainId}
            ref={explainPanel}
            tabIndex={-1}
            className="hint-panel info-panel blacksky-info-panel blacksky-readout-panel"
            style={{ '--pointer-at': `${(toggle.current?.offsetLeft ?? 0) + 8}px` } as CSSProperties}
          >
            {/* What the distance is first, then how sure it is. */}
            <p>{copy.DISTANCE_STRAIGHT_LINE(distance)}</p>
            <p>{estimated ? copy.ESTIMATE_DETAIL(accuracyM) : copy.ACCURACY_DETAIL(accuracyM)}</p>
          </section>
        ) : null}
      </div>
      {/* The dial has the full width of the screen to itself, nothing beside
          it: it is the largest thing on the screen, and it is sized for the map
          that is to go inside the ring. Nothing is turning it: it is drawn
          north up and says so, in the corner the ring leaves free. */}
      {/* The slot is the room the layout can spare (see the stylesheet: it
          shrinks so the Notes heading stays on the first screen). The frame
          inside it is the dial's own square, as big as the slot allows, so the
          North up tag still sits in the dial's corner, not the slot's. */}
      <div className="blacksky-dial-slot">
        <div className="blacksky-dial-frame" ref={frame}>
          <BlackSkyDial
            bearingDeg={first.bearingDeg}
            centre={dialCentre(trust)}
            description={copy.DIAL_DESCRIPTION(site, distance, point)}
            map={map.layer ?? undefined}
            placeAt={map.placeAt}
          />
          {/* The disc is where the map is dragged: a clear layer over it, round
              like it, that takes the pointer and nothing else. It is not a
              button and has no name; the dial's own text equivalent stands. */}
          {map.layer ? <div ref={pan} className="blacksky-dial-pan" data-panned={panned} /> : null}
          {/* The north badge, as map apps show it: a ring with N and a pointer
              at its top, with the words beside it for anyone who does not know
              the sign. Drawn, so it costs no request. */}
          {compass.live ? null : (
            <span className="blacksky-tag">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
                <path className="blacksky-north-pointer" d="M12 1 15 5H9z" />
                <circle cx="12" cy="14" r="8.5" />
                <path d="M9.5 17.5v-7l5 7v-7" />
              </svg>
              {copy.NORTH_UP}
            </span>
          )}
          {/* The roads and place names are Vicmap's, under CC BY 4.0, which asks
              for this credit where they are shown: in the box's two bottom
              corners, outside the ring, so it covers no map and never turns. */}
          {map.layer ? (
            <p className="blacksky-map-credit">
              <span>{copy.MAP_CREDIT_OWNER}</span>
              <span>{copy.MAP_CREDIT_DATA}</span>
            </p>
          ) : null}
          {/* While the map is dragged away from the person: one tap puts them
              back at the centre. Over the dial's foot, not in a row of its own:
              a row that came and went took its height out of the dial, which
              shrank as a drag began and jumped back on the tap. After the drag
              layer in the page, so it sits above it and takes its own tap, and
              in the tab order after the dial. */}
          {panned ? (
            <button type="button" className="blacksky-map-return" onClick={() => setOffset(NO_PAN)}>
              {copy.MAP_RETURN_BUTTON}
            </button>
          ) : null}
        </div>
      </div>
      <TurnOnCompass compass={compass} />
      {others.length > 0 ? <OtherPlaces places={others} onShow={onShow} /> : null}
    </section>
  );
}

/** On an iPhone the compass stays off until it is allowed, which takes one
 *  tap of its own: iOS refuses the lift that ends the hold into BlackSky. */
function TurnOnCompass({
  compass,
}: {
  compass: { live: boolean; needsPermission: boolean; enable: () => Promise<void> };
}) {
  if (compass.live || !compass.needsPermission) return null;
  return (
    <button type="button" onClick={() => void compass.enable()}>
      {copy.TURN_ON_COMPASS}
    </button>
  );
}

/** What the screen hands the dial for its map: the decoded roads and where
 *  the person is. */
type DialRoads = {
  map: RoadMap;
  here: LatLon;
};

/** Where the map was last drawn from. Kept until the person has moved more than
 *  redrawDistanceM for its view, or the view or the place changes; the rest of the
 *  time the drawn map is reused as it is and only the ring turns. */
type MapAnchor = LatLon & {
  view: MapView;
  placeId: string;
  radiusM: number;
  distanceM: number;
  bearingDeg: number;
  /** The drag the map is drawn with, metres north and east of the person. */
  offset: PanOffset;
};

/** Dragging the map on the disc. A pointer that moves ROADS_PAN_TAP_PX or more
 *  moves the map with it; less is a tap and does nothing. The pointer is
 *  captured, so a drag that leaves the disc still ends here; the disc has
 *  touch-action none, so the page does not scroll or zoom under the finger.
 *  No wheel and no pinch: one way to move the map, the same on every phone.
 *  The listeners are the page's own, not React's, so a drag costs a render
 *  per move of the map and nothing more. Returns the ref for the disc's layer. */
function usePan(
  metresPerPx: number,
  headingDeg: () => number | null,
  setOffset: (next: (current: PanOffset) => PanOffset) => void,
  setLastTouchAt: (at: number | null) => void,
): RefObject<HTMLDivElement | null> {
  const layer = useRef<HTMLDivElement>(null);
  // The scale and the heading at the moment of each move, read through a ref
  // so the listeners are set once.
  const now = useRef({ metresPerPx, headingDeg });
  now.current = { metresPerPx, headingDeg };
  const on = metresPerPx > 0;
  useEffect(() => {
    const element = layer.current;
    if (!on || !element) return;
    let start: { x: number; y: number } | null = null;
    let last: { x: number; y: number } | null = null;
    let dragging = false;
    const down = (event: PointerEvent) => {
      if (!event.isPrimary) return;
      start = { x: event.clientX, y: event.clientY };
      last = start;
      dragging = false;
      try {
        element.setPointerCapture(event.pointerId);
      } catch {
        // A pointer the browser will not capture still drags while over the disc.
      }
      setLastTouchAt(null); // a finger is on the map: no return while it is
    };
    const move = (event: PointerEvent) => {
      if (!start || !last) return;
      if (!dragging && Math.hypot(event.clientX - start.x, event.clientY - start.y) < ROADS_PAN_TAP_PX) return;
      dragging = true;
      const dx = event.clientX - last.x;
      const dy = event.clientY - last.y;
      last = { x: event.clientX, y: event.clientY };
      const { metresPerPx: scale, headingDeg: heading } = now.current;
      setOffset((current) => panOffset(current, dx, dy, heading() ?? 0, scale));
    };
    const up = () => {
      if (!start) return;
      start = null;
      last = null;
      setLastTouchAt(Date.now());
    };
    element.addEventListener('pointerdown', down);
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', up);
    element.addEventListener('pointercancel', up);
    return () => {
      element.removeEventListener('pointerdown', down);
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerup', up);
      element.removeEventListener('pointercancel', up);
    };
  }, [on, setOffset, setLastTouchAt]);
  return layer;
}

/** The dial frame's width in CSS pixels, followed as the layout resizes it:
 *  the map's lines and names are set in real pixels, so it must know. */
function useFrameWidth(frame: RefObject<HTMLDivElement | null>, on: boolean): number {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = frame.current;
    if (!on || !element) return;
    const read = () => setWidth(Math.round(element.getBoundingClientRect().width));
    read();
    const observer = new ResizeObserver(read);
    observer.observe(element);
    return () => observer.disconnect();
  }, [frame, on]);
  return width;
}

/** The width of a road name in the dial's own font, so the label rule fits
 *  real text, not an estimate. */
function useLabelMeasure(): ((name: string) => number) | undefined {
  return useMemo(() => {
    const context = document.createElement('canvas').getContext('2d');
    if (!context) return undefined;
    context.font = `600 ${ROADS_LABEL_PX}px ${getComputedStyle(document.body).fontFamily}`;
    return (name: string) => context.measureText(name).width;
  }, []);
}

/** What a name must keep clear of, in the map's pixels, north up. The map turns
 *  with the ring, and so do the letters; the arrow and the pin turn by the
 *  place's bearing on top of that, so against the map they stand still at that
 *  bearing. All are therefore fixed in the map's own frame and can be worked
 *  out when it is drawn. Circles that cover each shape, in drawing units first,
 *  but for the drop, which is sized in screen pixels. The arrow stands at the
 *  person (`personPx`), which is away from the centre when the map has been
 *  dragged; the drop at the place (`placePx`) when it is inside the disc. */
function dialObstacles(
  bearingDeg: number,
  personPx: [number, number],
  placePx: [number, number] | null,
  pxPerUnit: number,
): Obstacle[] {
  const rad = (bearingDeg * Math.PI) / 180;
  const along = (d: number, r: number) => ({ x: d * Math.sin(rad), y: -d * Math.cos(rad), r });
  // The arrow as drawn at full size (tip 46 from the centre, head 32 wide at
  // 14, shaft 12 wide back to 18 behind), scaled with it, and a unit more for
  // its outline.
  const arrow = [
    [37, 9],
    [22, 18],
    [5, 8],
    [-10, 9],
  ]
    .map(([d, r]) => along(d * DIAL_ARROW_SCALE, r * DIAL_ARROW_SCALE + 1))
    .map(({ x, y, r }) => ({ x: x * pxPerUnit + personPx[0], y: y * pxPerUnit + personPx[1], r: r * pxPerUnit }));
  // The letters and the ring's marker are at the dial's own centre, not the
  // map's: they lie across and outside the disc's edge.
  const fixed = [
    ...[0, 90, 180, 270].map((deg) => ({
      x: LETTER_R * Math.sin((deg * Math.PI) / 180),
      y: -LETTER_R * Math.cos((deg * Math.PI) / 180),
      r: (RING_R - MAP_R) / 2 + 1,
    })),
    // The drop on the ring, tip on the ring's line and body pointing in: it
    // reaches over the band into the disc's edge.
    ...(placePx === null ? [along(RING_R - RING_DROP_UNITS / 2, RING_DROP_UNITS / 2 + 1)] : []),
  ].map(({ x, y, r }) => ({ x: x * pxPerUnit, y: y * pxPerUnit, r: r * pxPerUnit }));
  // The drop stands upright on the screen whichever way the map has turned,
  // so all of its 22 px round its tip is kept clear.
  const drop = placePx ? [{ x: placePx[0], y: placePx[1], r: 24 }] : [];
  return [...arrow, ...fixed, ...drop];
}

/** Where the place is on the map, in its pixels, north up: from the person,
 *  along its bearing, at its distance. Null when it is outside the map's
 *  circle, and the pin sits on the ring. */
function placeOnMap(
  personPx: [number, number],
  distanceM: number,
  bearingDeg: number,
  metresPerPx: number,
  radiusPx: number,
): [number, number] | null {
  const rad = (bearingDeg * Math.PI) / 180;
  const x = personPx[0] + (distanceM * Math.sin(rad)) / metresPerPx;
  const y = personPx[1] - (distanceM * Math.cos(rad)) / metresPerPx;
  return Math.hypot(x, y) < radiusPx ? [x, y] : null;
}

/** BS_Enhancement-AC5: the drawn map for the dial, and where the place sits on
 *  it. The map is worked out again only when the anchor moves, the map is
 *  dragged, or the dial changes size; never per sensor reading. */
function useDialMap(
  roads: DialRoads | undefined,
  first: Placed,
  frameWidth: number,
  offset: PanOffset,
): { layer: DialMapLayer | null; placeAt: [number, number] | undefined } {
  const anchor = useRef<MapAnchor | null>(null);
  const measure = useLabelMeasure();
  let at = anchor.current;
  if (roads) {
    const { here } = roads;
    const view = MAP_VIEW;
    if (
      !at ||
      at.view !== view ||
      at.placeId !== first.id ||
      at.offset !== offset ||
      distanceM(at, here) > redrawDistanceM(at.radiusM)
    ) {
      at = {
        lat: here.lat,
        lon: here.lon,
        view,
        placeId: first.id,
        radiusM: viewRadiusM(view, first.distanceM),
        distanceM: first.distanceM,
        bearingDeg: first.bearingDeg,
        offset,
      };
      anchor.current = at;
    }
  }
  const map = roads?.map;
  const pxPerUnit = frameWidth / DIAL_UNITS;
  const drawStart = useRef(0);
  const layer = useMemo(() => {
    if (!map || !at || pxPerUnit <= 0) return null;
    drawStart.current = performance.now();
    const radiusPx = MAP_R * pxPerUnit;
    const metresPerPx = at.radiusM / radiusPx;
    const personPx: [number, number] = [-at.offset.east / metresPerPx, at.offset.north / metresPerPx];
    const place = placeOnMap(personPx, at.distanceM, at.bearingDeg, metresPerPx, radiusPx);
    const obstacles = dialObstacles(at.bearingDeg, personPx, place, pxPerUnit);
    const drawn = drawRoads(map, at, {
      view: at.view,
      radiusM: at.radiusM,
      radiusPx,
      obstacles,
      measure,
      offset: at.offset,
    });
    return { map: drawn, pxPerUnit };
  }, [map, at, pxPerUnit, measure]);
  // Measured from the start of the work to the moment React has put the paths
  // in the page, so it can be read on a phone in the performance panel.
  useLayoutEffect(() => {
    if (layer) performance.measure('cooeee:roads-draw', { start: drawStart.current, end: performance.now() });
  }, [layer]);
  // The place follows the person between redraws, against the drawn map.
  const place = layer
    ? placeOnMap(
        layer.map.personPx,
        first.distanceM,
        first.bearingDeg,
        layer.map.metresPerPx,
        MAP_R * layer.pxPerUnit,
      )
    : null;
  return { layer, placeAt: place ?? undefined };
}

/** Every other place: one line that says how many and how far, and the sheet
 *  it opens. A native dialog, so the page behind is inert, focus stays inside
 *  and the phone's own dismiss closes it, with no script for any of that. The
 *  sheet is a list of places, so the mandated phrase heads it. */
function OtherPlaces({ places, onShow }: { places: Placed[]; onShow: (id: string) => void }) {
  const sheet = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  return (
    <>
      {/* One line, always: how many, and the range they lie in. A list of
          distances could not stay on one line on a narrow phone without being
          cut off, and a cut-off distance is a distance not given. The full
          list is one tap away, in the sheet. */}
      <button type="button" className="blacksky-others" onClick={() => sheet.current?.showModal()}>
        <Glyph kind="place" line />
        <span className="blacksky-others-text">
          {copy.OTHER_PLACES(places.map((place) => copy.distanceLabel(place.distanceM)))}
        </span>
        <svg className="hint-chevron" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
          <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <dialog ref={sheet} className="blacksky-sheet" aria-labelledby={titleId}>
        <h2 id={titleId}>{copy.OTHER_PLACES_TITLE}</h2>
        {/* Quieter by colour alone: BlackSky keeps every line at 16 px or more.
            Distances here are straight lines too, said as Nearby says it. */}
        <p className="muted">{copy.SORTED_BY_DISTANCE}</p>
        <p className="muted">{copy.DISTANCES_NOTE}</p>
        <ul className="list">
          {places.map((place) => {
            const { site, line } = siteNameBlock(place.name);
            // Each place a card, as on the pack page and Nearby: the site in
            // bold with its distance beside it, the suburb under it, then the
            // direction and Show. The whole card is the one target, and a
            // screen reader hears all of it.
            return (
              <li key={place.id}>
                <button
                  type="button"
                  className="card blacksky-other"
                  onClick={() => {
                    sheet.current?.close();
                    onShow(place.id);
                  }}
                >
                  <span className="nearby-place">
                    <span className="nearby-place-name">{site}</span>
                    <span className="figure nearby-distance">{copy.distanceLabel(place.distanceM)}</span>
                  </span>
                  {line ? <span className="muted">{line}</span> : null}
                  <span className="blacksky-other-foot">
                    <span className="muted">{cardinalPoint(place.bearingDeg)}</span>
                    <span className="blacksky-other-show">
                      {copy.SHOW_PLACE}
                      <svg className="hint-chevron" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
                        <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <button type="button" onClick={() => sheet.current?.close()}>
          {copy.CLOSE_OTHER_PLACES}
        </button>
      </dialog>
    </>
  );
}

/** The plain statement when the fix is vague or old, under the dial and never
 *  instead of it. The bare figure sits beside the distance, and opens what it
 *  means from there. */
function ConfidenceLines({ confidence }: { confidence: Confidence }) {
  return (
    <>
      {confidence.approximate ? (
        <p className="muted">{copy.GPS_APPROXIMATE(confidence.accuracyM)}</p>
      ) : null}
      {confidence.stale ? <p className="muted">{copy.FIX_AGE(confidence.ageS)}</p> : null}
    </>
  );
}

/** The reference screen for US1-AC2: saved information as text, no bearing
 *  figures. The state card above it says why. The places are set as on the
 *  pack page: one card each, the site in bold, then the suburb and the
 *  address. Under the heading and nothing else, as the dial carries no source
 *  line. A place that could not be saved says why in a state card. */
function ReferenceBody({ places }: { places: Destination[] }) {
  const sites = places.filter((place) => place.kind === 'nsp-bushfire');
  return (
    <>
      {sites.length > 0 ? (
        <section className="blacksky-saved-places">
          <h2 className="kicker">{copy.DESTINATIONS_STEP_TITLE}</h2>
          <ul className="list saved-destinations">
            {sites.map((place) => {
              const { site, line } = siteNameBlock(place.name ?? '');
              return (
                <li key={place.id} className="card">
                  {site ? <h3 className="nearby-place-name">{site}</h3> : null}
                  {line ? <p className="muted">{line}</p> : null}
                  {place.addressText ? <p className="muted">{place.addressText}</p> : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      {places.map((place) =>
        place.reason ? <StateCard key={place.id} heading={place.reason} /> : null,
      )}
    </>
  );
}
