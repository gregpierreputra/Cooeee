import { useState, type FormEvent } from 'react';

import {
  addressQueryCanRun,
  completedSearchState,
  type AddressSearchState,
} from '../../core/address-search';
import * as copy from '../../core/copy';
import { decidePackConflict } from '../../core/pack-conflict';
import type { AddressCandidate, Pack, PendingPlace } from '../../core/types';
import { listCompletePacks } from '../../data/db';
import { fetchAddressCandidates, fetchBushfireAreaResult } from '../../data/wfs';
import { AreaCheck, type AreaCheckState } from './AreaCheck';
import { Candidates } from './Candidates';
import { Confirm } from './Confirm';
import { Conflict, ConflictBlocked } from './Conflict';

type ConflictState =
  | { kind: 'checking' }
  | { kind: 'conflict'; savedPack: Pack }
  | { kind: 'unavailable' }
  | { kind: 'invalid-multiple' };

export type SearchProps = {
  search?: (query: string) => Promise<AddressCandidate[]>;
  onPendingPlace?: (place: PendingPlace) => void;
  checkArea?: typeof fetchBushfireAreaResult;
  loadPacks?: () => Promise<Pack[]>;
  onKeepSavedPlace?: () => void;
};

/** E1-US1-AC2–AC8 address, conflict and area flow. Query, candidates and the
 * confirmed place live only in memory. Requests follow explicit choices. */
export function Search({
  search = fetchAddressCandidates,
  onPendingPlace = () => undefined,
  checkArea = fetchBushfireAreaResult,
  loadPacks = listCompletePacks,
  onKeepSavedPlace = () => window.location.assign('/'),
}: SearchProps) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<AddressSearchState>({ kind: 'search' });
  const [candidate, setCandidate] = useState<AddressCandidate | null>(null);
  const [validationVisible, setValidationVisible] = useState(false);
  const [pendingPlace, setPendingPlace] = useState<PendingPlace | null>(null);
  const [areaState, setAreaState] = useState<AreaCheckState | null>(null);
  const [conflictState, setConflictState] = useState<ConflictState | null>(null);

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

  if (pendingPlace && areaState) {
    return (
      <AreaCheck
        place={pendingPlace}
        state={areaState}
        onRetry={() => void runAreaCheck(pendingPlace)}
        onSearchAgain={() => {
          resetToSearch();
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
