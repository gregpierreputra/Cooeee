import { type KeyboardEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  AREA_MAP_HALF_KM,
  NEARBY_CLOCK_MS,
  NEARBY_FIX_MAX_AGE_MS,
  SEARCH_SHOW_MS,
  NEARBY_FIX_TIMEOUT_MS,
  NEARBY_MAP_PLACES,
  NEARBY_RESYNC_MS,
} from '../core/constants';
import { siteNameBlock } from '../core/blacksky-dial';
import * as copy from '../core/copy';
import DataSources from './components/DataSources';
import {
  hasNearbyData,
  nearbyView,
  nspsNear,
  parsePostcode,
  placeShareText,
  postcodeOrigin,
  type NearbyCache,
  type NearbyGroup,
  type NearbyRow,
  type NearbySession,
} from '../core/nearby';
import type { LatLon } from '../core/types';
import { readLocalitiesFile } from '../data/localities';
import { readNearbyCache, syncNearby } from '../data/nearby';
import { readRoadsFile } from '../data/roads';
import Glyph, { type GlyphKind } from './components/Glyph';
import Hint from './components/Hint';
import NearbyMap, { type MapLoaders } from './components/NearbyMap';
import KeyTerms from './components/KeyTerms';
import { shareOrCopy } from './components/shareOrCopy';
import StateCard from './components/StateCard';

/** Where distances are measured from: the line above the tabs, and its name
 *  in plain words for the middle of the map. */
type Origin = LatLon & { label: ReactNode; name: string };
/** The map's files, read from the phone's own cache only. */
const PRECACHED_FILES: MapLoaders = { loadRoads: readRoadsFile, loadLocalities: readLocalitiesFile };
type GroupKind = NearbyGroup['kind'];
const TABS: { kind: GroupKind; glyph: GlyphKind; label: string }[] = [
  { kind: 'bushfire', glyph: 'place', label: copy.TAB_BUSHFIRE },
  { kind: 'relief', glyph: 'relief', label: copy.TAB_RELIEF },
];
const NOTHING_SYNCED: NearbySession = { staticSyncedNow: false, dynamicSyncedNow: false };

/** Nearby places: the nearest official place of each kind, answered from
 *  IndexedDB whether or not there is a connection (spec §7).
 *
 *  The screen renders what is on the device first and refreshes in place when a
 *  sync succeeds — it never waits on the network. Nothing typed or measured
 *  here leaves the device: the only requests are the two parameterless syncs. */
export default function Nearby({
  now,
  fetcher,
  mapFiles = PRECACHED_FILES,
}: {
  now?: number;
  fetcher?: typeof fetch;
  mapFiles?: MapLoaders;
}) {
  const [cache, setCache] = useState<NearbyCache | null>(null);
  const [session, setSession] = useState(NOTHING_SYNCED);
  const [syncing, setSyncing] = useState(false);
  const [clock, setClock] = useState(() => now ?? Date.now());
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [postcode, setPostcode] = useState('');
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<GroupKind>('bushfire');
  // The map starts folded, so the list stays the first thing on the screen.
  const [mapOpen, setMapOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!navigator.onLine) return;
    setSyncing(true);
    try {
      const result = await syncNearby(fetcher);
      setSession((previous) => ({
        staticSyncedNow: previous.staticSyncedNow || result.staticSyncedNow,
        dynamicSyncedNow: previous.dynamicSyncedNow || result.dynamicSyncedNow,
      }));
      setCache(await readNearbyCache());
      setClock(now ?? Date.now());
    } catch {
      // A device store that refuses (blocked site data, some private modes)
      // leaves whatever is already on screen, and never the word syncing for good.
    } finally {
      setSyncing(false);
    }
  }, [fetcher, now]);

  // Device first, network second; then again whenever the app comes back to the
  // foreground or the browser reports a network (spec §7.4).
  useEffect(() => {
    let mounted = true;
    void readNearbyCache().then(
      (stored) => {
        if (!mounted) return;
        setCache(stored);
        void refresh();
      },
      // A store that cannot be read holds nothing to show, which is the screen's
      // own empty state. Left unhandled the screen stayed blank under its title.
      () => {
        if (mounted) setCache({ facilities: [], postcodes: [], activations: [], meta: {} });
      },
    );
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

  // Every search shows Searching… for at least SEARCH_SHOW_MS, so it is seen
  // to happen even when the phone answers at once. Each search gets a number;
  // an answer is shown only if no newer search has started since, so a slow
  // position can never replace a postcode typed after it. Leaving the screen
  // cancels the answer still waiting.
  const searchTimer = useRef<number | undefined>(undefined);
  const latestSearch = useRef(0);
  useEffect(() => () => clearTimeout(searchTimer.current), []);
  const answerAfter = (search: number, startedAt: number, answer: () => void) => {
    if (search !== latestSearch.current) return;
    clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(answer, Math.max(0, startedAt + SEARCH_SHOW_MS - Date.now()));
  };

  // GPS works without a data connection, so it is offered first; the postcode
  // is the fallback when a position cannot be read (spec §7.3).
  const locate = () => {
    if (!('geolocation' in navigator)) {
      setNotice(copy.LOCATION_FAILED);
      return;
    }
    const search = ++latestSearch.current;
    const startedAt = Date.now();
    setLocating(true);
    setNotice(copy.NEARBY_SEARCHING);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // The button is usable again whatever happens to this answer.
        setLocating(false);
        answerAfter(search, startedAt, () => {
          setNotice(null);
          setOrigin({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            label: copy.FROM_POSITION(copy.ACCURACY_READOUT(Math.round(position.coords.accuracy))),
            name: copy.NEARBY_MAP_POSITION,
          });
        });
      },
      () => {
        setLocating(false);
        answerAfter(search, startedAt, () => setNotice(copy.LOCATION_FAILED));
      },
      { enableHighAccuracy: true, timeout: NEARBY_FIX_TIMEOUT_MS, maximumAge: NEARBY_FIX_MAX_AGE_MS },
    );
  };

  // Searched as it is typed, like the address search when building a pack.
  // The lookup is on the phone, so it answers at the fourth digit with no wait.
  const findPostcode = (text: string) => {
    const search = ++latestSearch.current;
    setPostcode(text);
    clearTimeout(searchTimer.current);
    if (text.trim().length < 4) {
      setNotice(null);
      return;
    }
    const code = parsePostcode(text);
    if (code === null) {
      setNotice(copy.POSTCODE_INVALID);
      return;
    }
    setNotice(copy.NEARBY_SEARCHING);
    answerAfter(search, Date.now(), () => {
      if (!cache || cache.postcodes.length === 0) {
        setNotice(copy.POSTCODES_NOT_DOWNLOADED);
        return;
      }
      const point = postcodeOrigin(cache, code);
      if (point === null) {
        setNotice(copy.POSTCODE_UNKNOWN(code));
        return;
      }
      setNotice(null);
      setOrigin({
        ...point,
        name: copy.NEARBY_MAP_POSTCODE(code),
        label: (
          <>
            {copy.FROM_POSTCODE} <span className="nearby-origin-code">{code}</span>
          </>
        ),
      });
    });
  };

  const ready = cache !== null && hasNearbyData(cache);
  const view = ready && origin ? nearbyView(clock, origin, cache, session) : null;
  const group = view?.groups.find((each) => each.kind === tab);

  // Left and Right move between the two tabs, as the tab pattern expects.
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const next = tab === 'bushfire' ? 'relief' : 'bushfire';
    setTab(next);
    document.getElementById(`nearby-tab-${next}`)?.focus();
  };

  return (
    <main className="page nearby">
      <div className="hero">
        <span className="kicker">{copy.NEARBY_KICKER}</span>
        <h1>{copy.NEARBY_TITLE}</h1>
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
          <section className="nearby-locate">
            {/* The pack builder's search: one polite line above the field, then
                the field with the Use my location ring beside it. */}
            <p id="nearby-postcode-status" className="muted search-hint" role="status" aria-live="polite">
              {notice ?? copy.POSTCODE_LABEL}
            </p>
            <div className="search-row">
              <input
                id="nearby-postcode"
                type="search"
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={4}
                value={postcode}
                aria-label={copy.POSTCODE_LABEL}
                aria-describedby="nearby-postcode-status"
                onChange={(event) => findPostcode(event.target.value)}
              />
              <button
                type="button"
                className="info-ring search-locate"
                aria-label={locating ? copy.LOCATING : copy.USE_MY_LOCATION}
                onClick={locate}
                disabled={locating}
              >
                <Glyph kind="locate" line />
              </button>
            </div>
          </section>

          {view && origin ? (
            <>
              {/* Where the distances are measured from, with how to read them
                  tucked beneath as its footnote. */}
              <div className="nearby-origin">
                <p className="caveat">{origin.label}</p>
                <p className="muted"><KeyTerms text={copy.DISTANCES_NOTE} /> {copy.NOT_A_RANKING}</p>
              </div>
              <div className="nearby-tabs" role="tablist" aria-label={copy.NEARBY_TABS_LABEL}>
                {TABS.map((each) => (
                  <button
                    key={each.kind}
                    id={`nearby-tab-${each.kind}`}
                    type="button"
                    role="tab"
                    aria-selected={tab === each.kind}
                    aria-controls="nearby-panel"
                    tabIndex={tab === each.kind ? 0 : -1}
                    onClick={() => setTab(each.kind)}
                    onKeyDown={onTabKey}
                  >
                    <Glyph kind={each.glyph} line />
                    {each.label}
                  </button>
                ))}
              </div>
              {group ? (
                // Keyed by the tab, so its notes and data sources start closed
                // whenever the tab changes.
                <section
                  key={tab}
                  id="nearby-panel"
                  className="nearby-group"
                  role="tabpanel"
                  aria-labelledby={`nearby-tab-${tab}`}
                >
                  {/* The heading beside the ring already names the note, so its
                      panel has no title. */}
                  <Hint label={copy.ABOUT_GROUP(group.heading)} head={<h2>{group.heading}</h2>} titled={false}>
                    <p>{group.note}</p>
                  </Hint>
                  {/* The bushfire tab's nearest few places on a map, folded until asked for. */}
                  {tab === 'bushfire' && cache ? (
                    <div className="nearby-map-toggle">
                      <button type="button" className="hint-text" aria-expanded={mapOpen} onClick={() => setMapOpen((open) => !open)}>
                        {copy.NEARBY_MAP_SHOW}
                        <svg className="hint-chevron" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
                          <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      {mapOpen ? (
                        <NearbyMap
                          origin={origin}
                          originName={origin.name}
                          loaders={mapFiles}
                          places={nspsNear(cache.facilities, origin, NEARBY_MAP_PLACES, AREA_MAP_HALF_KM * 1000).map(({ row, distanceM }) => ({
                            id: `nsp-${row.facility_id}`,
                            name: row.name,
                            lat: row.lat,
                            lon: row.lon,
                            distanceM,
                          }))}
                        />
                      ) : null}
                    </div>
                  ) : null}
                  <ul className="list">
                    {group.rows.map((row) => (
                      <PlaceRow key={row.type} row={row} />
                    ))}
                  </ul>
                  {/* This tab's own sources. */}
                  <DataSources lines={group.sources} />
                </section>
              ) : null}
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
  const [shared, setShared] = useState<'copied' | 'unavailable' | null>(null);
  const share = async () => {
    const result = await shareOrCopy(placeShareText(row));
    if (result === 'copied' || result === 'unavailable') setShared(result);
  };
  // The official name set as BlackSky sets it: the site in bold, and the town
  // with any bracketed detail on the line beneath. Nothing is dropped but the
  // closing words the card's label already says.
  const name = row.place ? siteNameBlock(row.place.name) : null;
  return (
    <li className={row.state === 'cached' ? 'card card-stale' : 'card'}>
      <div className="nearby-row-head">
        <h3>{row.title}</h3>
        <span className={`state-pill state-${row.state}`}>
          <span className="state-dot" aria-hidden="true" />
          {row.stateLabel}
        </span>
      </div>
      {/* How current the card is: the date sits under the status, on every
          card, whether or not a place is listed. */}
      {row.timestamp ? <p className="muted figure nearby-stamp">{row.timestamp}</p> : null}
      {row.place ? (
        <div>
          {/* Only the site sits beside the distance; where it is and its
              address run the card's full width beneath. */}
          <div className="nearby-place">
            <p className="nearby-place-name">{name?.site}</p>
            <p className="figure nearby-distance with-glyph">
              <Glyph kind="go" line />
              {row.place.distance}
            </p>
          </div>
          {name?.line ? <p className="muted">{name.line}</p> : null}
          {row.place.address ? <p className="muted">{row.place.address}</p> : null}
        </div>
      ) : null}
      {/* An NSP's footer, set apart from the address: what the place is, and
          that no one will be there. */}
      {row.place?.about ? (
        <p className="nearby-about">
          {row.place.about.kind ? <span>{row.place.about.kind}</span> : null}
          <span className="muted">{row.place.about.note}</span>
        </p>
      ) : null}
      {row.note ? <p className="nearby-note">{row.note}</p> : null}
      {/* One place to send, say to meet there: never the sender's position. */}
      {row.place ? (
        <>
          <button type="button" className="action with-glyph nearby-share" onClick={() => void share()}>
            <Glyph kind="share" line />
            {copy.SHARE_PLACE}
            <span className="visually-hidden"> {row.place.name}</span>
          </button>
          <p className="muted place-note" role="status" aria-live="polite">
            {shared === 'copied' ? copy.COPIED_LINE : shared === 'unavailable' ? copy.SHARE_UNAVAILABLE : ''}
          </p>
        </>
      ) : null}
    </li>
  );
}
