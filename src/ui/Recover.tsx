import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { GENERAL_CHANNEL_URL, HOTLINE_NUMBER, NEED_CHANNELS, TRIPLE_ZERO } from '../core/constants';
import * as copy from '../core/copy';
import { readKept, toggleKept, writeKept } from '../core/kept';
import { formatSavedDate } from '../core/provenance';
import { callList, isNeed, monogram, NEEDS, parseChoice, recoveryStale, selectPrograms, shareText, type Choice } from '../core/recover';
import type { RecoveryProgram } from '../core/types';
import { localFlagStore } from '../data/acknowledgement';
import { listPrograms, listSavedProgramIds } from '../data/db';
import CallCard from './components/CallCard';
import { focusMain } from './components/focusMain';
import Glyph from './components/Glyph';
import ProvenanceLine from './components/ProvenanceLine';
import StateCard from './components/StateCard';
import WellbeingLines from './components/WellbeingLines';
import Roadmap from './Roadmap';

type RecoverProps = {
  loadPrograms?: () => Promise<RecoveryProgram[]>;
  loadSaved?: () => Promise<string[]>;
  now?: number;
};

/** Needs-first support matching, read from the programs on the device and
 *  nothing else, with or without a saved pack, as Nearby reads its downloaded
 *  list. The chosen category lives in the address, so it is a step the Back
 *  control and the phone's own Back button can return through; the one thing
 *  remembered between visits is the list of program ids the person kept. */
export default function Recover({
  loadPrograms = listPrograms,
  loadSaved = listSavedProgramIds,
  now = Date.now(),
}: RecoverProps) {
  // null while the store has not answered, an empty list when nothing is on the device.
  const [programs, setPrograms] = useState<RecoveryProgram[] | null>(null);
  // The programs some saved pack already carries, so a card can say so.
  const [saved, setSaved] = useState<string[]>([]);
  // The category is a history entry, not component state: going back from a
  // category has to land on the list of categories, not on whatever screen
  // came before Recover.
  const [params, setParams] = useSearchParams();
  const choice = parseChoice(params.get('need'));
  const [kept, setKept] = useState(() => readKept(localFlagStore()));
  // UAT: releasing a program on the Saved list made its card vanish mid-read.
  // The list holds the programs kept when it was opened until the person leaves;
  // each card still shows its live Save or Saved state.
  const [keptOnEntry, setKeptOnEntry] = useState<string[] | null>(null);
  const keptListed = choice === 'kept' ? (keptOnEntry ?? kept) : kept;
  // A share note belongs to the category it was made on, so it shows only while
  // that category is open. Moving to another category hides it on the very first
  // frame, and a result that arrives after the reader has moved on stays with the
  // category it was for. The effect below then clears it on any change of category.
  const [shared, setShared] = useState<{ on: Choice | null; state: 'copied' | 'unavailable' } | null>(null);
  const shareNote = shared?.on === choice ? shared.state : null;
  // Clear all asks once first. Focus goes to the choice that changes nothing,
  // and back to Clear all if the person keeps them.
  const [confirmClear, setConfirmClear] = useState(false);
  const keepAllRef = useRef<HTMLButtonElement>(null);
  const askedClear = useRef(false);
  useEffect(() => {
    if (confirmClear) {
      askedClear.current = true;
      keepAllRef.current?.focus();
    } else if (askedClear.current) {
      askedClear.current = false;
      const control = document.getElementById('clear-kept');
      if (control) control.focus();
      else focusMain();
    }
  }, [confirmClear]);

  useEffect(() => {
    let live = true;
    Promise.all([loadPrograms(), loadSaved()]).then(([rows, savedIds]) => {
      if (!live) return;
      setPrograms(rows);
      setSaved(savedIds);
    }, () => {
      // A store that cannot be read holds nothing this screen can show, which is
      // the empty state it already has. Left unhandled it would stay blank.
      if (live) setPrograms([]);
    });
    return () => {
      live = false;
    };
  }, [loadPrograms, loadSaved]);

  // Any change of category, however it was reached (the app's own controls or
  // the browser's Back and Forward), clears the note the last one left behind,
  // and moves focus to the page, since the control that was pressed is gone.
  useEffect(() => {
    setShared(null);
    setConfirmClear(false);
    setKeptOnEntry(choice === 'kept' ? kept : null);
    focusMain();
  }, [choice]);

  const choose = (next: Choice) => setParams({ need: next });


  // The phone's own share sheet where there is one (a text message needs no
  // data), otherwise the clipboard. A share the person cancels reports nothing;
  // a share sheet that refuses falls back to the clipboard.
  async function share(text: string) {
    const on = choice;
    try {
      await navigator.share({ text });
      return;
    } catch (error) {
      // Cancelled by the person, or a second tap while the share sheet is still
      // open (InvalidStateError). Neither is a share that failed, so neither
      // earns the clipboard note while the real sheet is on screen.
      const name = error instanceof DOMException ? error.name : '';
      if (name === 'AbortError' || name === 'InvalidStateError') return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setShared({ on, state: 'copied' });
    } catch {
      setShared({ on, state: 'unavailable' });
    }
  }

  // The page itself, empty, while the store answers, so focus has somewhere to land.
  if (programs === null) return <main className="page" />;

  // R1: the roadmap needs no program, so it opens whatever the device holds.
  if (choice === 'roadmap') return <Roadmap />;

  // Who to call needs no program either: the hotline and wellbeing lines ship with the app.
  if (programs.length === 0 && choice !== 'calls') {
    return (
      <main className="page recover">
        <StateCard heading={copy.RECOVER_NONE_TITLE} detail={copy.RECOVER_NONE_LINE} />
        <div className="actions">
          <Link className="action main-action" to="/packs/new">{copy.BUILD_A_PACK}</Link>
          <OfficialChannel href={GENERAL_CHANNEL_URL} />
        </div>
      </main>
    );
  }

  const anyKept = programs.some((program) => keptListed.includes(program.id));
  // The kept list with nothing kept is not a category. It is reached by
  // releasing the last kept program, or by an old address, and used to say
  // "This pack holds nothing for that need", which is about something else.
  // The list of categories is what is true then.
  if (choice === null || (choice === 'kept' && !anyKept)) {
    const rows: { key: Choice; label: string }[] = [
      ...NEEDS.map((key) => ({ key, label: copy.NEED_PHRASE[key] })),
      { key: 'calls', label: copy.WHO_TO_CALL },
    ];
    return (
      <main className="page recover">
        <header className="hero">
          <span className="kicker">{copy.NAV_RECOVER}</span>
          <h1>{copy.RECOVER_QUESTION}</h1>
          <p className="muted with-glyph">
            <Glyph kind="lock" line />
            {copy.RECOVER_PRIVACY_LINE}
          </p>
        </header>
        <div className="recover-start">
          {/* R1: the way through recovery, in teal, first: where to start. */}
          <button type="button" className="need-button roadmap-button" onClick={() => choose('roadmap')}>
            <Glyph kind="roadmap" />
            {copy.ROADMAP_TITLE}
          </button>
          {/* The two ways into the programs that are not one need, as tiles.
              Saved, in the ring and tint a saved card wears, is here only
              while something is kept; All then fills the row alone. */}
          <div className="recover-tiles">
            {anyKept ? (
              <button type="button" className="recover-tile kept-button" onClick={() => choose('kept')}>
                <Glyph kind="kept" />
                <span className="recover-tile-label">{copy.KEPT_PROGRAMS}</span>{' '}
                <span className="recover-tile-detail">{copy.KEPT_PROGRAMS_DETAIL}</span>
              </button>
            ) : null}
            <button type="button" className="recover-tile" onClick={() => choose('all')}>
              <Glyph kind="all" />
              <span className="recover-tile-label">{copy.ALL_PROGRAMS}</span>{' '}
              <span className="recover-tile-detail">{copy.ALL_PROGRAMS_DETAIL}</span>
            </button>
          </div>
        </div>
        {/* The single needs under their own eyebrow, set apart from the group above. */}
        <section className="recover-needs">
          <h2 className="kicker">{copy.BY_NEED}</h2>
          <ul className="list">
            {rows.map((row) => (
              <li key={row.key}>
                <button type="button" className="need-button" onClick={() => choose(row.key)}>
                  <Glyph kind={row.key} />
                  {row.label}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </main>
    );
  }

  if (choice === 'calls') {
    // E4-US10: every number already on the device, as tap-to-call links.
    return (
      <main className="page recover">
        <header className="hero">
          <span className="kicker">{copy.NAV_RECOVER}</span>
          <h1>{copy.WHO_TO_CALL}</h1>
          <p className="muted with-glyph">
            <Glyph kind="calls" line />
            {copy.CALLS_LINE}
          </p>
        </header>
        {/* Two groups under the eyebrows used across Recover: the lines for the
            recovery itself, 000 then the hotline first, then the lines for how a
            person is coping. */}
        <section className="call-group">
          <h2 className="kicker">{copy.RECOVERY_LINES}</h2>
          <ul className="list">
            <CallCard name={copy.TRIPLE_ZERO_LABEL} detail={copy.TRIPLE_ZERO_DETAIL} number={TRIPLE_ZERO} tone="emergency" />
            {callList(programs).map((entry) => (
              <CallCard
                key={entry.number}
                name={entry.label}
                detail={entry.org ?? copy.HOTLINE_DETAIL}
                number={entry.number}
                tone={entry.number === HOTLINE_NUMBER ? 'caution' : undefined}
              />
            ))}
          </ul>
        </section>
        <section className="call-group">
          <h2 className="kicker">{copy.TALK_TO_SOMEONE}</h2>
          <p className="muted">{copy.TALK_TO_SOMEONE_LINE}</p>
          <WellbeingLines />
        </section>
      </main>
    );
  }

  const heading = choice === 'all' ? copy.ALL_PROGRAMS
    : choice === 'kept' ? copy.KEPT_PROGRAMS
    : copy.NEED_PHRASE[choice];
  const shown = selectPrograms(programs, choice, keptListed);

  if (shown.length === 0) {
    // The device holds nothing: a designed screen, and never "no help exists".
    return (
      <main className="page recover">
        <header className="hero">
          <span className="kicker">{heading}</span>
          <h1>{copy.RECOVER_NO_MATCH_TITLE}</h1>
          <p className="muted">{copy.RECOVER_NO_MATCH_LINE}</p>
          <p className="figure">{copy.VERIFIED_ON(formatSavedDate(snapshotAt(programs)))}</p>
        </header>
        <div className="actions">
          <OfficialChannel href={isNeed(choice) ? NEED_CHANNELS[choice] : GENERAL_CHANNEL_URL} />
        </div>
      </main>
    );
  }

  const stale = shown.some((program) => recoveryStale(now, program.snapshotDate));
  const clearKept = () => {
    writeKept(localFlagStore(), []);
    setKept([]);
    setConfirmClear(false);
  };
  return (
    <main className="page recover">
      <header className="hero">
        <span className="kicker">{copy.NAV_RECOVER}</span>
        <h1>{heading}</h1>
        {/* A footnote to the heading, in the same small grey as the other
            notes that qualify a list, not a line to read first. */}
        <p className="muted place-note">{copy.RECOVER_MAY_MATCH}</p>
        {stale ? (
          <p className="with-glyph tone-amber">
            <Glyph kind="caution" line />
            {copy.RECOVER_STALE_LINE}
          </p>
        ) : null}
      </header>
      {/* The kept list only. Every card stays on screen after a clear, each
          with its Save control, so one can be saved again straight away. */}
      {choice !== 'kept' ? null : confirmClear ? (
        <section className="card" aria-labelledby="clear-kept-question">
          <p id="clear-kept-question">{copy.CLEAR_KEPT_QUESTION}</p>
          <p className="muted">{copy.CLEAR_KEPT_PACKS}</p>
          <div className="card-confirm-actions">
            <button ref={keepAllRef} type="button" className="card-confirm-no" onClick={() => setConfirmClear(false)}>
              {copy.KEEP_KEPT}
            </button>
            <button type="button" className="card-confirm-yes with-glyph" onClick={clearKept}>
              <Glyph kind="trash" line />
              {copy.CLEAR_KEPT}
            </button>
          </div>
        </section>
      ) : kept.length > 0 ? (
        <button id="clear-kept" type="button" className="clear-kept with-glyph" onClick={() => setConfirmClear(true)}>
          <Glyph kind="trash" line />
          {copy.CLEAR_KEPT}
        </button>
      ) : (
        <p className="muted" role="status">{copy.KEPT_CLEARED}</p>
      )}
      <ul className="list">
        {shown.map((program) => {
          const isKept = kept.includes(program.id);
          return (
            <li key={program.id} className={isKept ? 'card kept' : 'card'}>
              {/* The source at a glance: its initials in a ring, as the mockups
                  mark each household member, before any text is read. */}
              <div className="card-head">
                <span className="monogram" aria-hidden="true">{monogram(program.org)}</span>
                <div>
                  <h2>{program.title}</h2>
                  <p>{program.org}</p>
                </div>
              </div>
              <ul className="need-pills">
                {program.needs.map((need) => (
                  <li key={need} className="need-pill">
                    <Glyph kind={need} />
                    {copy.NEED_PHRASE[need]}
                  </li>
                ))}
              </ul>
              <p className="muted">{program.covers}</p>
              {/* A fact about the program, with its summary, before the
                  Source footnote that ends the card's words. */}
              {saved.includes(program.id) ? (
                <p className="figure in-packs with-glyph">
                  <Glyph kind="saved" line />
                  {copy.IN_YOUR_PACKS}
                </p>
              ) : null}
              {/* Source as words, like Not for you? on Home. Its links are the
                  card's own buttons below, so none sit beside it. */}
              <ProvenanceLine source={program.source} now={now} extra={[{ label: copy.SOURCE_LICENCE, value: program.source.licence }]} links={null} />
              {/* Save and the web page side by side at equal size, the call
                  beneath at full width. */}
              <div className="program-actions">
                <button
                  type="button"
                  className="action keep-button with-glyph"
                  aria-pressed={isKept}
                  onClick={() => setKept(toggleKept(localFlagStore(), kept, program.id))}
                >
                  <Glyph kind="kept" line />
                  {isKept ? copy.KEPT : copy.KEEP}
                </button>
                <a className="action with-glyph" href={program.officialUrl} target="_blank" rel="noopener noreferrer">
                  <Glyph kind="web" line />
                  {copy.OPEN_ORIGINAL_SOURCE}
                </a>
                {program.telephone ? (
                  <a className="action call-action with-glyph" href={`tel:${program.telephone.replaceAll(' ', '')}`}>
                    <Glyph kind="calls" line />
                    {copy.CALL_LINE(program.telephone)}
                  </a>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="actions">
        <p className="muted" role="status" aria-live="polite">
          {shareNote === 'copied' ? copy.COPIED_LINE : shareNote === 'unavailable' ? copy.SHARE_UNAVAILABLE : ''}
        </p>
        <button type="button" className="with-glyph" onClick={() => void share(shareText(heading, shown))}>
          <Glyph kind="share" line />
          {copy.SHARE_LIST}
        </button>
        <button type="button" className="with-glyph" onClick={() => window.print()}>
          <Glyph kind="print" line />
          {copy.PRINT_LIST}
        </button>
      </div>
    </main>
  );
}

/** When the snapshot on the device was taken: the date the no-match state shows. */
const snapshotAt = (programs: RecoveryProgram[]) =>
  Math.max(...programs.map((program) => program.source.retrievedAt));

/** A static pack link to the publisher's entry point. It is the one thing on
 *  the screen that needs a connection, and it says so in its label. */
function OfficialChannel({ href }: { href: string }) {
  return (
    <a className="action" href={href} target="_blank" rel="noopener noreferrer">
      {copy.OFFICIAL_CHANNEL}
    </a>
  );
}
