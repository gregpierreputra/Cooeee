import { useState } from 'react';

import { packOfferSizeLine } from '../../core/pack-offer';
import * as copy from '../../core/copy';
import type { PackOffer } from '../../core/types';
import StateCard from '../components/StateCard';

export type SizeProps = {
  offer: PackOffer;
  address: string;
  download: () => Promise<void>;
  onContinue: () => void;
};

type DownloadState =
  | { kind: 'offer' }
  | { kind: 'saving' }
  | { kind: 'interrupted' }
  | { kind: 'saved' };

/** E1-US1-AC9 offer and result states. No callback runs before a button tap.
 *
 * Map tiles are out of Iteration 1, so there is one kind of pack and therefore
 * one action: a choice between two things, one of which cannot be built, would
 * be a decision the user does not actually have. */
export function Size({ offer, address, download, onContinue }: SizeProps) {
  const [state, setState] = useState<DownloadState>({ kind: 'offer' });

  async function run() {
    setState({ kind: 'saving' });
    try {
      await download();
      setState({ kind: 'saved' });
    } catch {
      setState({ kind: 'interrupted' });
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
          <button type="button" onClick={() => void run()}>{copy.TRY_AGAIN}</button>
        </div>
      </main>
    );
  }

  if (state.kind === 'saved') {
    return (
      <main className="page size-page">
        <div className="size-content" role="status" aria-live="polite">
          <h1>{copy.PLACE_SAVED}</h1>
          <p className="returned-address" data-testid="saved-address">{address}</p>
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

  return (
    <main className="page size-page">
      <div className="size-content">
        <h1>{copy.READY_TO_DOWNLOAD}</h1>
        <p className="pack-size figure">{packOfferSizeLine(offer)}</p>
      </div>
      <div className="actions size-actions">
        <button className="main-action" type="button" onClick={() => void run()}>
          {copy.SAVE_PACK}
        </button>
      </div>
    </main>
  );
}