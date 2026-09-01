import { useEffect, useRef, useState, type MouseEvent } from 'react';

import { DTP_DATASET_URL } from '../core/constants';
import * as copy from '../core/copy';
import { decideOriginalSourceAccess, packDetailAbsence, packDetailItems } from '../core/provenance';
import type { CompletePackContent, PackDetailItem } from '../core/types';
import { getCompletePackContent } from '../data/db';
import ProvenanceLine from './components/ProvenanceLine';
import StateCard from './components/StateCard';
import StatusPage from './components/StatusPage';

type PackDetailProps = {
  packId: string;
  loadContent?: (id: string) => Promise<CompletePackContent | undefined>;
  now?: number;
};

/** A network-blind pack view. Every value comes from the complete-pack store;
 * every source tap is intercepted before browser navigation and requires a
 * second explicit choice before leaving Cooeee. */
export default function PackDetail({
  packId,
  loadContent = getCompletePackContent,
  now = Date.now(),
}: PackDetailProps) {
  const [content, setContent] = useState<CompletePackContent | null | undefined>(null);
  const [offlineSource, setOfflineSource] = useState<PackDetailItem | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let live = true;
    loadContent(packId).then((value) => {
      if (live) setContent(value);
    });
    return () => {
      live = false;
    };
  }, [loadContent, packId]);

  useEffect(() => {
    if (offlineSource) closeRef.current?.focus();
  }, [offlineSource]);

  if (content === null) return null;
  if (content === undefined) {
    return (
      <StatusPage
        page="pack-detail"
        kicker={copy.EYEBROW_MY_PACK}
        card={<p>{copy.PACK_NOT_FOUND}</p>}
      />
    );
  }

  const items = packDetailItems(content);
  const absence = packDetailAbsence(content);
  const interceptSource = (event: MouseEvent<HTMLAnchorElement>, item: PackDetailItem) => {
    event.preventDefault();
    setOfflineSource(decideOriginalSourceAccess(item).item);
  };

  return (
    <main className="page pack-detail">
      <header>
        <span className="kicker">{copy.EYEBROW_MY_PACK}</span>
        <h1>{copy.YOUR_PACK}</h1>
      </header>

      <StateCard heading={content.pack.name} detail={content.pack.address} />

      {!content.recoveryVerified ? (
        <StateCard heading={copy.RECOVERY_ITEMS_UNVERIFIED} />
      ) : null}

      {/* A stored absence row: its own plain statement, never an item in the
          list and never a source to open. */}
      {absence ? <StateCard heading={absence} /> : null}

      {items.length > 0 ? (
        <ul className="list pack-item-list">
          {items.map((item) => (
            <li key={item.id} className="card provenance-item">
              <h2>{item.name}</h2>
              <ProvenanceLine source={item.source} now={now} />
              {/* The publisher's page for the dataset, not the stored query URL:
                  that URL is a WFS endpoint answering in raw JSON, never a page,
                  whether the query hit or missed. */}
              <a
                href={DTP_DATASET_URL}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => interceptSource(event, item)}
              >
                {copy.OPEN_ORIGINAL_SOURCE}
              </a>
            </li>
          ))}
        </ul>
      ) : absence ? null : (
        <StateCard heading={copy.NO_STORED_ITEMS} />
      )}

      {offlineSource ? (
        <div className="sheet-backdrop">
          <section
            className="card source-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="offline-source-heading"
          >
            <h2 id="offline-source-heading">{copy.SOURCE_IS_ON_WEB}</h2>
            <p>{copy.STORED_PROVENANCE_REMAINS}</p>
            <ProvenanceLine source={offlineSource.source} now={now} />
            <p>{copy.EXTERNAL_SOURCE_NOTICE}</p>
            {/* The stored citation answers "what was checked" here, in the app.
                Where there is one, the link behind it is the publisher's account
                of the dataset rather than the only readable statement of the
                result. */}
            {offlineSource.citation ? (
              <p className="source-citation">{offlineSource.citation}</p>
            ) : null}
            <a
              className={offlineSource.citation ? 'secondary-action' : undefined}
              href={DTP_DATASET_URL}
              target="_blank"
              rel="noreferrer"
            >
              {offlineSource.citation
                ? copy.CONTINUE_TO_DATASET_PAGE
                : copy.CONTINUE_TO_ORIGINAL_SOURCE}
            </a>
            <button ref={closeRef} type="button" onClick={() => setOfflineSource(null)}>
              {copy.CLOSE}
            </button>
          </section>
        </div>
      ) : null}
    </main>
  );
}