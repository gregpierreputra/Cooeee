import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Link } from 'react-router';

import * as copy from '../core/copy';
import { decideOriginalSourceAccess, packDetailItems } from '../core/provenance';
import type { CompletePackContent, PackDetailItem } from '../core/types';
import { getCompletePackContent } from '../data/db';
import ProvenanceLine from './components/ProvenanceLine';
import StateCard from './components/StateCard';

export type PackDetailProps = {
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
    loadContent(packId).then((value) => { if (live) setContent(value); });
    return () => { live = false; };
  }, [loadContent, packId]);

  useEffect(() => {
    if (offlineSource) closeRef.current?.focus();
  }, [offlineSource]);

  if (content === null) return null;
  if (content === undefined) {
    return (
      <main className="page">
        <p className="eyebrow">{copy.EYEBROW_MY_PACK}</p>
        <StateCard heading={copy.PACK_NOT_FOUND} />
      </main>
    );
  }

  const items = packDetailItems(content);
  const interceptSource = (event: MouseEvent<HTMLAnchorElement>, item: PackDetailItem) => {
    event.preventDefault();
    setOfflineSource(decideOriginalSourceAccess(item).item);
  };

  return (
    <main className="page pack-detail">
      <header>
        {/* A client-side route change, so the offline guarantee holds: no
            document request, no revalidation, nothing but stored rows. */}
        <Link className="pack-detail-back" to="/">{copy.BACK_TO_YOUR_PACKS}</Link>
        <p className="eyebrow">{copy.EYEBROW_MY_PACK}</p>
        <h1>{copy.YOUR_PACK}</h1>
      </header>

      <div className="card">
        <p>{content.pack.name}</p>
        <p className="muted">{content.pack.address}</p>
      </div>

      {!content.recoveryVerified ? (
        <StateCard heading={copy.RECOVERY_ITEMS_UNVERIFIED} />
      ) : null}

      {items.length === 0 ? (
        <StateCard heading={copy.NO_STORED_ITEMS} />
      ) : (
        <ul className="list pack-item-list">
          {items.map((item) => (
            <li key={item.id} className="card provenance-item">
              <h2>{item.name}</h2>
              <ProvenanceLine source={item.source} now={now} />
              <a
                href={item.source.url}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => interceptSource(event, item)}
              >
                {copy.OPEN_ORIGINAL_SOURCE}
              </a>
            </li>
          ))}
        </ul>
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
            <a href={offlineSource.source.url} target="_blank" rel="noreferrer">
              {copy.CONTINUE_TO_ORIGINAL_SOURCE}
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