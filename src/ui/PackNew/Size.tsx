import { useState } from 'react';

import { packOfferSizeLine } from '../../core/pack-offer';
import * as copy from '../../core/copy';
import type { PackOffer } from '../../core/types';

export type DownloadChoice = 'both' | 'text-only';

export type SizeProps = {
  offer: PackOffer;
  download: (choice: DownloadChoice) => Promise<void>;
};

type DownloadState =
  | { kind: 'offer' }
  | { kind: 'saving'; choice: DownloadChoice }
  | { kind: 'interrupted'; choice: DownloadChoice }
  | { kind: 'saved-text' }
  | { kind: 'saved-both' };

/** E1-US1-AC9 offer and result states. No callback runs before a button tap,
 * and the two available choices intentionally have identical visual weight. */
export function Size({ offer, download }: SizeProps) {
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
          <h1>{copy.SAVED_WITHOUT_MAP_TILES}</h1>
          <p>{copy.MAPS_NOT_DOWNLOADED}</p>
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
