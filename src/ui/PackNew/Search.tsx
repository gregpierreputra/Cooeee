import { useState, type FormEvent } from 'react';

import {
  addressQueryCanRun,
  completedSearchState,
  type AddressSearchState,
} from '../../core/address-search';
import { bpaExposureLayer } from '../../core/area-check';
import * as copy from '../../core/copy';
import { decidePackConflict } from '../../core/pack-conflict';
import { buildPackSeed } from '../../core/pack';
import type {
  AddressCandidate,
  BushfireAreaResult,
  Pack,
  PackOffer,
  PendingPlace,
  TextPackContent,
} from '../../core/types';
import { listCompletePacks } from '../../data/db';
import { createPackOffer, saveTextOnlyPack } from '../../data/pack-build';
import { fetchAddressCandidates, fetchBushfireAreaResult } from '../../data/wfs';
import { AreaCheck, type AreaCheckState } from './AreaCheck';
import { Candidates } from './Candidates';
import { Confirm } from './Confirm';
import { Conflict, ConflictBlocked } from './Conflict';
import { Size } from './Size';

type ConflictState =
  | { kind: 'checking' }
  | { kind: 'conflict'; savedPack: Pack }
  | { kind: 'unavailable' }
  | { kind: 'invalid-multiple' };

type OfferState =
  | { kind: 'building' }
  | { kind: 'ready'; offer: PackOffer; content: TextPackContent }
  | { kind: 'failed'; result: BushfireAreaResult };

export type SearchProps = {
  search?: (query: string) => Promise<AddressCandidate[]>;
  onPendingPlace?: (place: PendingPlace) => void;
  checkArea?: typeof fetchBushfireAreaResult;
  loadPacks?: () => Promise<Pack[]>;
  onKeepSavedPlace?: () => void;
  buildOffer?: typeof createPackOffer;
  savePack?: typeof saveTextOnlyPack;
  makePackId?: () => string;
  now?: () => number;
  onPackSaved?: (packId: string) => void;
};

/** E1-US1-AC1–AC9 address, conflict, area and pack-save flow. Query, candidates
 * and the confirmed place live only in memory until the area check succeeds and
 * the user explicitly consents to a size; nothing is written before that. */
export function Search({
  search = fetchAddressCandidates,
  onPendingPlace = () => undefined,
  checkArea = fetchBushfireAreaResult,
  loadPacks = listCompletePacks,
  onKeepSavedPlace = () => window.location.assign('/'),
  buildOffer = createPackOffer,
  savePack = saveTextOnlyPack,
  makePackId = () => crypto.randomUUID(),
  now = Date.now,
  onPackSaved = (packId: string) => window.location.assign(`/packs/${packId}`),
}: SearchProps) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<AddressSearchState>({ kind: 'search' });
  const [candidate, setCandidate] = useState<AddressCandidate | null>(null);
  const [validationVisible, setValidationVisible] = useState(false);
  const [pendingPlace, setPendingPlace] = useState<PendingPlace | null>(null);
  const [areaState, setAreaState] = useState<AreaCheckState | null>(null);
  const [conflictState, setConflictState] = useState<ConflictState | null>(null);
  const [supersedesId, setSupersedesId] = useState<string | undefined>(undefined);
  const [offerState, setOfferState] = useState<OfferState | null>(null);

  async function runSearch() {
    if (!addressQueryCanRun(query)) {
      setValidationVisible(true);
      return;
    }

    setValidationVisible(false);
    setState({ kind: 'searching' });
    try {
      setState(completedSearchState(await search(query)));
    } catch {
      setState({ kind: 'unavailable' });
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSearch();
  }

  async function runAreaCheck(place: PendingPlace) {
    setAreaState({ kind: 'checking' });
    try {
      setAreaState({ kind: 'result', result: await checkArea(place) });
    } catch {
      setAreaState({ kind: 'unavailable' });
    }
  }

  async function buildPackOfferForResult(place: PendingPlace, result: BushfireAreaResult) {
    setOfferState({ kind: 'building' });
    try {
      const seed = buildPackSeed(makePackId(), now(), place, result.lgaName, result.source, supersedesId);
      const content: TextPackContent = {
        pack: seed,
        layers: [bpaExposureLayer(seed.id, result)],
        destinations: [],
        recovery: [],
      };
      const offer = await buildOffer(content, { bytes: 0, count: 0, available: false });
      setOfferState({ kind: 'ready', offer, content });
    } catch {
      setOfferState({ kind: 'failed', result });
    }
  }

  async function handleConfirmedPlace(place: PendingPlace) {
    onPendingPlace(place);
    setPendingPlace(place);
    setConflictState({ kind: 'checking' });
    try {
      const decision = decidePackConflict(await loadPacks());
      if (decision.kind === 'none') {
        setConflictState(null);
        await runAreaCheck(place);
      } else if (decision.kind === 'conflict') {
        setConflictState(decision);
      } else {
        setConflictState({ kind: 'invalid-multiple' });
      }
    } catch {
      setConflictState({ kind: 'unavailable' });
    }
  }

  function resetToSearch() {
    setPendingPlace(null);
    setAreaState(null);
    setConflictState(null);
    setCandidate(null);
    setSupersedesId(undefined);
    setOfferState(null);
    setState({ kind: 'search' });
  }

  if (pendingPlace && conflictState?.kind === 'checking') {
    return (
      <main className="page conflict-page">
        <div role="status" aria-live="polite"><p>{copy.CHECKING_SAVED_PLACE}</p></div>
      </main>
    );
  }

  if (pendingPlace && conflictState?.kind === 'conflict') {
    return (
      <Conflict
        savedAddress={conflictState.savedPack.address}
        newAddress={pendingPlace.address}
        onKeep={() => {
          onKeepSavedPlace();
          resetToSearch();
        }}
        onReplace={() => {
          setSupersedesId(conflictState.savedPack.id);
          setConflictState(null);
          void runAreaCheck(pendingPlace);
        }}
      />
    );
  }

  if (conflictState?.kind === 'unavailable' || conflictState?.kind === 'invalid-multiple') {
    return (
      <ConflictBlocked
        multiple={conflictState.kind === 'invalid-multiple'}
        onSearchAgain={resetToSearch}
      />
    );
  }

  if (pendingPlace && offerState) {
    if (offerState.kind === 'building') {
      return (
        <main className="page size-page">
          <div role="status" aria-live="polite"><p>{copy.PREPARING_PACK_OFFER}</p></div>
        </main>
      );
    }

    if (offerState.kind === 'failed') {
      return (
        <main className="page size-page">
          <div role="status" aria-live="polite"><p>{copy.PACK_OFFER_FAILED}</p></div>
          <div className="actions">
            <button
              className="main-action"
              type="button"
              onClick={() => void buildPackOfferForResult(pendingPlace, offerState.result)}
            >
              {copy.TRY_AGAIN}
            </button>
            <button type="button" onClick={resetToSearch}>
              {copy.SEARCH_AGAIN}
            </button>
          </div>
        </main>
      );
    }

    return (
      <Size
        offer={offerState.offer}
        address={offerState.content.pack.address}
        download={async (choice) => {
          if (choice === 'both') throw new Error('map download is not available yet');
          await savePack(offerState.content, offerState.offer, now());
        }}
        onContinue={() => onPackSaved(offerState.content.pack.id)}
      />
    );
  }

  if (pendingPlace && areaState) {
    return (
      <AreaCheck
        place={pendingPlace}
        state={areaState}
        onRetry={() => void runAreaCheck(pendingPlace)}
        onSearchAgain={() => {
          resetToSearch();
        }}
        onContinue={() => {
          if (areaState.kind === 'result') void buildPackOfferForResult(pendingPlace, areaState.result);
        }}
      />
    );
  }

  if (candidate) {
    return (
      <Confirm
        candidate={candidate}
        onConfirm={(place) => void handleConfirmedPlace(place)}
        onSearchAgain={() => {
          setCandidate(null);
          setState({ kind: 'search' });
        }}
      />
    );
  }

  if (state.kind === 'candidates') {
    return (
      <Candidates
        candidates={state.candidates}
        onChoose={setCandidate}
        onNone={() => setState({ kind: 'search' })}
      />
    );
  }

  const searching = state.kind === 'searching';
  const noMatch = state.kind === 'no-match';
  const unavailable = state.kind === 'unavailable';

  return (
    <main className="page search-page">
      <form className="search-form" onSubmit={handleSubmit}>
        <div className="search-content">
          <h1>{copy.ADDRESS_SEARCH_TITLE}</h1>
          <label htmlFor="address-query">{copy.ADDRESS_FIELD_LABEL}</label>
          <input
            id="address-query"
            name="addressQuery"
            value={query}
            aria-describedby="address-result"
            aria-invalid={validationVisible || undefined}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />

          <div id="address-result" className="search-result" role="status" aria-live="polite">
            {validationVisible ? <p>{copy.ADDRESS_QUERY_TOO_SHORT}</p> : null}
            {searching ? <p>{copy.SEARCH_IN_PROGRESS}</p> : null}
            {noMatch ? <p>{copy.NO_ADDRESS_MATCH}</p> : null}
            {unavailable ? (
              <>
                <p>{copy.SEARCH_COULD_NOT_RUN}</p>
                <p>{copy.SEARCH_FAILURE_MEANING}</p>
              </>
            ) : null}
          </div>
        </div>

        <div className="actions search-actions">
          {noMatch ? (
            <button type="button" onClick={() => setState({ kind: 'search' })}>
              {copy.SEARCH_AGAIN}
            </button>
          ) : unavailable ? (
            <button className="main-action" type="button" onClick={() => void runSearch()}>
              {copy.TRY_AGAIN}
            </button>
          ) : (
            <button className="main-action" type="submit" disabled={searching}>
              {copy.SEARCH}
            </button>
          )}
        </div>
      </form>
    </main>
  );
}