import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  deriveState,
  estimateFix,
  type Mark as PositionMark,
  type Placed,
  type Screen,
} from '../core/blacksky';
import { TICK_MS } from '../core/constants';
import * as copy from '../core/copy';
import { arrowGlyph, cardinalAbbr } from '../core/geo';
import type { Destination, Fix, NspSnapshot, Pack, PackWithPlaces } from '../core/types';
import { getNspSnapshot, listCompletePacksWithPlaces } from '../data/db';
import HoldButton from './components/HoldButton';

type BlackSkyProps = {
  loadPacks?: () => Promise<PackWithPlaces[]>;
  loadSites?: () => Promise<NspSnapshot | undefined>;
};

/** The BlackSky screen. Every word on it comes from the local pack store and the
 *  locally stored CFA site list; the ONLY other input is the device's own
 *  position sensor, and that reading never leaves the device. ESLint bans fetch
 *  and every network module in this file, so the zero-network guarantee is
 *  enforced, not promised. */
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

  // US3-AC2, the power rule: GPS samples land in this ref (no render), and the
  // TICK_MS interval below is the ONE publisher to state — so the screen
  // updates at most once per tick, however often the sensor chatters.
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

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setPermission('denied');
      return;
    }

    const watch = navigator.geolocation.watchPosition(
      (position) => {
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
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) setPermission('denied');
      },
      // maximumAge lets the OS hand back a recent cached position instead of
      // forcing a fresh sensor read. High accuracy stays on: without it, coarse
      // cell-tower fixes would keep the arrow permanently withheld by the
      // ACCURACY_MAX_M gate.
      { enableHighAccuracy: true, maximumAge: TICK_MS },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, []);

  // The tick: publishes the clock AND the newest fix together, once per
  // TICK_MS. Staleness needs the clock to move (a fix that stops arriving must
  // stop being trusted), and publishing both in one place keeps renders to one
  // per tick.
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
      setFix(latestFix.current);
    }, TICK_MS);
    return () => clearInterval(timer);
  }, []);

  if (packs === null) return null;

  // US1-AC4: with no usable fix, a marked position stands in for one. estimateFix
  // returns null once its growing uncertainty passes the confidence threshold,
  // which drops the screen back to ACQUIRING — the AC2 reference state. While
  // an estimate is active it substitutes the fix entirely, so the GPS
  // permission state no longer decides.
  const estimate = mark ? estimateFix(mark, now) : null;
  const screen = estimate
    ? deriveState(now, packs, estimate, 'granted', sites)
    : deriveState(now, packs, fix, permission, sites);

  return (
    <main className="page blacksky">
      <h1 className="kicker blacksky-title">{copy.BLACKSKY_TITLE}</h1>
      <ScreenBody screen={screen} estimating={estimate !== null} onMark={setMark} />
      {/* US3-AC1: one plainly named exit, full-width at thumb reach. Leaving
          demands the same deliberate 2s hold as entering, so a pocket press
          cannot silently drop the emergency screen. */}
      <div className="actions">
        <HoldButton onHold={() => navigate('/')} hint={copy.HOLD_TO_LEAVE}>
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
    // official places on the stored CFA list are pointed at when the fix
    // allows, then the built-in preparation guidance and a prompt to build a
    // pack for when next online.
    case 'NO_PACK':
      return (
        <>
          <p className="muted">{copy.NO_PACK_HERE}</p>
          <NearbyList places={screen.nearby} accuracyM={screen.accuracyM} />
          <p className="muted">{copy.NO_PACKS_HINT}</p>
          <Link className="action" to="/packs/new">
            {copy.BUILD_A_PACK}
          </Link>
          <section className="card blacksky-guidance">
            <h2>{copy.PREPARATION_GUIDANCE_TITLE}</h2>
            <p>{copy.PREP_KIT_LINE}</p>
            <p>{copy.PREP_PLAN_LINE}</p>
          </section>
        </>
      );
    // US1-AC2: no usable fix. US1-AC3: a fix too vague to trust. Both degrade
    // to the same reference text — names, addresses and the reminder, WITHOUT an arrow
    // or a distance — and the state line says why. A designed state, not an
    // error: the next derivation with a good fix renders IN_AREA on its own.
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
    case 'LOW_ACCURACY':
      return (
        <ReferenceBody
          line={copy.GPS_TOO_INACCURATE(screen.accuracyM)}
          places={screen.places}
          pack={screen.pack}
        />
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
          <NearbyList places={screen.nearby} accuracyM={screen.accuracyM} />
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
          <p className="muted figure">
            {estimating
              ? copy.ESTIMATE_READOUT(screen.accuracyM)
              : copy.ACCURACY_READOUT(screen.accuracyM)}
          </p>
          {screen.absence?.reason ? <p className="muted">{screen.absence.reason}</p> : null}
          {screen.pack.reminder ? (
            <p className="blacksky-reminder">{screen.pack.reminder}</p>
          ) : null}
        </>
      );
  }
}

/** One place with the mega figure: arrow and distance at arm's-length size,
 *  the compass point beneath. Same information as copy.BEARING_FIGURE,
 *  recomposed for scale. */
function PlacedRow({ place }: { place: Placed }) {
  return (
    <li className="blacksky-place">
      <h2>{place.name}</h2>
      <p className="figure blacksky-figure">
        <span className="blacksky-figure-main">
          <span aria-hidden="true">{arrowGlyph(place.bearingDeg)}</span>{' '}
          {copy.distanceLabel(place.distanceM)}
        </span>
        <span className="blacksky-figure-point">{cardinalAbbr(place.bearingDeg)}</span>
      </p>
      <p className="muted">{copy.PLACE_DESCRIPTOR(place.publisher)}</p>
    </li>
  );
}

/** The nearest official places on the state-wide list, from the live fix.
 *  Nothing when there is no usable fix or no stored list. The accuracy readout
 *  travels with it on the screens that have no other figure to hang it on. */
function NearbyList({ places, accuracyM }: { places: Placed[]; accuracyM?: number }) {
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
      {typeof accuracyM === 'number' ? (
        <p className="muted figure">{copy.ACCURACY_READOUT(accuracyM)}</p>
      ) : null}
    </section>
  );
}

/** The degraded screen shared by US1-AC2 and US1-AC3: saved information as reference
 *  text, no bearing figures, with one line saying why. */
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
