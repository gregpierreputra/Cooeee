import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { GENERAL_CHANNEL_URL, HOTLINE_NUMBER, NEED_CHANNELS } from '../core/constants';
import * as copy from '../core/copy';
import { readKept, toggleKept } from '../core/kept';
import { formatSavedDate } from '../core/provenance';
import { callList, isNeed, monogram, NEEDS, parseChoice, recoveryStale, selectPrograms, shareText, type Choice } from '../core/recover';
import type { RecoveryProgram } from '../core/types';
import { localFlagStore } from '../data/acknowledgement';
import { listPrograms, listSavedProgramIds } from '../data/db';
import Glyph from './components/Glyph';
import { canStepBack } from './components/history';
import ProvenanceLine from './components/ProvenanceLine';
import StateCard from './components/StateCard';

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
  const navigate = useNavigate();
  const choice = parseChoice(params.get('need'));
  const [kept, setKept] = useState(() => readKept(localFlagStore()));
  // A share note belongs to the category it was made on, so it shows only while
  // that category is open. Moving to another category hides it on the very first
  // frame, and a result that arrives after the reader has moved on stays with the
  // category it was for. Leaving through the app clears it outright.
  const [shared, setShared] = useState<{ on: Choice | null; state: 'copied' | 'unavailable' } | null>(null);
  const shareNote = shared?.on === choice ? shared.state : null;

  useEffect(() => {
    let live = true;
    Promise.all([loadPrograms(), loadSaved()]).then(([rows, savedIds]) => {
      if (!live) return;
      setPrograms(rows);
      setSaved(savedIds);
    });
    return () => {
      live = false;
    };
  }, [loadPrograms, loadSaved]);

  const choose = (next: Choice) => {
    setShared(null);
    setParams({ need: next });
  };

  /** Back to the list of categories. Stepping back keeps the history honest;
   *  with nothing of ours behind this entry, the category is dropped instead. */
  const backToChoices = () => {
    setShared(null);
    // One step back is the category list because every category is entered from
    // it. A link straight into a category would break that, and none exists.
    if (canStepBack()) navigate(-1);
    else setParams({}, { replace: true });
  };

  // The phone's own share sheet where there is one (a text message needs no
  // data), otherwise the clipboard. A share the person cancels reports nothing;
  // a share sheet that refuses falls back to the clipboard.
  async function share(text: string) {
    const on = choice;
    try {
      await navigator.share({ text });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setShared({ on, state: 'copied' });
    } catch {
      setShared({ on, state: 'unavailable' });
    }
  }

  if (programs === null) return null;

  if (programs.length === 0) {
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

  if (choice === null) {
    const anyKept = programs.some((program) => kept.includes(program.id));
    const rows: { key: Choice; label: string }[] = [
      ...NEEDS.map((key) => ({ key, label: copy.NEED_PHRASE[key] })),
      { key: 'all', label: copy.EVERY_PROGRAM },
      { key: 'calls', label: copy.WHO_TO_CALL },
    ];
    return (
      <main className="page recover">
        <header className="hero">
          <span className="kicker">{copy.NAV_RECOVER}</span>
          <h1>{copy.RECOVER_QUESTION}</h1>
          <p className="muted">{copy.RECOVER_PRIVACY_LINE}</p>
        </header>
        {/* What the person already chose is not one more need to pick from, so
            it stands outside the list, in the same ring and tint a kept card
            wears. It is here only while something is kept. */}
        {anyKept ? (
          <button type="button" className="need-button kept-button" onClick={() => choose('kept')}>
            <Glyph kind="kept" />
            {copy.KEPT_PROGRAMS}
          </button>
        ) : null}
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
      </main>
    );
  }

  const chooseAgain = (
    <button type="button" onClick={backToChoices}>{copy.CHOOSE_ANOTHER_NEED}</button>
  );

  if (choice === 'calls') {
    // E4-US10: every number already on the device, as tap-to-call links.
    return (
      <main className="page recover">
        <header className="hero">
          <span className="kicker">{copy.NAV_RECOVER}</span>
          <h1>{copy.WHO_TO_CALL}</h1>
          <p className="muted">{copy.CALLS_LINE}</p>
        </header>
        <ul className="list">
          {callList(programs).map((entry) => (
            <li
              key={entry.number}
              className={entry.number === HOTLINE_NUMBER ? 'card emergency-line' : 'card'}
            >
              <h2>{entry.label}</h2>
              {entry.org ? <p>{entry.org}</p> : null}
              <a href={`tel:${entry.number.replaceAll(' ', '')}`}>{copy.CALL_LINE(entry.number)}</a>
            </li>
          ))}
        </ul>
        <div className="actions">{chooseAgain}</div>
      </main>
    );
  }

  const heading = choice === 'all' ? copy.EVERY_PROGRAM
    : choice === 'kept' ? copy.KEPT_PROGRAMS
    : copy.NEED_PHRASE[choice];
  const shown = selectPrograms(programs, choice, kept);

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
          {chooseAgain}
        </div>
      </main>
    );
  }

  const stale = shown.some((program) => recoveryStale(now, program.snapshotDate));
  const anyKeptShown = shown.some((program) => kept.includes(program.id));
  return (
    <main className="page recover">
      <header className="hero">
        <span className="kicker">{copy.NAV_RECOVER}</span>
        <h1>{heading}</h1>
        <p className="caveat">{copy.RECOVER_MAY_MATCH}</p>
        <p className="muted">{anyKeptShown ? copy.RECOVER_ORDER_LINE_KEPT : copy.RECOVER_ORDER_LINE}</p>
        {stale ? <p>{copy.RECOVER_STALE_LINE}</p> : null}
      </header>
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
              <ProvenanceLine source={program.source} now={now} />
              <p className="figure">{copy.LICENCE_LINE(program.source.licence)}</p>
              {saved.includes(program.id) ? <p className="figure in-packs">{copy.IN_YOUR_PACKS}</p> : null}
              <a href={program.officialUrl} target="_blank" rel="noopener noreferrer">
                {copy.OPEN_ORIGINAL_SOURCE}
              </a>
              {program.telephone ? (
                <a href={`tel:${program.telephone.replaceAll(' ', '')}`}>
                  {copy.CALL_LINE(program.telephone)}
                </a>
              ) : null}
              <button
                type="button"
                className="keep-button"
                aria-pressed={isKept}
                onClick={() => setKept(toggleKept(localFlagStore(), kept, program.id))}
              >
                {isKept ? copy.KEPT : copy.KEEP}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="actions">
        <p className="muted" role="status" aria-live="polite">
          {shareNote === 'copied' ? copy.COPIED_LINE : shareNote === 'unavailable' ? copy.SHARE_UNAVAILABLE : ''}
        </p>
        <button type="button" onClick={() => void share(shareText(heading, shown))}>
          {copy.SHARE_LIST}
        </button>
        <button type="button" onClick={() => window.print()}>{copy.PRINT_LIST}</button>
        {chooseAgain}
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
