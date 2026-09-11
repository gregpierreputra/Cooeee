import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { GENERAL_CHANNEL_URL, NEED_CHANNELS } from '../core/constants';
import * as copy from '../core/copy';
import { readKept, toggleKept } from '../core/kept';
import { formatSavedDate } from '../core/provenance';
import { isNeed, NEEDS, recoveryPack, recoveryStale, selectPrograms, shareText, type Choice } from '../core/recover';
import type { CompletePackContent, Pack } from '../core/types';
import { localFlagStore } from '../data/acknowledgement';
import { getCompletePackContent, listCompletePacks } from '../data/db';
import ProvenanceLine from './components/ProvenanceLine';
import StateCard from './components/StateCard';

type RecoverProps = {
  loadPacks?: () => Promise<Pack[]>;
  loadContent?: (id: string) => Promise<CompletePackContent | undefined>;
  now?: number;
};

/** Needs-first support matching, read from the newest saved pack and nothing
 *  else. The choice lives in component state for this visit only; the one
 *  thing remembered is the list of program ids the person chose to keep. */
export default function Recover({
  loadPacks = listCompletePacks,
  loadContent = getCompletePackContent,
  now = Date.now(),
}: RecoverProps) {
  // null while the store has not answered, undefined when no pack carries recovery.
  const [content, setContent] = useState<CompletePackContent | null | undefined>(null);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [kept, setKept] = useState(() => readKept(localFlagStore()));
  const [shared, setShared] = useState<'copied' | 'unavailable' | null>(null);

  useEffect(() => {
    let live = true;
    loadPacks()
      .then((packs) => {
        const pack = recoveryPack(packs);
        return pack ? loadContent(pack.id) : undefined;
      })
      .then((value) => {
        if (live) setContent(value);
      });
    return () => {
      live = false;
    };
  }, [loadPacks, loadContent]);

  const choose = (next: Choice | null) => {
    setShared(null);
    setChoice(next);
  };

  // The phone's own share sheet where there is one (a text message needs no
  // data), otherwise the clipboard. A share the person cancels reports nothing.
  async function share(text: string) {
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        setShared('copied');
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setShared('unavailable');
    }
  }

  if (content === null) return null;

  if (content === undefined) {
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

  if (!content.recoveryVerified) {
    return (
      <main className="page recover">
        <StateCard heading={copy.RECOVERY_ITEMS_UNVERIFIED} />
      </main>
    );
  }

  if (choice === null) {
    const anyKept = content.recovery.some((program) => kept.includes(program.id));
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
  const programs = selectPrograms(content.recovery, choice, kept);
  const chooseAgain = (
    <button type="button" onClick={() => choose(null)}>{copy.CHOOSE_ANOTHER_NEED}</button>
  );

  if (programs.length === 0) {
    // This pack holds nothing: a designed screen, and never "no help exists".
    return (
      <main className="page recover">
        <header className="hero">
          <span className="kicker">{heading}</span>
          <h1>{copy.RECOVER_NO_MATCH_TITLE}</h1>
          <p className="muted">{copy.RECOVER_NO_MATCH_LINE}</p>
          <p className="figure">{copy.VERIFIED_ON(formatSavedDate(content.pack.verifiedAt))}</p>
        </header>
        <div className="actions">
          <OfficialChannel href={isNeed(choice) ? NEED_CHANNELS[choice] : GENERAL_CHANNEL_URL} />
          {chooseAgain}
        </div>
      </main>
    );
  }

  const stale = programs.some((program) => recoveryStale(now, program.snapshotDate));
  const anyKeptShown = programs.some((program) => kept.includes(program.id));
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
        {programs.map((program) => {
          const isKept = kept.includes(program.id);
          return (
            <li key={program.id} className="card">
              <h2>{program.title}</h2>
              <p>{program.org}</p>
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
        <button type="button" onClick={() => void share(shareText(heading, programs))}>
          {copy.SHARE_LIST}
        </button>
        {chooseAgain}
      </div>
    </main>
  );
}

/** A static pack link to the publisher's entry point. It is the one thing on
 *  the screen that needs a connection, and it says so in its label. */
function OfficialChannel({ href }: { href: string }) {
  return (
    <a className="action" href={href} target="_blank" rel="noopener noreferrer">
      {copy.OFFICIAL_CHANNEL}
    </a>
  );
}
