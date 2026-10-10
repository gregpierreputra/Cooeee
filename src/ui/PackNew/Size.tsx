import { useEffect, useState } from 'react';

import { packOfferSize } from '../../core/pack-offer';
import { Link } from 'react-router';
import * as copy from '../../core/copy';
import type { PackOffer } from '../../core/types';
import BackHomeLink from '../components/BackHomeLink';
import StateCard from '../components/StateCard';
import Glyph from '../components/Glyph';
import { focusMain } from '../components/focusMain';
import FlowSteps from './FlowSteps';

/** What the steps before chose, said back in words on the save step. */
export type PackSummary = {
  name: string;
  address: string;
  area: string;
  places: string[];
  note: string;
};

type SizeProps = {
  summary: PackSummary;
  /** Null while the pack is still being prepared. */
  offer: PackOffer | null;
  save: () => Promise<void>;
  onContinue: () => void;
};

type SaveState =
  | { kind: 'ready' }
  | { kind: 'saving' }
  | { kind: 'interrupted'; full: boolean }
  | { kind: 'saved' };

/** A full device, as the browser or Dexie reports it: Dexie wraps it in
 *  `inner`, or, when a bulk write is refused row by row, in `failures`. Every
 *  other failure keeps the plain interrupted wording. */
const isStorageFull = (error: unknown): boolean => {
  const named = (value: unknown) => (value as { name?: unknown } | null)?.name === 'QuotaExceededError';
  const { inner, failures } = (error ?? {}) as { inner?: unknown; failures?: unknown };
  return named(error) || named(inner) || (Array.isArray(failures) && failures.some(named));
};

/** E1-US1-AC9 the save step, on one screen from preparing to saved: the
 *  summary of what the pack holds stays put, and only the heading, the
 *  status line and the buttons change. No callback runs before a button tap.
 *
 * Map tiles are out of Iteration 1, so there is one kind of pack and therefore
 * one action: a choice between two things, one of which cannot be built, would
 * be a decision the user does not actually have. */
export function Size({ summary, offer, save, onContinue }: SizeProps) {
  const [state, setState] = useState<SaveState>({ kind: 'ready' });
  // The heading changes once the save ends either way, so focus starts there again.
  useEffect(() => {
    if (state.kind === 'saved' || state.kind === 'interrupted') focusMain();
  }, [state.kind]);

  async function run() {
    setState({ kind: 'saving' });
    try {
      await save();
      setState({ kind: 'saved' });
    } catch (error) {
      setState({ kind: 'interrupted', full: isStorageFull(error) });
    }
  }

  const saved = state.kind === 'saved';
  const pending = copy.SUMMARY_PENDING;
  const rows: { label: string; value: string | string[] }[] = [
    { label: copy.SUMMARY_AREA, value: summary.area },
    { label: copy.SUMMARY_PLACES, value: summary.places.length > 0 ? summary.places : copy.SUMMARY_NONE },
    { label: copy.SUMMARY_NOTE, value: summary.note },
    { label: copy.SUMMARY_PROGRAMS, value: offer ? copy.SUMMARY_PROGRAMS_VALUE(offer.textManifest.recovery.count) : pending },
    { label: copy.SUMMARY_SIZE, value: offer ? packOfferSize(offer) : pending },
  ];

  const status =
    offer === null ? <p>{copy.PREPARING_PACK_OFFER}</p>
    : state.kind === 'saving' ? <p>{copy.SAVING_PACK}</p>
    : state.kind === 'interrupted' ? (
      <>
        <p className="save-stopped">{copy.SAVE_STOPPED}</p>
        {state.full ? <p>{copy.NOT_ENOUGH_SPACE}</p> : null}
        <p>{copy.PREVIOUS_PACK_UNTOUCHED}</p>
      </>
    )
    : null;

  return (
    <main className="page size-page">
      <div className="size-content">
        <header className="hero">
          <FlowSteps at={4} />
          {saved ? (
            <div className="card-head">
              <Glyph kind="does" />
              <h1>{copy.PLACE_SAVED}</h1>
            </div>
          ) : (
            <h1>{copy.READY_TO_SAVE}</h1>
          )}
        </header>
        <div className="card pack-summary">
          <div className="pack-summary-place">
            <p className="pack-summary-name">{summary.name}</p>
            <p className="pack-summary-address" data-testid="saved-address">{summary.address}</p>
          </div>
          <dl className="source-rows">
            {rows.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd>
                  {Array.isArray(row.value) ? (
                    <ul className="pack-summary-list">
                      {row.value.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  ) : row.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="size-status" role="status" aria-live="polite">
          {status}
        </div>
        {saved && offer && offer.omittedItems.length > 0 ? (
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
      <div className="actions size-actions">
        {saved ? (
          <>
            <button className="main-action" type="button" onClick={onContinue}>
              {copy.OPEN_SAVED_PACK}
            </button>
            {offer?.textManifest.recovery.count === 0 ? (
              <Link className="action" to="/recover">{copy.CHOOSE_IN_RECOVER}</Link>
            ) : null}
            <BackHomeLink />
          </>
        ) : (
          <button
            className="main-action with-glyph"
            type="button"
            disabled={offer === null || state.kind === 'saving'}
            onClick={() => void run()}
          >
            <Glyph kind="bag" line />
            {state.kind === 'interrupted' ? copy.TRY_AGAIN : copy.SAVE_PACK}
          </button>
        )}
      </div>
    </main>
  );
}
