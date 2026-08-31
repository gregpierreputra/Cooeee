import { useEffect, useState } from 'react';
import { deriveState, type Screen } from '../core/blacksky';
import { TICK_MS } from '../core/constants';
import * as copy from '../core/copy';
import { arrowGlyph, cardinalAbbr } from '../core/geo';
import type { Destination, Fix, Pack, PackWithPlaces } from '../core/types';
import { listCompletePacksWithPlaces } from '../data/db';
import StateCard from './components/StateCard';

export type BlackSkyProps = {
  loadPacks?: () => Promise<PackWithPlaces[]>;
};

/** The BlackSky screen. Every word on it comes from the local pack store; the
 *  ONLY other input is the device's own position sensor, and that reading never
 *  leaves the device. ESLint bans fetch and every network module in this file,
 *  so the zero-network guarantee is enforced, not promised. */
export default function BlackSky({ loadPacks = listCompletePacksWithPlaces }: BlackSkyProps) {
  const [packs, setPacks] = useState<PackWithPlaces[] | null>(null);
  const [fix, setFix] = useState<Fix | null>(null);
  const [permission, setPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let live = true;
    loadPacks().then((rows) => {
      if (live) setPacks(rows);
    });
    return () => {
      live = false;
    };
  }, [loadPacks]);

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setPermission('denied');
      return;
    }
    const watch = navigator.geolocation.watchPosition(
      (position) => {
        setPermission('granted');
        setFix({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracyM: Math.round(position.coords.accuracy),
          at: position.timestamp,
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) setPermission('denied');
      },
      { enableHighAccuracy: true },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, []);

  // Staleness is a function of the clock, so the clock must tick: without this,
  // a fix that stops arriving would stay trusted forever.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  if (packs === null) return null;

  return (
    <main className="page blacksky">
      <h1 className="blacksky-title">{copy.BLACKSKY_TITLE}</h1>
      <ScreenBody screen={deriveState(now, packs, fix, permission, null)} />
    </main>
  );
}

function ScreenBody({ screen }: { screen: Screen }) {
  switch (screen.kind) {
    case 'NO_PACK':
      return <StateCard heading={copy.NO_PACKS_YET} detail={copy.NO_PACKS_HINT} />;
    // AC2: no usable fix. AC3: a fix too vague to trust. Both degrade to the
    // same reference text — names, addresses and the reminder, WITHOUT an arrow
    // or a distance — and the state line says why. A designed state, not an
    // error: the next derivation with a good fix renders IN_AREA on its own.
    case 'ACQUIRING':
      return <ReferenceBody line={copy.NO_GPS} places={screen.places} pack={screen.pack} />;
    case 'LOW_ACCURACY':
      return (
        <ReferenceBody
          line={copy.GPS_TOO_INACCURATE(screen.accuracyM)}
          places={screen.places}
          pack={screen.pack}
        />
      );
    case 'OUT_OF_AREA':
      return <StateCard heading={copy.OUTSIDE_AREAS} />;
    case 'IN_AREA':
      return (
        <>
          <p className="muted">{copy.SORTED_BY_DISTANCE}</p>
          <ul className="list">
            {screen.places.map((place) => (
              <li key={place.d.id} className="blacksky-place">
                <h2>{place.d.name}</h2>
                <p className="figure blacksky-figure">
                  {copy.BEARING_FIGURE(
                    cardinalAbbr(place.bearingDeg),
                    arrowGlyph(place.bearingDeg),
                    copy.distanceLabel(place.distanceM),
                  )}
                </p>
              </li>
            ))}
          </ul>
          <p className="muted figure">{copy.ACCURACY_READOUT(screen.accuracyM)}</p>
          {screen.absence?.reason ? <p className="muted">{screen.absence.reason}</p> : null}
          {screen.pack.reminder ? (
            <p className="blacksky-reminder">{screen.pack.reminder}</p>
          ) : null}
        </>
      );
  }
}

/** The degraded screen shared by AC2 and AC3: saved information as reference
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
            {place.reason ? <p className="muted">{place.reason}</p> : null}
          </li>
        ))}
      </ul>
      {pack.reminder ? <p className="blacksky-reminder">{pack.reminder}</p> : null}
    </>
  );
}
