import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router';
import {
  deriveState,
  estimateFix,
  type Confidence,
  type Mark as PositionMark,
  type Placed,
  type Screen,
} from '../core/blacksky';
import { isBlackSkyLatched, latchBlackSky, unlatchBlackSky } from '../core/blacksky-latch';
import { TICK_MS } from '../core/constants';
import * as copy from '../core/copy';
import { cardinalPoint, magneticDeclinationDeg } from '../core/geo';
import type { Destination, Fix, NspSnapshot, Pack, PackWithPlaces } from '../core/types';
import { localFlagStore } from '../data/acknowledgement';
import { getNspSnapshot, listCompletePacksWithPlaces } from '../data/db';
import HoldButton from './components/HoldButton';
import { useCompass } from './components/useCompass';

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

  // US3-AC2, the power rule: GPS samples land in this ref (no render), and the
  // TICK_MS interval below is the ONE publisher to state — so the screen
  // updates at most once per tick, however often the sensor chatters. The
  // arrows still turn with the phone between ticks: that is CSS, not a render.
  const latestFix = useRef<Fix | null>(null);

  useEffect(() => {
    let live = true;
    loadPacks().then((rows) => {
      if (live) setPacks(rows);
    });
    loadSites().then((snapshot) => {
      if (live && snapshot) setSites(snapshot);
    });
    return () => {
      live = false;
    };
  }, [loadPacks, loadSites]);

  // The position watch and the screen wake lock, together. Browsers stop
  // delivering positions while the screen is locked or the app is in the
  // background, and some phones never resume a watch they paused: that is how
  // the distance figure froze during walking tests. So both are dropped when
  // the screen is hidden (no GPS and no lit screen for a page nobody is looking
  // at) and started fresh the moment it returns. The wake lock keeps the phone
  // from locking mid-walk, as a navigation app would; a phone that refuses it
  // (power saving mode, or no such API) still gets the restart.
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setPermission('denied');
      return;
    }
    let watch: number | null = null;
    let lock: WakeLockSentinel | null = null;

    const onPosition = (position: GeolocationPosition) => {
      latestFix.current = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        accuracyM: Math.round(position.coords.accuracy),
        // Receipt time, NOT position.timestamp: staleness is measured against
        // Date.now(), and some mobile engines report GPS timestamps from a
        // different clock. Mixing clock domains would break the 30 s rule.
        at: Date.now(),
      };
      setPermission('granted');
      setMark(null); // a real fix always beats a marked-position estimate
      // Acquiring → showing a direction IS a meaningful change, so the very
      // first fix renders immediately. Every later sample waits for the tick.
      setFix((previous) => previous ?? latestFix.current);
    };
    const onError = (error: GeolocationPositionError) => {
      if (error.code === error.PERMISSION_DENIED) setPermission('denied');
    };

    const wake = () => {
      if (watch !== null) return;
      // The most accurate continuous watch the device offers: high accuracy on,
      // and no cached position accepted in place of a fresh sensor read.
      watch = navigator.geolocation.watchPosition(onPosition, onError, {
        enableHighAccuracy: true,
        maximumAge: 0,
      });
      if (!('wakeLock' in navigator)) return;
      navigator.wakeLock.request('screen').then(
        (held) => {
          if (watch === null) void held.release(); // granted after sleep(): let it go
          else lock = held;
        },
        () => {},
      );
    };
    const sleep = () => {
      if (watch !== null) navigator.geolocation.clearWatch(watch);
      watch = null;
      void lock?.release();
      lock = null;
    };
    const onVisibility = () => {
      if (document.hidden) sleep();
      else wake();
    };

    document.addEventListener('visibilitychange', onVisibility);
    wake();
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      sleep();
    };
  }, []);

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

  if (packs === null) return null;

  const screen = estimate
    ? deriveState(now, packs, estimate, 'granted', sites)
    : deriveState(now, packs, fix, permission, sites);
  const hasArrows = screen.kind === 'IN_AREA' || ('nearby' in screen && screen.nearby.length > 0);
  const notes = packs.flatMap((pack) => pack.notes);

  return (
    <main className="page blacksky">
      <h1 className="kicker blacksky-title">{copy.BLACKSKY_TITLE}</h1>
      {/* Which way the arrows are to be read, and (iOS) the one tap that lets
          the orientation sensor turn them. Under the title, as the screen's mode. */}
      {hasArrows ? (
        <>
          <p className="muted">{compass.live ? copy.COMPASS_LIVE : copy.COMPASS_NORTH_UP}</p>
          {compass.needsPermission ? (
            <button type="button" onClick={() => void compass.enable()}>
              {copy.TURN_ON_COMPASS}
            </button>
          ) : null}
        </>
      ) : null}
      {packs?.some((p) => !p.placesVerified) ? (
        <p className="muted">{copy.PLACES_UNVERIFIED}</p>
      ) : null}
      <ScreenBody screen={screen} estimating={estimate !== null} onMark={setMark} />
      {/* The user's own notes, folded until asked for and read-only here: one
          tap opens them, each in its own ruled row at reading size. */}
      {notes.length > 0 ? (
        <details className="blacksky-notes">
          <summary>{copy.NOTES}</summary>
          <ul className="list">
            {notes.map((note) => (
              <li key={note.id} className="blacksky-place blacksky-note">
                {note.text}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {/* US3-AC1: one plainly named exit, full-width at thumb reach. Leaving
          demands the same deliberate 2s hold as entering, so a pocket press
          cannot silently drop the emergency screen. */}
      <div className="actions">
        {notice ? (
          <p className="muted blacksky-hold-hint" role="status">
            {notice}
          </p>
        ) : null}
        <HoldButton
          onHold={() => {
            unlatchBlackSky(localFlagStore());
            navigate('/', { replace: true });
          }}
          hint={copy.HOLD_TO_LEAVE}
        >
          {copy.LEAVE_BLACKSKY}
        </HoldButton>
      </div>
    </main>
  );
}

function ScreenBody({
  screen,
  estimating,
  onMark,
}: {
  screen: Screen;
  estimating: boolean;
  onMark: (mark: PositionMark) => void;
}) {
  switch (screen.kind) {
    // US2-AC2: no pack stored. Nothing is invented or borrowed: the nearest
    // official places on the stored CFA list are pointed at once there is a
    // fix, then the built-in preparation guidance and a reminder to build a
    // pack when next online (from the home screen, after the hold to leave).
    case 'NO_PACK':
      return (
        <>
          <p className="muted">{copy.NO_PACK_HERE}</p>
          <NearbyList places={screen.nearby} confidence={screen.confidence} />
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
    // with a fix draws the arrows on its own.
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
            {copy.MARK_AT_SAVED_PLACE(screen.pack.address)}
          </button>
        </>
      );
    // US2-AC1: outside every prepared area. The stored packs are offered by
    // name with the distance to their area's edge — informational rows, never
    // a bearing to an out-of-area point — then the nearest official places
    // from here, plus general official guidance.
    case 'OUT_OF_AREA':
      return (
        <>
          <p className="muted">{copy.OUTSIDE_AREAS}</p>
          <ul className="list">
            {screen.packs.map(({ pack, distanceKm }) => (
              <li key={pack.id} className="blacksky-place">
                <h2>{pack.name}</h2>
                <p className="muted figure">
                  {copy.AREA_DISTANCE_LINE(copy.distanceLabel(distanceKm * 1000))}
                </p>
              </li>
            ))}
          </ul>
          <NearbyList places={screen.nearby} confidence={screen.confidence} />
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
    case 'IN_AREA':
      return (
        <>
          <p className="muted">{copy.SORTED_BY_DISTANCE}</p>
          <ul className="list">
            {screen.places.map((place) => (
              <PlacedRow key={place.id} place={place} />
            ))}
          </ul>
          <NearbyList places={screen.nearby} />
          <ConfidenceLines confidence={screen.confidence} estimating={estimating} />
          {screen.absence?.reason ? <p className="muted">{screen.absence.reason}</p> : null}
          {screen.pack.reminder ? (
            <p className="blacksky-reminder">{screen.pack.reminder}</p>
          ) : null}
        </>
      );
  }
}

/** One place: the compass on the left — the arrow at arm's-length size, the
 *  distance and compass point beneath it — and the place it points at on the
 *  right. The arrow is one solid shape (the mockups' triangle and stem) so its
 *  size never depends on a font glyph. It carries its bearing as a CSS
 *  variable; the stylesheet turns it against the phone's heading. */
function PlacedRow({ place }: { place: Placed }) {
  return (
    <li className="blacksky-place blacksky-pointed">
      <div className="blacksky-compass">
        <svg
          className="blacksky-arrow"
          viewBox="0 0 100 130"
          aria-hidden="true"
          style={{ '--bearing': place.bearingDeg } as CSSProperties}
        >
          <path d="M50 0 100 55 H70 V130 H30 V55 H0 Z" />
        </svg>
        <span className="blacksky-figure-main">{copy.distanceLabel(place.distanceM)}</span>
        <span className="blacksky-figure-point">{cardinalPoint(place.bearingDeg)}</span>
      </div>
      <div className="blacksky-target">
        <h2>{place.name}</h2>
        <p className="muted">{copy.PLACE_DESCRIPTOR(place.publisher)}</p>
      </div>
    </li>
  );
}

/** The accuracy readout, and beside it — never instead of the arrows — the
 *  plain statement when the fix is vague or old. */
function ConfidenceLines({
  confidence,
  estimating,
}: {
  confidence: Confidence;
  estimating: boolean;
}) {
  return (
    <>
      <p className="muted figure">
        {estimating
          ? copy.ESTIMATE_READOUT(confidence.accuracyM)
          : copy.ACCURACY_READOUT(confidence.accuracyM)}
      </p>
      {!estimating && confidence.approximate ? (
        <p className="muted">{copy.GPS_APPROXIMATE(confidence.accuracyM)}</p>
      ) : null}
      {!estimating && confidence.stale ? (
        <p className="muted">{copy.FIX_AGE(confidence.ageS)}</p>
      ) : null}
    </>
  );
}

/** The nearest official places on the state-wide list, from the live fix.
 *  Nothing when there is no fix or no stored list. The confidence lines travel
 *  with it on the screens that have no other figure to hang them on. */
function NearbyList({ places, confidence }: { places: Placed[]; confidence?: Confidence }) {
  if (places.length === 0) return null;
  return (
    <section className="blacksky-nearby">
      <span className="kicker">{copy.NEAREST_OFFICIAL_PLACES}</span>
      <p className="muted">{copy.SORTED_BY_DISTANCE}</p>
      <ul className="list">
        {places.map((place) => (
          <PlacedRow key={place.id} place={place} />
        ))}
      </ul>
      {confidence ? <ConfidenceLines confidence={confidence} estimating={false} /> : null}
    </section>
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
