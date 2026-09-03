import { useEffect, useRef, useState, type MouseEvent } from 'react';

import { DTP_DATASET_URL } from '../core/constants';
import * as copy from '../core/copy';
import { formatDistanceM } from '../core/destination';
import {
  decideOriginalSourceAccess,
  formatSavedDate,
  packDetailAbsence,
  packDetailItems,
  packDetailPlaces,
} from '../core/provenance';
import type { CompletePackContent, PackDetailItem, PackFile } from '../core/types';
import { getCompletePackContent } from '../data/db';
import ProvenanceLine from './components/ProvenanceLine';
import StateCard from './components/StateCard';
import StatusPage from './components/StatusPage';
import { PlaceFacts } from './PackNew/Destinations';
import { PackNotes } from './PackNotes';

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
  // One object URL per stored PDF, made from the bytes already on the device
  // and released with the screen. No request is involved.
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let live = true;
    let urls: Record<string, string> = {};
    loadContent(packId).then((value) => {
      if (!live) return;
      urls = Object.fromEntries((value?.files ?? []).map((file) => [
        file.id,
        URL.createObjectURL(new Blob([file.bytes], { type: 'application/pdf' })),
      ]));
      // Both land in the one render, so the file links are never a frame late.
      setFileUrls(urls);
      setContent(value);
    });
    return () => {
      live = false;
      Object.values(urls).forEach((url) => URL.revokeObjectURL(url));
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
  const places = packDetailPlaces(content);
  const absence = packDetailAbsence(content);
  const interceptSource = (event: MouseEvent<HTMLAnchorElement>, item: PackDetailItem) => {
    event.preventDefault();
    setOfflineSource(decideOriginalSourceAccess(item).item);
  };
  const sourceLinks = (item: PackDetailItem) => {
    const file = content.files.find((stored) => stored.url === (item.pageUrl ?? DTP_DATASET_URL));
    return (
      <SourceLinks item={item} file={file} href={file && fileUrls[file.id]} onWeb={interceptSource} />
    );
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
      {!content.contentVerified ? (
        <StateCard heading={copy.PACK_ITEMS_UNVERIFIED} />
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
              {sourceLinks(item)}
            </li>
          ))}
        </ul>
      ) : absence || places.length > 0 ? null : (
        <StateCard heading={copy.NO_STORED_ITEMS} />
      )}

      {/* E2-US2: the two places the user chose, side by side with equal weight.
          Distance is a fact about each; there is no ordinal and no ranking. */}
      {places.length > 0 ? (
        <section>
          <span className="kicker">{copy.DESTINATIONS_STEP_TITLE}</span>
          <ul className="list saved-destinations">
            {places.map((place) => {
              const item = {
                id: place.id,
                name: place.name ?? copy.OFFICIAL_DESTINATION_INFORMATION,
                source: place.source,
                pageUrl: place.source.url,
              };
              return (
                <li key={place.id} className="card provenance-item">
                  <h2>{item.name}</h2>
                  {typeof place.distanceM === 'number' ? (
                    <p className="figure">{formatDistanceM(place.distanceM)}</p>
                  ) : null}
                  <PlaceFacts place={place} now={now} />
                  {sourceLinks(item)}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <PackNotes packId={content.pack.id} notes={content.notes} />

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
              href={offlineSource.pageUrl ?? DTP_DATASET_URL}
              target="_blank"
              rel="noopener noreferrer"
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

/** How an item's original source opens: the copy saved in the pack first — a
 *  PDF of the page, handed to the phone as a file, no signal needed — then the
 *  live page on the web behind the explanation sheet. For a layer the page is
 *  the publisher's dataset page, not the stored query URL: that URL is a WFS
 *  endpoint answering in raw JSON, never a page. */
function SourceLinks({
  item,
  file,
  href,
  onWeb,
}: {
  item: PackDetailItem;
  file?: PackFile;
  href?: string;
  onWeb: (event: MouseEvent<HTMLAnchorElement>, item: PackDetailItem) => void;
}) {
  return (
    <>
      {file && href ? (
        <>
          <a className="action" href={href} download={file.name}>
            {copy.OPEN_SOURCE_FILE}
          </a>
          <p className="muted">{copy.SOURCE_FILE_LINE(formatSavedDate(file.retrievedAt))}</p>
        </>
      ) : null}
      <a
        href={item.pageUrl ?? DTP_DATASET_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => onWeb(event, item)}
      >
        {copy.OPEN_ORIGINAL_SOURCE}
      </a>
    </>
  );
}