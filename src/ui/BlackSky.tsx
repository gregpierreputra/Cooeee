import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
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
  splitSiteName,
  type DialLabel,
  type DialModel,
  type PositionTrust,
} from '../core/blacksky-dial';
import {
  isBlackSkyLatched,
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
  FIX_PUBLISH_M,
  FIX_STALE_MS,
  TICK_MS,
  VOICE_CHECK_MS,
  WATCH_RESTART_MS,
} from '../core/constants';
import * as copy from '../core/copy';
import { cardinalPoint, distanceM, magneticDeclinationDeg } from '../core/geo';
import { titleCase } from '../core/home';
import type { Destination, Fix, NspSnapshot, Pack, PackWithPlaces } from '../core/types';
import { localFlagStore } from '../data/acknowledgement';
import { getNspSnapshot, listCompletePacksWithPlaces } from '../data/db';
import BlackSkyDial from './components/BlackSkyDial';
import HoldButton from './components/HoldButton';
import { currentRun } from './Rehearsal/run-state';
import { useCompass } from './components/useCompass';
import { useVoice } from './components/useVoice';
import { useWakeLock } from './components/useWakeLock';

type BlackSkyProps = {
  loadPacks?: () => Promise<PackWithPlaces[]>;
  loadSites?: () => Promise<NspSnapshot | undefined>;
};

/** The BlackSky screen. Every word on it comes from the local pack store and the
 *  locally stored CFA site list; the ONLY other inputs are the device's own
 *  position and orientation sensors, and those readings never leave the device.
 *  ESLint bans fetch and every network module in this file, so the zero-network
 *  guarantee is enforced, not promised. */
export default function BlackSky({
  loadPacks = listCompletePacksWithPlaces,
  loadSites = getNspSnapshot,
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
  // Latched before this mount means the app brought the person back here (a
  // relaunch, a reload, or a return from another site), which is worth saying.
  const [notice, setNotice] = useState(() =>
    isBlackSkyLatched(localFlagStore()) ? copy.BLACKSKY_RESUMED : null,
  );

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
  // and waits for the TICK_MS interval below, so a phone held still renders
  // once per tick. The dial turns with the phone by CSS, not by a render.
  const latestFix = useRef<Fix | null>(null);

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
    loadSites().then((snapshot) => {
      if (live && snapshot) setSites(snapshot);
    });
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
      latestFix.current = next;
      // Straight to the compass hook, every sample, without a render: above
      // walking speed this is what turns the dial.
      setMovement(next.headingDeg, next.speedMps);
      setPermission('granted');
      setMark(null); // a real fix always beats a marked-position estimate
      // The first fix, and every real move after it, renders immediately.
      setFix((shown) => (!shown || distanceM(shown, next) >= FIX_PUBLISH_M ? next : shown));
    };
    const onError = (error: GeolocationPositionError) => {
      if (error.code === error.PERMISSION_DENIED) setPermission('denied');
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
      watchdog = setInterval(() => {
        if (watch === null || Date.now() - heardAt < WATCH_RESTART_MS) return;
        navigator.geolocation.clearWatch(watch);
        startWatch();
      }, WATCH_RESTART_MS);
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
  // old), and publishing both in one place keeps renders to one per tick.
  useEffect(() => {
    const timer = setInterval(() => {
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
  // person is moving. The speed of an old position says nothing about now, so
  // it does not count. Released on Leave, because Leave unmounts this screen.
  const speedMps = fix && now - fix.at <= FIX_STALE_MS ? fix.speedMps : undefined;
  useWakeLock(shouldStayAwake(voiceOn, speedMps));

  if (packs === null) return null;

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

  // BS_Enhancement-AC1 and AC2. deriveState says what can be pointed at; the
  // dial rules pick the one main place and say how far to trust the position.
  const model = dialModel(screen, shownId);
  const confidence = 'confidence' in screen ? screen.confidence : undefined;
  const trust = confidence ? positionTrust(confidence, estimate !== null) : null;
  voiceInput.current =
    model && trust
      ? {
          placeId: model.first.id,
          site: splitSiteName(model.first.name).site,
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
        // The error of the position, stated beside the figure it qualifies. A
        // marked position keeps E3-US1-AC4's own words: always ESTIMATE, and
        // the uncertainty growing.
        readout={
          estimate
            ? copy.ESTIMATE_READOUT(estimate.accuracyM)
            : copy.ACCURACY_READOUT(confidence!.accuracyM)
        }
        compass={compass}
        // Unavailable: no speech on this phone, so no button is drawn at all.
        voice={
          voice.available ? { on: voiceOn, caption: voice.caption, toggle: toggleVoice } : null
        }
        onShow={setShownId}
      />
    ) : trust ? (
      // Empty: a position, and nothing stored that can be pointed at.
      <p className="muted">{copy.NO_PLACE_TO_POINT_AT}</p>
    ) : null;
  // The person's own notes, read-only here. Beside the dial they stand open,
  // readable without a tap; on the no-fix reference screen they stay folded
  // until asked for, as that screen was built.
  const notesBlock =
    notes.length > 0 ? (
      <details className="blacksky-notes" open={model !== null}>
        <summary>{copy.NOTES}</summary>
        <ul className="list">
          {notes.map((note) => (
            <li key={note.id} className="blacksky-place blacksky-note">
              {note.text}
            </li>
          ))}
        </ul>
      </details>
    ) : null;

  return (
    <main className="page blacksky">
      {/* The top bar: the mode's name, and the one way out at its right-hand end.
          US3-AC1: leaving demands the same deliberate 2s hold as entering, so a
          pocket press cannot silently drop the emergency screen.
          The control used to be a full-width bar at the foot of the screen, at
          thumb reach. It moved up here because the foot of the screen is worth
          more to the person than to the exit: that is where the other places
          and their own notes are read. A top corner is easier to brush by
          accident than the foot, but it is the 2s hold, not the position, that
          guards a pocket press, and the hold is unchanged: the same HoldButton,
          the same fill, the same hint. The bar stands clear of the top edge of
          the phone (see .blacksky in the stylesheet), where the system's own
          pull-down lives.
          The hint, and the notice that says why BlackSky is still open, are
          laid out UNDER the bar by the stylesheet. Appearing there they push
          the page down, never the button: a hint that moved the button would
          slide it out from under the finger that is holding it.
          E5-US3-AC3: a rehearsal that is running is where she came from, so
          leaving goes back to it, not to Home.
          ponytail: a cold start inside BlackSky loses the in-memory run and
          leaves to Home; the kept rehearsal is asked about on the pack's next
          visit. Upgrade path: look the unfinished row up on leave. */}
      <header className="blacksky-topbar">
        <h1 className="kicker blacksky-title">{copy.BLACKSKY_TITLE}</h1>
        <HoldButton
          onHold={() => {
            unlatchBlackSky(localFlagStore());
            const run = currentRun();
            navigate(run ? `/rehearse/${run.packId}` : '/', { replace: true });
          }}
          hint={copy.HOLD_TO_LEAVE}
        >
          {copy.LEAVE_BLACKSKY}
        </HoldButton>
        {notice ? (
          <p className="muted blacksky-hold-hint" role="status">
            {notice}
          </p>
        ) : null}
      </header>
      {/* Several packs: which one to load, asked at the top of the screen and
          left there so the choice can be changed. Full-width targets for wet
          hands; the chosen one is filled. */}
      {packs.length > 1 ? (
        <section className="blacksky-picker">
          <span className="kicker">{copy.CHOOSE_PACK}</span>
          <p className="muted">{copy.CHOOSE_PACK_HINT}</p>
          <ul className="list">
            {packs.map(({ pack }) => (
              <li key={pack.id}>
                <button
                  type="button"
                  className="blacksky-pack"
                  aria-pressed={pack.id === chosen?.pack.id}
                  onClick={() => choosePack(pack.id)}
                >
                  <span>{titleCase(pack.name)}</span>
                  <span className="blacksky-pack-address">{titleCase(pack.address)}</span>
                  {from && distanceM(from, pack) <= pack.radiusKm * 1000 ? (
                    <span className="blacksky-pack-here">{copy.PACK_COVERS_HERE}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </section>
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
      {chosen && !chosen.placesVerified ? (
        <p className="muted">{copy.PLACES_UNVERIFIED}</p>
      ) : null}
      {screen.kind === 'NO_PACK' && packs.length > 0 ? (
        // Several packs and none chosen yet: only the dial to the nearest
        // official place, from the position, until one is chosen.
        from ? (
          <>
            {dial}
            {screen.confidence ? <ConfidenceLines confidence={screen.confidence} /> : null}
          </>
        ) : (
          <p className="muted">{copy.NO_GPS_YET}</p>
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
    </main>
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
          <p className="muted">{copy.NO_PACK_HERE}</p>
          {dial}
          {screen.confidence ? <ConfidenceLines confidence={screen.confidence} /> : null}
          <p className="muted">{copy.NO_PACKS_HINT}</p>
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
          <ReferenceBody line={copy.NO_GPS} places={screen.places} pack={screen.pack} />
          {/* US1-AC4: the mark control. Offered for every ACQUIRING reason —
              someone who denied GPS is exactly who needs it. */}
          <p className="muted">{copy.MARK_HINT}</p>
          <button
            type="button"
            onClick={() =>
              onMark({ lat: screen.pack.lat, lon: screen.pack.lon, at: Date.now() })
            }
          >
            {copy.MARK_AT_SAVED_PLACE(titleCase(screen.pack.address))}
          </button>
          {notes}
        </>
      );
    // US2-AC1: outside the loaded pack's area. The pack is named with the
    // distance to its area's edge — an informational row, never a bearing to
    // an out-of-area point — then the dial to the nearest official place from
    // here, the notes, and general official guidance with its two phone links.
    case 'OUT_OF_AREA':
      return (
        <>
          <p className="muted">{copy.OUTSIDE_AREAS}</p>
          <ul className="list">
            {screen.packs.map(({ pack, distanceKm }) => (
              <li key={pack.id} className="blacksky-place">
                <h2>{titleCase(pack.name)}</h2>
                <p className="muted figure">
                  {copy.AREA_DISTANCE_LINE(copy.distanceLabel(distanceKm * 1000))}
                </p>
              </li>
            ))}
          </ul>
          {dial}
          {notes}
          <ConfidenceLines confidence={screen.confidence} />
          <section className="card blacksky-guidance">
            <h2>{copy.GENERAL_GUIDANCE_TITLE}</h2>
            <a href="tel:000">{copy.CALL_TRIPLE_ZERO}</a>
            <a href="tel:1800226226">{copy.VICEMERGENCY_HOTLINE}</a>
            <p>{copy.EMERGENCY_BROADCASTER}</p>
            <p className="muted">{copy.PHONE_MAY_WORK}</p>
            <p>{copy.OFFICIAL_INSTRUCTIONS_FIRST}</p>
          </section>
        </>
      );
    // Inside the loaded pack's area: the card's order. The dial and the notes
    // come first, so the glance and the person's own words fit one screen; the
    // figures and lines EPIC 3 put here follow them, unchanged.
    case 'IN_AREA':
      return (
        <>
          {dial}
          {notes}
          {estimating ? null : <ConfidenceLines confidence={screen.confidence} />}
          {screen.absence?.reason ? <p className="muted">{screen.absence.reason}</p> : null}
          {screen.pack.reminder ? (
            <p className="blacksky-reminder">{screen.pack.reminder}</p>
          ) : null}
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
  readout,
  compass,
  voice,
  onShow,
}: {
  model: DialModel;
  trust: PositionTrust;
  readout: string;
  compass: { live: boolean; needsPermission: boolean; enable: () => Promise<void> };
  voice: { on: boolean; caption: string | null; toggle: () => void } | null;
  onShow: (id: string) => void;
}) {
  const { first, label, others } = model;
  const { site, suburb } = splitSiteName(first.name);
  const distance = copy.distanceLabel(first.distanceM);
  const point = cardinalPoint(first.bearingDeg);
  return (
    <section className="blacksky-dial-body">
      <div className="blacksky-dial-head">
        <span className="kicker">{DIAL_LABELS[label]}</span>
        <h2>{site}</h2>
        {suburb ? <p className="muted">{suburb}</p> : null}
      </div>
      {/* BS_Enhancement-AC2: a figure from an old, vague or estimated position
          is dimmed and says "about", so it never looks more certain than it is. */}
      <p className="blacksky-dial-figures" data-about={trust.about ? 'true' : 'false'}>
        <span className="blacksky-dial-distance">
          {trust.about ? <span className="blacksky-dial-about">{copy.ABOUT}</span> : null}
          <span className="blacksky-figure-main figure">{distance}</span>
        </span>
        <span className="blacksky-dial-beside">
          <span className="blacksky-figure-point">{point}</span>
          {/* The short "± 10 m" sits under the point; a marked position's
              longer sentence takes the full width below. */}
          <span className="blacksky-dial-readout muted figure" data-long={trust.bar === 'mark'}>
            {readout}
          </span>
        </span>
      </p>
      {/* Nothing is turning the dial: it is drawn north up and says so, in the
          corner the ring leaves free, so the tag costs the screen no height. */}
      <div className="blacksky-dial-frame">
        <BlackSkyDial
          bearingDeg={first.bearingDeg}
          centre={dialCentre(trust)}
          description={copy.DIAL_DESCRIPTION(site, distance, point)}
        />
        {compass.live ? null : <span className="blacksky-tag">{copy.NORTH_UP}</span>}
        {/* BS_Enhancement-AC3: the speaker button, outlined when off and filled
            when on. It sits in the frame's other free corner, under the
            compass point and beside the distance: at 56 px a long figure and a
            long point leave no room on the distance's own line. */}
        {voice ? (
          <button
            type="button"
            className="blacksky-speaker"
            aria-pressed={voice.on}
            aria-label={copy.VOICE_BUTTON}
            onClick={voice.toggle}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" />
              <path className="waves" d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" />
            </svg>
          </button>
        ) : null}
        {/* Everything spoken is also shown (WCAG 1.2.1): exactly the words, over
            the foot of the dial, for as long as they are being said. Not a live
            region: a screen reader would say them on top of the voice. */}
        {voice?.caption ? <p className="blacksky-caption">{voice.caption}</p> : null}
      </div>
      {/* On an iPhone that is usually because the compass has not been allowed
          yet, which is one tap. */}
      {!compass.live && compass.needsPermission ? (
        <button type="button" onClick={() => void compass.enable()}>
          {copy.TURN_ON_COMPASS}
        </button>
      ) : null}
      {others.length > 0 ? <OtherPlaces places={others} onShow={onShow} /> : null}
    </section>
  );
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
      {/* Never cut off: a distance that ends in "…" is a distance not given.
          Where the line does not fit (a 360 px phone), the distances drop under
          the count. The words, read through, are unchanged: the count, then
          each distance behind a separator (the same string as
          copy.OTHER_PLACES). */}
      <button type="button" className="blacksky-others" onClick={() => sheet.current?.showModal()}>
        <span className="blacksky-others-line">
          <span className="blacksky-others-flow">
            <span className="blacksky-others-count">{copy.OTHER_PLACES_COUNT(places.length)}</span>
            <span className="blacksky-others-distances">
              {places.map((place) => (
                <span key={place.id} className="blacksky-others-distance">
                  <span className="blacksky-others-separator">{copy.PLACES_SEPARATOR}</span>
                  {copy.distanceLabel(place.distanceM)}
                </span>
              ))}
            </span>
          </span>
        </span>
      </button>
      <dialog ref={sheet} className="blacksky-sheet" aria-labelledby={titleId}>
        <h2 id={titleId}>{copy.OTHER_PLACES_TITLE}</h2>
        <p className="caveat">{copy.SORTED_BY_DISTANCE}</p>
        <ul className="list">
          {places.map((place) => {
            const { site, suburb } = splitSiteName(place.name);
            return (
              <li key={place.id} className="blacksky-place blacksky-other">
                <div>
                  <h3>{site}</h3>
                  {suburb ? <p className="muted">{suburb}</p> : null}
                  <p className="figure">
                    {copy.distanceLabel(place.distanceM)} · {cardinalPoint(place.bearingDeg)}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={copy.SHOW_PLACE_NAMED(site)}
                  onClick={() => {
                    sheet.current?.close();
                    onShow(place.id);
                  }}
                >
                  {copy.SHOW_PLACE}
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
 *  instead of it. The accuracy figure itself sits beside the distance. */
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
 *  figures, with one line saying why. */
function ReferenceBody({
  line,
  places,
  pack,
}: {
  line: string;
  places: Destination[];
  pack: Pack;
}) {
  return (
    <>
      <p className="muted">{line}</p>
      <ul className="list">
        {places.map((place) => (
          <li key={place.id} className="blacksky-place">
            {place.name ? <h2>{place.name}</h2> : null}
            {place.addressText ? <p className="muted">{place.addressText}</p> : null}
            {place.kind === 'nsp-bushfire' ? (
              <p className="muted">{copy.PLACE_DESCRIPTOR(place.source.publisher)}</p>
            ) : null}
            {place.reason ? <p className="muted">{place.reason}</p> : null}
          </li>
        ))}
      </ul>
      {pack.reminder ? <p className="blacksky-reminder">{pack.reminder}</p> : null}
    </>
  );
}
