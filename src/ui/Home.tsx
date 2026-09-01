import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import * as copy from '../core/copy';
import { displayAddress, homeView, titleCase, type HomeView } from '../core/home';
import type { Pack } from '../core/types';
import { listCompletePacks } from '../data/db';
import BottomNav from './components/BottomNav';
import HoldButton from './components/HoldButton';
import StateCard from './components/StateCard';

/** E1-US2-AC6 — where someone who set up a place some time ago lands when they
 *  open Cooeee again.
 *
 *  One pack or none: it is opened, or it is built, and never both. Without
 *  scrolling or tapping the screen carries the saved place, its age, the way
 *  into the pack and the BlackSky control. It reads IndexedDB and nothing else:
 *  no request is made here in any state, and no position is asked for. */
export default function Home({ now }: { now?: number }) {
  // null = the store has not answered yet.
  // It answers in a frame or two from local IndexedDB, and
  // a spinner would be a promise about a wait that isn't happening, so nothing is drawn for it.
  const [view, setView] = useState<HomeView | null>(null);
  const navigate = useNavigate();

  // Captured once, at mount: the preparation line is chosen from whole days, so
  // it is fixed for the life of the screen and does not reshuffle when the user
  // navigates away and comes back.
  const [seed] = useState(() => now ?? Date.now());

  useEffect(() => {
    let live = true;
    listCompletePacks().then((rows: Pack[]) => {
      if (live) setView(homeView(seed, rows));
    });
    return () => {
      live = false;
    };
  }, [seed]);

  return (
    <main className="page home">
      {/* One preparation line under its own eyebrow, so it reads as the day's
          reminder rather than as an explanation of the app, with the guidance
          it is drawn from credited beneath it. It says nothing about a
          particular place, and nothing about what is happening outside. */}
      {view === null ? null : (
        <section className="preparation">
          <span className="kicker">{copy.PREPARATION_LABEL}</span>
          <p>{view.preparation.text}</p>
          <p className="muted preparation-source">{view.preparation.source}</p>
        </section>
      )}

      {view === null ? null : view.kind === 'no-pack' ? (
        <StateCard heading={copy.NO_PACK_SAVED} detail={copy.NO_PACKS_HINT} />
      ) : (
        <section className="card saved-place">
          <span className="kicker">{copy.SAVED_PLACE_LABEL}</span>
          <div className="saved-place-title">
            {/* Cased by the same rule as the address line below, so the two
                read alike: the name defaults to the locality the geocoder
                returned, and arrives in the same capitals. Storage keeps the
                name exactly as it was saved. */}
            <h2>{titleCase(view.pack.name)}</h2>
            {/* The way in is the 'Open' action below; this only points at it,
                so it is hidden from the screen reader rather than read out as
                a second, wordless control. */}
            <span className="saved-place-chevron" aria-hidden="true">
              ›
            </span>
          </div>
          {/* Title-cased for reading only. The pack still stores the address
              exactly as the custodian returned it. */}
          <p className="muted">{displayAddress(view.pack.address)}</p>
          <p className="muted figure saved-place-footer">
            {view.ageLine}
            {copy.OPENS_WITHOUT_SIGNAL}
          </p>
        </section>
      )}

      <div className="actions">
        {view !== null && view.kind === 'no-pack' ? (
          <Link className="action main-action" to="/packs/new">
            {copy.BUILD_A_PACK}
          </Link>
        ) : null}
        {view !== null && view.kind === 'pack' ? (
          <Link className="action main-action" to={`/packs/${view.pack.id}`}>
            {copy.OPEN_PACK}
          </Link>
        ) : null}
        {/* Reachable in both states, including with no pack saved. */}
        <HoldButton
          label={copy.HOLD_FOR_BLACKSKY}
          hasPack={view !== null && view.kind === 'pack'}
          onHold={() => navigate('/blacksky')}
        />
      </div>

      {view === null ? null : <BottomNav items={view.nav} />}
    </main>
  );
}
