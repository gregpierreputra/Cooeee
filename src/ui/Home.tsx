import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { HOLD_MS } from '../core/constants';
import * as copy from '../core/copy';
import { freshness } from '../core/pack';
import type { Pack } from '../core/types';
import { listCompletePacks } from '../data/db';
import StateCard from './components/StateCard';

export default function Home() {
  // null = the store has not answered yet. 
  // It answers in a frame or two from local IndexedDB, and 
  // a spinner would be a promise about a wait that isn't happening, so nothing is drawn for it.
  const [packs, setPacks] = useState<Pack[] | null>(null);
  const navigate = useNavigate();

  // BlackSky opens on a HOLD, not a tap: a pocket press must not switch the
  // phone into an emergency screen. 
  // The timer lives in a ref, and any release or exit before HOLD_MS cancels it. 
  // A cut-short press earns only the small "hold to enter" hint
  // A completed hold gets a confirmation buzz where the device supports one (iOS does not — there, the pressed colour fill is the
  // cue) and then enters the mode.
  const [showHoldHint, setShowHoldHint] = useState(false);
  const holdTimer = useRef<number | null>(null);
  const clearHold = () => {
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  // Once shown, the hint stays until the mode is actually entered (navigating
  // unmounts this screen). Removing it when a press starts would shift the
  // layout UNDER the active press, slide the button out from beneath the
  // finger, and fire pointerleave — silently cancelling the very hold the
  // hint taught.

  const startHold = () => {
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null;
      if ('vibrate' in navigator) navigator.vibrate(100);
      navigate('/blacksky');
    }, HOLD_MS);
  };

  const releaseHold = () => {
    if (holdTimer.current !== null) {
      clearHold();
      setShowHoldHint(true);
    }
  };

  useEffect(() => clearHold, []);

  useEffect(() => {
    let live = true;
    listCompletePacks().then((rows) => {
      if (live) setPacks(rows);
    });
    return () => {
      live = false;
    };
  }, []);

  const now = Date.now();

  return (
    <main className="page">
      <header className="hero">
        <span className="kicker">{copy.APP_NAME}</span>
        <h1>{copy.HOME_TITLE}</h1>
      </header>

      {packs === null ? null : packs.length === 0 ? (
        <StateCard heading={copy.NO_PACKS_YET} detail={copy.NO_PACKS_HINT} />
      ) : (
        // Stored order. The packs are equals: nothing here ranks them, and the
        // first entry gets no visual weight.
        <ul className="list">
          {packs.map((p) => (
            <li key={p.id} className="card pack-card">
              <h2><Link to={`/packs/${p.id}`}>{p.name}</Link></h2>
              <p className="muted">{p.address}</p>
              <p className="muted figure">{freshness(now, p.verifiedAt).label}</p>
            </li>
          ))}
        </ul>
      )}

      <div className="actions">
        <Link className="action main-action" to="/packs/new">
          {copy.BUILD_A_PACK}
        </Link>
        <button
          type="button"
          className="blacksky-hold"
          onPointerDown={startHold}
          onPointerUp={releaseHold}
          onPointerLeave={releaseHold}
          onPointerCancel={releaseHold}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) startHold();
          }}
          onKeyUp={releaseHold}
        >
          {copy.HOLD_FOR_BLACKSKY}
        </button>
        {showHoldHint ? (
          <p className="muted blacksky-hold-hint" role="status">
            {copy.HOLD_TO_ENTER}
          </p>
        ) : null}
      </div>
    </main>
  );
}