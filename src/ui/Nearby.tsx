import { type FormEvent, useCallback, useEffect, useState } from 'react';
import {
  NEARBY_CLOCK_MS,
  NEARBY_FIX_MAX_AGE_MS,
  NEARBY_FIX_TIMEOUT_MS,
  NEARBY_RESYNC_MS,
} from '../core/constants';
import * as copy from '../core/copy';
import {
  hasNearbyData,
  nearbyView,
  parsePostcode,
  postcodeOrigin,
  type NearbyCache,
  type NearbyRow,
  type NearbySession,
} from '../core/nearby';
import type { LatLon } from '../core/types';
import { readNearbyCache, syncNearby } from '../data/nearby';
import StateCard from './components/StateCard';

type Origin = LatLon & { label: string };
const NOTHING_SYNCED: NearbySession = { staticSyncedNow: false, dynamicSyncedNow: false };

/** Nearby places: the nearest official place of each kind, answered from
 *  IndexedDB whether or not there is a connection (spec §7).
 *
 *  The screen renders what is on the device first and refreshes in place when a
 *  sync succeeds — it never waits on the network. Nothing typed or measured
 *  here leaves the device: the only requests are the two parameterless syncs. */
export default function Nearby({ now, fetcher }: { now?: number; fetcher?: typeof fetch }) {
  const [cache, setCache] = useState<NearbyCache | null>(null);
  const [session, setSession] = useState(NOTHING_SYNCED);
  const [syncing, setSyncing] = useState(false);
  const [clock, setClock] = useState(() => now ?? Date.now());
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [postcode, setPostcode] = useState('');
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!navigator.onLine) return;
    setSyncing(true);
    const result = await syncNearby(fetcher);
    setSession((previous) => ({
      staticSyncedNow: previous.staticSyncedNow || result.staticSyncedNow,
      dynamicSyncedNow: previous.dynamicSyncedNow || result.dynamicSyncedNow,
    }));
    setCache(await readNearbyCache());
    setClock(now ?? Date.now());
    setSyncing(false);
  }, [fetcher, now]);

  // Device first, network second; then again whenever the app comes back to the
  // foreground or the browser reports a network (spec §7.4).
  useEffect(() => {
    let mounted = true;
    void readNearbyCache().then((stored) => {
      if (!mounted) return;
      setCache(stored);
      void refresh();
    });
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const onOnline = () => void refresh();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    const tick = setInterval(() => setClock(now ?? Date.now()), NEARBY_CLOCK_MS);
    const resync = setInterval(() => void refresh(), NEARBY_RESYNC_MS);
    return () => {
      mounted = false;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      clearInterval(tick);
      clearInterval(resync);
    };
  }, [refresh, now]);

  // GPS works without a data connection, so it is offered first; the postcode
  // is the fallback when a position cannot be read (spec §7.3).
  const locate = () => {
    if (!('geolocation' in navigator)) {
      setNotice(copy.LOCATION_FAILED);
      return;
    }
    setLocating(true);
    setNotice(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        setOrigin({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          label: copy.FROM_POSITION(copy.ACCURACY_READOUT(Math.round(position.coords.accuracy))),
        });
      },
      () => {
        setLocating(false);
        setNotice(copy.LOCATION_FAILED);
      },
      { enableHighAccuracy: true, timeout: NEARBY_FIX_TIMEOUT_MS, maximumAge: NEARBY_FIX_MAX_AGE_MS },
    );
  };

  const findPostcode = (event: FormEvent) => {
    event.preventDefault();
    const code = parsePostcode(postcode);
    if (code === null) {
      setNotice(copy.POSTCODE_INVALID);
      return;
    }
    const point = cache ? postcodeOrigin(cache, code) : null;
    if (point === null) {
      setNotice(copy.POSTCODE_UNKNOWN(code));
      return;
    }
    setNotice(null);
    setOrigin({ ...point, label: copy.FROM_POSTCODE(code) });
  };

  const ready = cache !== null && hasNearbyData(cache);
  const view = ready && origin ? nearbyView(clock, origin, cache, session) : null;

  return (
    <main className="page nearby">
      <div className="hero">
        <span className="kicker">{copy.NEARBY_KICKER}</span>
        <h1>{copy.NEARBY_TITLE}</h1>
        <p className="muted">{copy.NEARBY_LEDE}</p>
      </div>

      {/* Nothing is drawn until IndexedDB has answered — a frame or two. */}
      {cache === null ? null : !ready ? (
        // A fresh install with nothing downloaded is an expected state with its
        // own words, never a blank screen (spec §7.5).
        <StateCard
          heading={syncing ? copy.DOWNLOADING_PLACES : copy.FIRST_RUN_TITLE}
          detail={syncing ? undefined : copy.FIRST_RUN_LINE}
        />
      ) : (
        <>
          <section className="card nearby-locate">
            <button type="button" className="main-action" onClick={locate} disabled={locating}>
              {locating ? copy.LOCATING : copy.USE_MY_LOCATION}
            </button>
            <form className="nearby-postcode" onSubmit={findPostcode}>
              <label htmlFor="nearby-postcode">{copy.POSTCODE_LABEL}</label>
              <div className="postcode-row">
                <input
                  id="nearby-postcode"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  maxLength={4}
                  value={postcode}
                  onChange={(event) => setPostcode(event.target.value)}
                />
                <button type="submit">{copy.FIND_POSTCODE}</button>
              </div>
            </form>
            {notice ? (
              <p className="muted" role="status">
                {notice}
              </p>
            ) : null}
          </section>

          {view && origin ? (
            <>
              <p className="caveat">{origin.label}</p>
              <p className="muted">{copy.DISTANCES_NOTE}</p>
              {view.groups.map((group) => (
                <section key={group.heading} className="nearby-group">
                  <h2>{group.heading}</h2>
                  <p className="muted">{group.note}</p>
                  <ul className="list">
                    {group.rows.map((row) => (
                      <PlaceRow key={row.type} row={row} />
                    ))}
                  </ul>
                </section>
              ))}
              <section className="nearby-health">
                <span className="kicker">{copy.DATA_SOURCES_LABEL}</span>
                {view.health.map((line) => (
                  <p key={line} className="figure">
                    {line}
                  </p>
                ))}
              </section>
            </>
          ) : null}
        </>
      )}
    </main>
  );
}

/** One facility type. Each row carries its own state word and timestamp, so a
 *  live static place and a cached relief centre can never read as equals. */
function PlaceRow({ row }: { row: NearbyRow }) {
  return (
    <li className={row.state === 'cached' ? 'card card-stale' : 'card'}>
      <div className="nearby-row-head">
        <h3>{row.title}</h3>
        <span className={`state-pill state-${row.state}`}>
          <span className="state-dot" aria-hidden="true" />
          {row.stateLabel}
        </span>
      </div>
      {row.place ? (
        <div className="nearby-place">
          <div>
            <p className="nearby-place-name">{row.place.name}</p>
            {row.place.address ? <p className="muted">{row.place.address}</p> : null}
          </div>
          <p className="figure nearby-distance">{row.place.distance}</p>
        </div>
      ) : null}
      {row.timestamp ? <p className="muted figure">{row.timestamp}</p> : null}
      {row.note ? <p>{row.note}</p> : null}
    </li>
  );
}
