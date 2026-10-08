import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import * as copy from '../core/copy';
import { homeView, shownPackName, titleCase, type HomeView } from '../core/home';
import { readKept } from '../core/kept';
import { unsavedKept } from '../core/recover';
import { localFlagStore } from '../data/acknowledgement';
import { PACK_NAME_MAX_CHARS } from '../core/constants';
import { packAgeLabel, packIcon } from '../core/pack';
import type { PackIcon } from '../core/types';
import {
  deleteCompletePack,
  listCompletePacks,
  listSavedProgramIds,
  PackNameTakenError,
  renamePack,
  setPackIcon,
} from '../data/db';
import { syncKeptIntoPacks } from '../data/pack-programs';
import Glyph from './components/Glyph';
import Hint from './components/Hint';
import IconPicker from './components/IconPicker';
import { focusMain } from './components/focusMain';
import { useMinuteClock } from './components/useMinuteClock';

/** E1-US2-AC6 — where someone who set up a place some time ago lands when they
 *  open Cooeee again.
 *
 *  Every saved pack, newest first, each card the way into its pack; then the
 *  control that builds one more. BlackSky is held from the compass in the tab
 *  bar, on every screen. It reads IndexedDB, asks for no position, and makes
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
  // Each pack's age moves on with the clock while Home stays open.
  const clock = useMinuteClock(now);

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

  // A pack's settings open in one bottom sheet from the ... on its card: a
  // short menu of rows, then Rename's form or Delete's question in its place.
  // The browser's own dialog gives Escape, a focus trap and focus back to the
  // ... on close. It opens on the close cross, never on Delete. Deleting takes
  // two taps: Delete this pack asks, and only Delete destroys data.
  const sheet = useRef<HTMLDialogElement>(null);
  const [settings, setSettings] = useState<{ id: string; name: string; icon: PackIcon; verifiedAt: number } | null>(null);
  const [step, setStep] = useState<'menu' | 'rename' | 'icon' | 'delete'>('menu');
  const [iconDraft, setIconDraft] = useState<PackIcon>('place');
  const [iconFailed, setIconFailed] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  // Why the last save did not go through, or null.
  const [renameError, setRenameError] = useState<string | null>(null);
  const renameRowRef = useRef<HTMLButtonElement>(null);
  const iconRowRef = useRef<HTMLButtonElement>(null);
  const deleteRowRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const lastStep = useRef(step);
  useEffect(() => {
    if (settings && !sheet.current?.open) sheet.current?.showModal();
  }, [settings]);
  // Focus follows the step: into the name field or onto Keep it when they
  // appear, and back to the row that opened them when the person returns.
  useEffect(() => {
    if (step === 'rename') nameRef.current?.focus();
    else if (step === 'icon') sheet.current?.querySelector<HTMLInputElement>('.icon-picker input:checked')?.focus();
    else if (step === 'delete') cancelRef.current?.focus();
    else if (lastStep.current === 'rename') renameRowRef.current?.focus();
    else if (lastStep.current === 'icon') iconRowRef.current?.focus();
    else if (lastStep.current === 'delete') deleteRowRef.current?.focus();
    lastStep.current = step;
  }, [step]);

  const startRename = () => {
    setNameDraft(settings?.name ?? '');
    setRenameError(null);
    setStep('rename');
  };
  const startIcon = () => {
    setIconDraft(settings?.icon ?? 'place');
    setIconFailed(false);
    setStep('icon');
  };
  // A saved icon closes the sheet onto the card, as a saved name does.
  const saveIcon = async (event: FormEvent) => {
    event.preventDefault();
    if (!settings) return;
    try {
      await setPackIcon(settings.id, iconDraft);
    } catch {
      setIconFailed(true);
      return;
    }
    setView((current) => current && {
      ...current,
      packs: current.packs.map((row) => (row.pack.id === settings.id ? { ...row, pack: { ...row.pack, icon: iconDraft } } : row)),
    });
    sheet.current?.close();
  };

  // A saved name closes the sheet onto the card, which shows the new name at
  // once; focus returns to the card's ..., now named for it. Only the name
  // changes, so the list keeps its order and nothing is read again.
  const saveName = async (event: FormEvent) => {
    event.preventDefault();
    if (!settings) return;
    const name = nameDraft.trim();
    try {
      await renamePack(settings.id, name);
    } catch (error) {
      setRenameError(error instanceof PackNameTakenError ? copy.PACK_NAME_TAKEN : copy.PACK_NAME_NOT_SAVED);
      return;
    }
    setView((current) => current && {
      ...current,
      packs: current.packs.map((row) => (row.pack.id === settings.id ? { ...row, pack: { ...row.pack, name } } : row)),
    });
    sheet.current?.close();
  };

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
  const removePackSafely = (id: string) => removePack(id).catch(() => setStep('menu'));

  return (
    <main className="page home">
      {/* A greeting by the hour, the page's heading, which moves on with the
          clock and reads into the eyebrow as one line. Then one preparation
          line, with the guidance it is drawn from; the line for a reader it
          was not written for waits behind the toggle. It says nothing about a
          particular place, and nothing about what is happening outside. */}
      {view === null ? null : (
        <section className="preparation">
          <div className="preparation-head">
            <h1 className="kicker">{copy.GREETING(new Date(clock).getHours())},</h1>{' '}
            <span className="kicker">{copy.PREPARATION_LABEL}</span>
          </div>
          <p>{view.preparation.text}</p>
          <Hint
            label={copy.PREPARATION_MORE}
            asText
            titled={false}
            head={<p className="muted preparation-source">{view.preparation.source}</p>}
          >
            <p>{view.preparation.context}</p>
          </Hint>
        </section>
      )}

      {/* The packs under their own eyebrow, set like Today's reminder, with
          their count and space above. No count when there are none. */}
      {view === null ? null : (
        <span className="kicker packs-title">
          {copy.YOUR_PACKS}
          {view.packs.length > 0 ? <span className="packs-count">{view.packs.length}</span> : null}
        </span>
      )}

      {view === null ? null : view.packs.length === 0 ? (
        // The space the packs will fill, drawn dashed so it reads as empty
        // rather than as a card. The New offline pack button below fills it.
        <section className="empty-state">
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
        view.packs.map(({ pack }) => (
            <section key={pack.id} className="card pack-card saved-place">
              {/* The pack's settings, top right inside the card, above the
                  card's link. */}
              <button
                type="button"
                className="card-more"
                aria-label={copy.PACK_SETTINGS(shownPackName(pack.name))}
                aria-haspopup="dialog"
                onClick={() => setSettings({ id: pack.id, name: pack.name, icon: packIcon(pack), verifiedAt: pack.verifiedAt })}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
                  <circle cx="5" cy="12" r="2" fill="currentColor" />
                  <circle cx="12" cy="12" r="2" fill="currentColor" />
                  <circle cx="19" cy="12" r="2" fill="currentColor" />
                </svg>
              </button>
              <div className="saved-place-title">
                <Glyph kind={packIcon(pack)} />
                {/* Cased by the same rule as the address line below, so the two
                    read alike: the name defaults to the locality the geocoder
                    returned, and arrives in the same capitals. Storage keeps the
                    name exactly as it was saved. The link stretches over the
                    whole card (see .pack-card). */}
                <h2 className="pack-name">
                  <Link to={`/packs/${pack.id}`}>{shownPackName(pack.name)}</Link>
                </h2>
              </div>
              {/* Title-cased for reading only. The pack still stores the address
                  exactly as the custodian returned it. */}
              <p className="muted">{titleCase(pack.address)}</p>
              <p className="muted figure saved-place-footer with-glyph">
                <Glyph kind="saved" line />
                {packAgeLabel(clock, pack.verifiedAt)}
                {/* A hint that the card opens. Hidden from screen readers,
                    which already announce the pack name as a link. */}
                <svg className="card-chevron" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
                  <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </p>
            </section>
        ))
      )}

      {/* One more pack, in every state, at the end of the list it adds to:
          under the last card, or under the empty space. */}
      {view === null ? null : (
        <Link className="action main-action with-glyph" to="/packs/new">
          <Glyph kind="plus" line />
          {copy.BUILD_A_PACK}
        </Link>
      )}

      <dialog
        ref={sheet}
        className="sheet"
        aria-labelledby="pack-sheet-title"
        onClose={() => {
          setSettings(null);
          setStep('menu');
        }}
      >
        {settings ? (
          <>
            {/* The close cross comes first, so the sheet opens on it. */}
            <div className="sheet-head">
              <div>
                <h2 id="pack-sheet-title" className="pack-name">{shownPackName(settings.name)}</h2>
                <p className="muted figure">{packAgeLabel(clock, settings.verifiedAt)}</p>
              </div>
              <button type="button" className="sheet-close" aria-label={copy.CLOSE} onClick={() => sheet.current?.close()}>
                <Glyph kind="close" line />
              </button>
            </div>
            {step === 'rename' ? (
              <form className="sheet-form" onSubmit={(event) => void saveName(event)}>
                <label htmlFor="pack-name">{copy.PLACE_NAME_LABEL}</label>
                <input
                  ref={nameRef}
                  id="pack-name"
                  type="text"
                  value={nameDraft}
                  maxLength={PACK_NAME_MAX_CHARS}
                  aria-invalid={renameError !== null || undefined}
                  aria-describedby={renameError ? 'pack-name-error' : undefined}
                  onChange={(event) => {
                    setNameDraft(event.currentTarget.value);
                    setRenameError(null);
                  }}
                />
                {renameError ? (
                  <p id="pack-name-error" className="field-message with-glyph" role="status">
                    <Glyph kind="caution" line />
                    {renameError}
                  </p>
                ) : null}
                <div className="card-confirm-actions">
                  <button type="button" onClick={() => setStep('menu')}>
                    {copy.CANCEL}
                  </button>
                  <button type="submit" className="main-action" disabled={nameDraft.trim() === ''}>
                    {copy.SAVE}
                  </button>
                </div>
              </form>
            ) : step === 'icon' ? (
              <form className="sheet-form" onSubmit={(event) => void saveIcon(event)}>
                <IconPicker name="pack-icon" value={iconDraft} onChange={setIconDraft} />
                {iconFailed ? (
                  <p className="field-message with-glyph" role="status">
                    <Glyph kind="caution" line />
                    {copy.PACK_ICON_NOT_SAVED}
                  </p>
                ) : null}
                <div className="card-confirm-actions">
                  <button type="button" onClick={() => setStep('menu')}>
                    {copy.CANCEL}
                  </button>
                  <button type="submit" className="main-action">
                    {copy.SAVE}
                  </button>
                </div>
              </form>
            ) : step === 'delete' ? (
              <>
                <p>{copy.DELETE_PACK_QUESTION}</p>
                <div className="card-confirm-actions">
                  <button ref={cancelRef} type="button" className="card-confirm-no" onClick={() => setStep('menu')}>
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
              <ul className="sheet-menu">
                <li>
                  <button ref={renameRowRef} type="button" className="sheet-row with-glyph" onClick={startRename}>
                    <Glyph kind="edit" line />
                    {copy.RENAME_PACK}
                  </button>
                </li>
                <li>
                  <button ref={iconRowRef} type="button" className="sheet-row with-glyph" onClick={startIcon}>
                    <Glyph kind={settings.icon} line />
                    {copy.CHANGE_ICON}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="sheet-row with-glyph"
                    onClick={() => {
                      sheet.current?.close();
                      navigate(`/packs/${settings.id}/print`);
                    }}
                  >
                    <Glyph kind="print" line />
                    {copy.PRINT_PACK}
                  </button>
                </li>
                <li>
                  <button
                    ref={deleteRowRef}
                    type="button"
                    className="sheet-row sheet-delete with-glyph"
                    onClick={() => setStep('delete')}
                  >
                    <Glyph kind="trash" line />
                    {copy.DELETE_PACK}
                  </button>
                </li>
              </ul>
            )}
          </>
        ) : null}
      </dialog>
    </main>
  );
}
