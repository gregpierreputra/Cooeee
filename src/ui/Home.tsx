import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import * as copy from '../core/copy';
import { homeView, titleCase, type HomeView } from '../core/home';
import type { Pack } from '../core/types';
import { deleteCompletePack, listCompletePacks } from '../data/db';
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

  // Deleting the pack takes two taps: the × swaps the card for a question, and
  // only the second destroys data. Keep restores the card untouched.
  const [confirming, setConfirming] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
  }, [confirming]);

  const removePack = async (id: string) => {
    await deleteCompletePack(id);
    setView(homeView(seed, await listCompletePacks()));
    setConfirming(false);
  };

  return (
    <main className="page home">
      {/* One preparation line under its own eyebrow, so it reads as the day's
          reminder rather than as an explanation of the app; beneath it, a line
          for the reader it was not written for, then the guidance it is drawn
          from. It says nothing about a particular place, and nothing about
          what is happening outside. */}
      {view === null ? null : (
        <section className="preparation">
          <span className="kicker">{copy.PREPARATION_LABEL}</span>
          <p>{view.preparation.text}</p>
          <p className="muted">{view.preparation.context}</p>
          <p className="muted preparation-source">{view.preparation.source}</p>
        </section>
      )}

      {view === null ? null : view.kind === 'no-pack' ? (
        <StateCard heading={copy.NO_PACK_SAVED} detail={copy.NO_PACKS_HINT} />
      ) : confirming ? (
        <section className="card">
          <p>{copy.DELETE_PACK_QUESTION}</p>
          <div className="card-confirm-actions">
            <button
              ref={cancelRef}
              type="button"
              className="card-confirm-no"
              onClick={() => setConfirming(false)}
            >
              {copy.KEEP_THIS_PACK}
            </button>
            <button
              type="button"
              className="card-confirm-yes"
              onClick={() => void removePack(view.pack.id)}
            >
              {copy.CONFIRM_DELETE_PACK}
            </button>
          </div>
        </section>
      ) : (
        <section className="card pack-card saved-place">
          <span className="kicker">{copy.SAVED_PLACE_LABEL}</span>
          <div className="saved-place-title">
            {/* Cased by the same rule as the address line below, so the two
                read alike: the name defaults to the locality the geocoder
                returned, and arrives in the same capitals. Storage keeps the
                name exactly as it was saved. The link stretches over the whole
                card (see .pack-card); the × sits above it. */}
            <h2>
              <Link to={`/packs/${view.pack.id}`}>{titleCase(view.pack.name)}</Link>
            </h2>
            <button
              type="button"
              className="card-delete"
              aria-label={copy.DELETE_PACK}
              onClick={() => setConfirming(true)}
            >
              ×
            </button>
          </div>
          {/* Title-cased for reading only. The pack still stores the address
              exactly as the custodian returned it. */}
          <p className="muted">{titleCase(view.pack.address)}</p>
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
        <HoldButton onHold={() => navigate('/blacksky')} hint={copy.HOLD_TO_ENTER}>
          <span className="blacksky-hold-label">{copy.HOLD_FOR_BLACKSKY}</span>
          <span className="blacksky-hold-sub">
            {view !== null && view.kind === 'pack'
              ? copy.BLACKSKY_SEPARATE_FROM_EVERYDAY
              : copy.BLACKSKY_WORKS_WITHOUT_PACK}
          </span>
        </HoldButton>
      </div>
    </main>
  );
}
