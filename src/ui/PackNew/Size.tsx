import { useState } from 'react';

import { packOfferSizeLine } from '../../core/pack-offer';
import * as copy from '../../core/copy';
import type { PackOffer } from '../../core/types';
import StateCard from '../components/StateCard';

export type DownloadChoice = 'both' | 'text-only';

export type SizeProps = {
  offer: PackOffer;
  address: string;
  download: (choice: DownloadChoice) => Promise<void>;
  onContinue: () => void;
};

type DownloadState =
  | { kind: 'offer' }
  | { kind: 'saving'; choice: DownloadChoice }
  | { kind: 'interrupted'; choice: DownloadChoice }
  | { kind: 'saved-text' }
  | { kind: 'saved-both' };

/** E1-US1-AC9 offer and result states. No callback runs before a button tap,
 * and the two available choices intentionally have identical visual weight. */
export function Size({ offer, address, download, onContinue }: SizeProps) {
  const [state, setState] = useState<DownloadState>({ kind: 'offer' });

  async function run(choice: DownloadChoice) {
    setState({ kind: 'saving', choice });
    try {
      await download(choice);
      setState({ kind: choice === 'text-only' ? 'saved-text' : 'saved-both' });
    } catch {
      setState({ kind: 'interrupted', choice });
    }
  }

  if (state.kind === 'saving') {
    return (
      <main className="page size-page">
        <div role="status" aria-live="polite"><p>{copy.SAVING_PACK}</p></div>
      </main>
    );
  }

  if (state.kind === 'interrupted') {
    return (
      <main className="page size-page">
        <div className="size-content" role="status" aria-live="polite">
          <h1>{copy.DOWNLOAD_STOPPED}</h1>
          <p>{copy.PREVIOUS_PACK_UNTOUCHED}</p>
        </div>
        <div className="actions">
          <button type="button" onClick={() => void run(state.choice)}>{copy.TRY_AGAIN}</button>
        </div>
      </main>
    );
  }

  if (state.kind === 'saved-text') {
    return (
      <main className="page size-page">
        <div className="size-content" role="status" aria-live="polite">
          <h1>{copy.PLACE_SAVED}</h1>
          <p className="returned-address" data-testid="saved-address">{address}</p>
          <h2>{copy.SAVED_WITHOUT_MAP_TILES}</h2>
          <p>{copy.MAPS_NOT_DOWNLOADED}</p>
          {offer.omittedItems.length > 0 ? (
            <StateCard
              heading={offer.omittedItems.length === 1
                ? copy.ITEM_LEFT_OUT
                : copy.ITEMS_LEFT_OUT(offer.omittedItems.length)}
              detail={copy.ITEM_LEFT_OUT_REASON}
            >
              <p>{copy.PROVENANCE_STORAGE_RULE}</p>
            </StateCard>
          ) : null}
        </div>
        <div className="actions">
          <button className="main-action" type="button" onClick={onContinue}>
            {copy.OPEN_SAVED_PACK}
          </button>
        </div>
      </main>
    );
  }

  if (state.kind === 'saved-both') {
    return (
      <main className="page size-page">
        <div className="size-content" role="status" aria-live="polite">
          <h1>{copy.PLACE_SAVED}</h1>
        </div>
      </main>
    );
  }

  return (
    <main className="page size-page">
      <div className="size-content">
        <h1>{copy.READY_TO_DOWNLOAD}</h1>
        <p className="pack-size figure">{packOfferSizeLine(offer)}</p>
        {!offer.tilesAvailable ? (
          <p id="tile-unavailable" role="status">{copy.MAP_DOWNLOAD_UNAVAILABLE}</p>
        ) : null}
      </div>
      <div className="actions size-actions">
        <button
          type="button"
          disabled={!offer.tilesAvailable}
          aria-describedby={!offer.tilesAvailable ? 'tile-unavailable' : undefined}
          onClick={() => void run('both')}
        >
          {copy.DOWNLOAD_BOTH}
        </button>
        <button type="button" onClick={() => void run('text-only')}>
          {copy.TEXT_ONLY}
        </button>
      </div>
    </main>
  );
}