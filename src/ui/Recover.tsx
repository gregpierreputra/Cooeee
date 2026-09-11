import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { GENERAL_CHANNEL_URL, NEED_CHANNELS } from '../core/constants';
import * as copy from '../core/copy';
import { formatSavedDate } from '../core/provenance';
import { matchPrograms, NEEDS, recoveryPack, recoveryStale } from '../core/recover';
import type { CompletePackContent, NeedKey, Pack } from '../core/types';
import { getCompletePackContent, listCompletePacks } from '../data/db';
import ProvenanceLine from './components/ProvenanceLine';
import StateCard from './components/StateCard';

type RecoverProps = {
  loadPacks?: () => Promise<Pack[]>;
  loadContent?: (id: string) => Promise<CompletePackContent | undefined>;
  now?: number;
};

/** Needs-first support matching, read from the newest saved pack and nothing
 *  else. The chosen need lives in component state for this visit only: nothing
 *  a person picks here is written anywhere or sent anywhere. */
export default function Recover({
  loadPacks = listCompletePacks,
  loadContent = getCompletePackContent,
  now = Date.now(),
}: RecoverProps) {
  // null while the store has not answered, undefined when no pack carries recovery.
  const [content, setContent] = useState<CompletePackContent | null | undefined>(null);
  const [need, setNeed] = useState<NeedKey | null>(null);

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

  if (need === null) {
    return (
      <main className="page recover">
        <header className="hero">
          <span className="kicker">{copy.NAV_RECOVER}</span>
          <h1>{copy.RECOVER_QUESTION}</h1>
          <p className="muted">{copy.RECOVER_PRIVACY_LINE}</p>
        </header>
        <ul className="list">
          {NEEDS.map((key) => (
            <li key={key}>
              <button type="button" className="need-button" onClick={() => setNeed(key)}>
                {copy.NEED_PHRASE[key]}
              </button>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  const programs = matchPrograms(content.recovery, need);
  const chooseAgain = (
    <button type="button" onClick={() => setNeed(null)}>{copy.CHOOSE_ANOTHER_NEED}</button>
  );

  if (programs.length === 0) {
    // This pack holds nothing: a designed screen, and never "no help exists".
    return (
      <main className="page recover">
        <header className="hero">
          <span className="kicker">{copy.NEED_PHRASE[need]}</span>
          <h1>{copy.RECOVER_NO_MATCH_TITLE}</h1>
          <p className="muted">{copy.RECOVER_NO_MATCH_LINE}</p>
          <p className="figure">{copy.VERIFIED_ON(formatSavedDate(content.pack.verifiedAt))}</p>
        </header>
        <div className="actions">
          <OfficialChannel href={NEED_CHANNELS[need]} />
          {chooseAgain}
        </div>
      </main>
    );
  }

  const stale = programs.some((program) => recoveryStale(now, program.snapshotDate));
  return (
    <main className="page recover">
      <header className="hero">
        <span className="kicker">{copy.NAV_RECOVER}</span>
        <h1>{copy.NEED_PHRASE[need]}</h1>
        <p className="caveat">{copy.RECOVER_MAY_MATCH}</p>
        <p className="muted">{copy.RECOVER_ORDER_LINE}</p>
        {stale ? <p>{copy.RECOVER_STALE_LINE}</p> : null}
      </header>
      <ul className="list">
        {programs.map((program) => (
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
          </li>
        ))}
      </ul>
      <div className="actions">{chooseAgain}</div>
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
