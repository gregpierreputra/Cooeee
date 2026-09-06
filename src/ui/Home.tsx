import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
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
 *  Every saved pack, newest first, each card the way into its pack; then the
 *  control that builds one more, and the BlackSky control with the ring that
 *  says what BlackSky is. It reads IndexedDB and nothing else: no request is
 *  made here in any state, and no position is asked for. */
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

  // Deleting a pack takes two taps: the delete control swaps that pack's card
  // for a question, and only the second destroys data. Keep restores the card
  // untouched. The id names which card is asking.
  const [confirming, setConfirming] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
  }, [confirming]);

  const removePack = async (id: string) => {
    await deleteCompletePack(id);
    setView(homeView(seed, await listCompletePacks()));
    setConfirming(null);
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

      {view === null ? null : view.packs.length === 0 ? (
        <StateCard heading={copy.NO_PACK_SAVED} detail={copy.NO_PACKS_HINT} />
      ) : (
        view.packs.map(({ pack, ageLine }) =>
          confirming === pack.id ? (
            <section key={pack.id} className="card">
              <p>{copy.DELETE_PACK_QUESTION}</p>
              <div className="card-confirm-actions">
                <button
                  ref={cancelRef}
                  type="button"
                  className="card-confirm-no"
                  onClick={() => setConfirming(null)}
                >
                  {copy.KEEP_THIS_PACK}
                </button>
                <button
                  type="button"
                  className="card-confirm-yes"
                  onClick={() => void removePack(pack.id)}
                >
                  {copy.CONFIRM_DELETE_PACK}
                </button>
              </div>
            </section>
          ) : (
            <section key={pack.id} className="card pack-card saved-place">
              <span className="kicker">{copy.SAVED_PLACE_LABEL}</span>
              <div className="saved-place-title">
                {/* Cased by the same rule as the address line below, so the two
                    read alike: the name defaults to the locality the geocoder
                    returned, and arrives in the same capitals. Storage keeps the
                    name exactly as it was saved. The link stretches over the
                    whole card (see .pack-card); the delete control sits above it. */}
                <h2>
                  <Link to={`/packs/${pack.id}`}>{titleCase(pack.name)}</Link>
                </h2>
                <button
                  type="button"
                  className="card-delete"
                  aria-label={copy.DELETE_PACK}
                  onClick={() => setConfirming(pack.id)}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
                    <path
                      d="M7 7l10 10M17 7 7 17"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
              {/* Title-cased for reading only. The pack still stores the address
                  exactly as the custodian returned it. */}
              <p className="muted">{titleCase(pack.address)}</p>
              <p className="muted figure saved-place-footer">
                {ageLine}
                {copy.OPENS_WITHOUT_SIGNAL}
              </p>
            </section>
          ),
        )
      )}

      <div className="actions">
        {/* One more pack, in every state: the list grows from here. */}
        <Link className="action main-action" to="/packs/new">
          {copy.BUILD_A_PACK}
        </Link>
        {/* Reachable in both states, including with no pack saved. The ring to
            its left opens the lines that say what the mode is. */}
        <BlackSkyHoldRow>
          <HoldButton onHold={() => navigate('/blacksky')} hint={copy.HOLD_TO_ENTER}>
            <span className="blacksky-hold-label">{copy.HOLD_FOR_BLACKSKY}</span>
            {view !== null && view.packs.length === 0 ? (
              <span className="blacksky-hold-sub">{copy.BLACKSKY_WORKS_WITHOUT_PACK}</span>
            ) : null}
          </HoldButton>
        </BlackSkyHoldRow>
      </div>
    </main>
  );
}

/** The hold control with the information ring to its left and, while the ring
 *  is hovered with a mouse or after a tap on it, the panel that says what
 *  BlackSky is. The panel opens in flow beneath the pair (see
 *  .blacksky-hold-row), so it covers nothing. The bottom-anchored actions block
 *  can shift up by the panel's height when the screen has room to spare, so the
 *  hover ends only when the pointer leaves the whole row: the shift lands the
 *  pointer on the panel, never outside. A tap pins the panel open; hover is
 *  mouse only, so a phone tap cannot count twice. */
function BlackSkyHoldRow({ children }: { children: ReactNode }) {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const open = pinned || hovered;
  const hover = (event: PointerEvent<HTMLElement>, value: boolean) => {
    if (event.pointerType === 'mouse') setHovered(value);
  };

  return (
    <div className="blacksky-hold-row" onPointerLeave={(event) => hover(event, false)}>
      <button
        type="button"
        className="blacksky-info"
        aria-label={copy.ABOUT_BLACKSKY}
        aria-expanded={open}
        onClick={() => setPinned((value) => !value)}
        onPointerEnter={(event) => hover(event, true)}
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          aria-hidden="true"
          focusable="false"
        >
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 11v5.5" />
          <circle cx="12" cy="7.75" r="1" fill="currentColor" stroke="none" />
        </svg>
      </button>
      {children}
      {open ? (
        <section className="blacksky-info-panel">
          <span className="kicker">{copy.ABOUT_BLACKSKY}</span>
          <ul>
            {copy.BLACKSKY_INFO_LINES.map((line) => (
              <li key={line.lead}>
                <b>{line.lead}</b> {line.text}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
