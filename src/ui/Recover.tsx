import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { GENERAL_CHANNEL_URL, NEED_CHANNELS } from '../core/constants';
import * as copy from '../core/copy';
import { readKept, toggleKept } from '../core/kept';
import { formatSavedDate } from '../core/provenance';
import { isNeed, monogram, NEEDS, recoveryStale, selectPrograms, shareText, type Choice } from '../core/recover';
import type { RecoveryProgram } from '../core/types';
import { localFlagStore } from '../data/acknowledgement';
import { listPrograms } from '../data/db';
import Glyph from './components/Glyph';
import ProvenanceLine from './components/ProvenanceLine';
import StateCard from './components/StateCard';

type RecoverProps = {
  loadPrograms?: () => Promise<RecoveryProgram[]>;
  now?: number;
};

/** Needs-first support matching, read from the programs on the device and
 *  nothing else, with or without a saved pack, as Nearby reads its downloaded
 *  list. The choice lives in component state for this visit only; the one
 *  thing remembered is the list of program ids the person chose to keep. */
export default function Recover({ loadPrograms = listPrograms, now = Date.now() }: RecoverProps) {
  // null while the store has not answered, an empty list when nothing is on the device.
  const [programs, setPrograms] = useState<RecoveryProgram[] | null>(null);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [kept, setKept] = useState(() => readKept(localFlagStore()));
  const [shared, setShared] = useState<'copied' | 'unavailable' | null>(null);

  useEffect(() => {
    let live = true;
    loadPrograms().then((rows) => {
      if (live) setPrograms(rows);
    });
    return () => {
      live = false;
    };
  }, [loadPrograms]);

  const choose = (next: Choice | null) => {
    setShared(null);
    setChoice(next);
  };

  // The phone's own share sheet where there is one (a text message needs no
  // data), otherwise the clipboard. A share the person cancels reports nothing;
  // a share sheet that refuses falls back to the clipboard.
  async function share(text: string) {
    try {
      await navigator.share({ text });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setShared('copied');
    } catch {
      setShared('unavailable');
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
      ...(anyKept ? [{ key: 'kept' as const, label: copy.KEPT_PROGRAMS }] : []),
      ...NEEDS.map((key) => ({ key, label: copy.NEED_PHRASE[key] })),
      { key: 'all', label: copy.EVERY_PROGRAM },
    ];
    return (
      <main className="page recover">
        <header className="hero">
          <span className="kicker">{copy.NAV_RECOVER}</span>
          <h1>{copy.RECOVER_QUESTION}</h1>
          <p className="muted">{copy.RECOVER_PRIVACY_LINE}</p>
        </header>
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

  const heading = choice === 'all' ? copy.EVERY_PROGRAM
    : choice === 'kept' ? copy.KEPT_PROGRAMS
    : copy.NEED_PHRASE[choice];
  const shown = selectPrograms(programs, choice, kept);
  const chooseAgain = (
    <button type="button" onClick={() => choose(null)}>{copy.CHOOSE_ANOTHER_NEED}</button>
  );

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
          {shared === 'copied' ? copy.COPIED_LINE : shared === 'unavailable' ? copy.SHARE_UNAVAILABLE : ''}
        </p>
        <button type="button" onClick={() => void share(shareText(heading, shown))}>
          {copy.SHARE_LIST}
        </button>
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
