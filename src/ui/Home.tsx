import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import * as copy from '../core/copy';
import { homeView, titleCase, type HomeView } from '../core/home';
import { readKept } from '../core/kept';
import { unsavedKept } from '../core/recover';
import { localFlagStore } from '../data/acknowledgement';
import { deleteCompletePack, listCompletePacks, listSavedProgramIds } from '../data/db';
import { syncKeptIntoPacks } from '../data/pack-programs';
import Glyph from './components/Glyph';
import Hint from './components/Hint';
import HoldButton from './components/HoldButton';
import { focusMain } from './components/focusMain';

/** E1-US2-AC6 — where someone who set up a place some time ago lands when they
 *  open Cooeee again.
 *
 *  Every saved pack, newest first, each card the way into its pack; then the
 *  control that builds one more, and the BlackSky control with the ring that
 *  says what BlackSky is. It reads IndexedDB, asks for no position, and makes
 *  no request other than a kept program's page copy from the precache. */
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

  // E4-US7-AC4: the kept programs no saved pack carries yet, for the amber
  // nudge line in the empty card. Read with the packs on every arrival, so
  // coming back from Recover shows the current count.
  const [unsaved, setUnsaved] = useState(0);
  const load = async () => {
    const kept = readKept(localFlagStore());
    // Every saved pack mirrors the kept list first, so a program kept since the
    // last visit is in the packs before anything here is counted. The one
    // request this can make is a page copy, served from the precache.
    await syncKeptIntoPacks(kept).catch(() => {});
    const [rows, saved] = await Promise.all([listCompletePacks(), listSavedProgramIds()]);
    return { rows, unsaved: unsavedKept(kept, saved).length };
  };

  useEffect(() => {
    let live = true;
    // The cards come straight from the store; the sync below can wait on a
    // page copy, and the screen must not stay empty for it. The nudge waits for
    // the sync, so it never counts a program that is about to be carried.
    listCompletePacks().then(
      (rows) => {
        if (live) setView((shown) => shown ?? homeView(seed, rows));
      },
      () => {},
    );
    load().then(
      (loaded) => {
        if (!live) return;
        setView(homeView(seed, loaded.rows));
        setUnsaved(loaded.unsaved);
      },
      // A store that cannot be read must not leave a blank screen: it renders
      // as if nothing were saved, the same way BlackSky does.
      () => {
        if (live) setView(homeView(seed, []));
      },
    );
    return () => {
      live = false;
    };
  }, [seed]);

  // A pack's settings open in one bottom sheet from the ... on its card. The
  // browser's own dialog gives Escape, a focus trap and focus back to the ...
  // on close. Deleting takes two taps: Delete this pack asks, and only Delete
  // destroys data.
  const sheet = useRef<HTMLDialogElement>(null);
  const [settings, setSettings] = useState<{ id: string; name: string; ageLine: string } | null>(null);
  const [asking, setAsking] = useState(false);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (settings) sheet.current?.showModal();
  }, [settings]);
  // Focus follows the question: onto Keep it when it appears, back to Delete
  // this pack when it is answered with Keep it.
  useEffect(() => {
    (asking ? cancelRef : deleteRef).current?.focus();
  }, [asking]);

  const removePack = async (id: string) => {
    await deleteCompletePack(id);
    // The pack is gone: the sheet closes and the card goes, even if the list
    // cannot be read again straight away.
    sheet.current?.close();
    setView((current) => current && { ...current, packs: current.packs.filter((row) => row.pack.id !== id) });
    // The card and its ... have gone, so focus goes to the page.
    focusMain();
    const loaded = await load();
    setView(homeView(seed, loaded.rows));
    setUnsaved(loaded.unsaved);
  };
  // A delete that fails closes the question and leaves the pack as it was. A
  // list that cannot be read again after a delete keeps the card already removed.
  const removePackSafely = (id: string) => removePack(id).catch(() => setAsking(false));

  return (
    <main className="page home">
      {/* One preparation line under its own eyebrow, with the guidance it is
          drawn from; the line for a reader it was not written for waits behind
          the ring. It says nothing about a particular place, and nothing about
          what is happening outside. */}
      {view === null ? null : (
        <section className="preparation">
          <span className="kicker">{copy.PREPARATION_LABEL}</span>
          <p>{view.preparation.text}</p>
          <Hint
            label={copy.PREPARATION_MORE}
            head={<p className="muted preparation-source">{view.preparation.source}</p>}
          >
            <p>{view.preparation.context}</p>
          </Hint>
        </section>
      )}

      {view === null ? null : view.packs.length === 0 ? (
        <section className="card empty-state">
          <Glyph kind="layer" />
          <h2>{copy.NO_PACK_SAVED}</h2>
          <p className="muted">{copy.NO_PACKS_HINT}</p>
          {/* The nudge, one amber line in the same card: saved programs are
              one more reason to build. The New offline pack button below is
              the one way to act on it. */}
          {unsaved > 0 ? (
            <p className="nudge key-term with-glyph">
              <Glyph kind="kept" line />
              {copy.KEPT_NOT_SAVED(unsaved)}
            </p>
          ) : null}
        </section>
      ) : (
        view.packs.map(({ pack, ageLine }) => (
            <section key={pack.id} className="card pack-card saved-place">
              {/* The pack's settings, top right inside the card, above the
                  card's link. */}
              <button
                type="button"
                className="card-more"
                aria-label={copy.PACK_SETTINGS(titleCase(pack.name))}
                aria-haspopup="dialog"
                onClick={() => setSettings({ id: pack.id, name: pack.name, ageLine })}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
                  <circle cx="5" cy="12" r="2" fill="currentColor" />
                  <circle cx="12" cy="12" r="2" fill="currentColor" />
                  <circle cx="19" cy="12" r="2" fill="currentColor" />
                </svg>
              </button>
              <div className="saved-place-title">
                <Glyph kind="place" />
                {/* Cased by the same rule as the address line below, so the two
                    read alike: the name defaults to the locality the geocoder
                    returned, and arrives in the same capitals. Storage keeps the
                    name exactly as it was saved. The link stretches over the
                    whole card (see .pack-card). */}
                <h2>
                  <Link to={`/packs/${pack.id}`}>{titleCase(pack.name)}</Link>
                </h2>
              </div>
              {/* Title-cased for reading only. The pack still stores the address
                  exactly as the custodian returned it. */}
              <p className="muted">{titleCase(pack.address)}</p>
              <p className="muted figure saved-place-footer with-glyph">
                <Glyph kind="offline" line />
                {ageLine}
              </p>
            </section>
        ))
      )}

      <dialog
        ref={sheet}
        className="sheet"
        aria-labelledby="pack-sheet-title"
        onClose={() => {
          setSettings(null);
          setAsking(false);
        }}
      >
        {settings ? (
          <>
            <h2 id="pack-sheet-title">{titleCase(settings.name)}</h2>
            <p className="muted figure">{settings.ageLine}</p>
            {asking ? (
              <>
                <p>{copy.DELETE_PACK_QUESTION}</p>
                <div className="card-confirm-actions">
                  <button ref={cancelRef} type="button" className="card-confirm-no" onClick={() => setAsking(false)}>
                    {copy.KEEP_THIS_PACK}
                  </button>
                  <button
                    type="button"
                    className="card-confirm-yes with-glyph"
                    onClick={() => void removePackSafely(settings.id)}
                  >
                    <Glyph kind="trash" line />
                    {copy.CONFIRM_DELETE_PACK}
                  </button>
                </div>
              </>
            ) : (
              <button ref={deleteRef} type="button" className="sheet-delete with-glyph" onClick={() => setAsking(true)}>
                <Glyph kind="trash" line />
                {copy.DELETE_PACK}
              </button>
            )}
            <button type="button" onClick={() => sheet.current?.close()}>
              {copy.CLOSE}
            </button>
          </>
        ) : null}
      </dialog>

      <div className="actions">
        {/* One more pack, in every state: the list grows from here. */}
        <Link className="action main-action with-glyph" to="/packs/new">
          <Glyph kind="plus" line />
          {copy.BUILD_A_PACK}
        </Link>
        {/* Reachable in both states, including with no pack saved. The ring to
            its left opens the lines that say what the mode is. */}
        <BlackSkyHoldRow>
          <HoldButton onHold={() => navigate('/blacksky', { state: { held: true } })} hint={copy.HOLD_TO_ENTER}>
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

/** The hold control with the information ring to its left and, after a tap
 *  on the ring, the panel that says what BlackSky does, one glyph per line. */
function BlackSkyHoldRow({ children }: { children: ReactNode }) {
  return (
    <Hint
      className="blacksky-hold-row"
      ringClass="blacksky-info"
      panelClass="blacksky-info-panel"
      label={copy.ABOUT_BLACKSKY}
      head={children}
    >
      <ul className="info-lines glyph-lines">
        {copy.BLACKSKY_INFO_LINES.map((line) => (
          <li key={line.glyph}>
            <Glyph kind={line.glyph} line />
            {line.text}
          </li>
        ))}
      </ul>
    </Hint>
  );
}
