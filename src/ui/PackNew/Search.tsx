import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';

import {
  addressQueryCanRun,
  addressResultsAtLimit,
  liveSearchState,
  type AddressCandidateResolution,
  type SettledSearch,
} from '../../core/address-search';
import { bpaExposureLayer } from '../../core/area-check';
import { ADDRESS_QUERY_DEBOUNCE_MS, ADDRESS_RESULT_LIMIT } from '../../core/constants';
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

/** Module scope, so the default has one stable identity for the life of the
 * module. A default created inside the component would be a new function on
 * every render, and a live search keyed on it would restart on every state
 * change — one request per keystroke of feedback, forever. */
const searchAddressRegister = (query: string, signal: AbortSignal) =>
  fetchAddressCandidates(query, undefined, undefined, signal);

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
  search?: (query: string, signal: AbortSignal) => Promise<AddressCandidateResolution>;
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
 * the user explicitly consents to a size; nothing is written before that.
 *
 * The address search runs while the user types, from ADDRESS_QUERY_MIN_CHARS and
 * after ADDRESS_QUERY_DEBOUNCE_MS of quiet. Two rules hold it honest and both are
 * structural rather than careful:
 *   1. Everything the screen may say comes from core's liveSearchState, and a
 *      result claim is reachable only through an answer that still carries the
 *      query in the field. A pending debounce, a request in flight and an answer
 *      to earlier text are one indistinguishable 'pending' state that claims
 *      nothing.
 *   2. A superseded request is aborted on the wire, and its response is dropped
 *      on arrival by request id even so. Two independent reasons a stale answer
 *      cannot land. */
export function Search({
  search = searchAddressRegister,
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
  const [settled, setSettled] = useState<SettledSearch | null>(null);
  const [dismissed, setDismissed] = useState(false);
  // Bumped by every keystroke and by every explicit run, so the debounce restarts
  // on each. `immediate` is an explicit run — Enter, Search, or Try again — which
  // does not wait out a pause the user has already ended themselves.
  const [attempt, setAttempt] = useState({ token: 0, immediate: false });
  const [candidate, setCandidate] = useState<AddressCandidate | null>(null);
  // Synchronous, because it guards against a second request within one tick.
  const requestIdRef = useRef(0);
  const inFlightQueryRef = useRef<string | null>(null);
  const [pendingPlace, setPendingPlace] = useState<PendingPlace | null>(null);
  const [areaState, setAreaState] = useState<AreaCheckState | null>(null);
  const [conflictState, setConflictState] = useState<ConflictState | null>(null);
  const [supersedesId, setSupersedesId] = useState<string | undefined>(undefined);
  const [offerState, setOfferState] = useState<OfferState | null>(null);

  const trimmedQuery = query.trim();
  const live = liveSearchState(query, settled, dismissed);

  // Read through a ref so that a caller passing an inline function cannot make
  // the search restart on every render. Only the typed query and an explicit run
  // may start a request.
  const searchRef = useRef(search);
  useEffect(() => {
    searchRef.current = search;
  }, [search]);

  // The typed prefix leaves the device only from here: once per settled query,
  // after the debounce, and never below ADDRESS_QUERY_MIN_CHARS.
  useEffect(() => {
    if (!addressQueryCanRun(trimmedQuery)) return;

    const controller = new AbortController();
    const id = requestIdRef.current + 1;

    async function run() {
      requestIdRef.current = id;
      inFlightQueryRef.current = trimmedQuery;
      try {
        const resolution = await searchRef.current(trimmedQuery, controller.signal);
        // A newer query owns the screen; this answer is about older text.
        if (id !== requestIdRef.current) return;
        setSettled({ query: trimmedQuery, outcome: { kind: 'resolved', resolution } });
      } catch {
        // Our own cancellation is not the register failing to answer. A request
        // we superseded or abandoned says nothing about whether a search can
        // run, so it must never settle as AC4's unavailable state.
        if (controller.signal.aborted || id !== requestIdRef.current) return;
        setSettled({ query: trimmedQuery, outcome: { kind: 'failed' } });
      } finally {
        if (id === requestIdRef.current) inFlightQueryRef.current = null;
      }
    }

    if (attempt.immediate) {
      void run();
      return () => controller.abort();
    }

    const timer = setTimeout(() => void run(), ADDRESS_QUERY_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // `attempt` changes on every keystroke, so the cleanup above is the debounce
    // and the cancellation at once.
  }, [trimmedQuery, attempt]);

  function handleQueryChange(event: ChangeEvent<HTMLInputElement>) {
    setQuery(event.currentTarget.value);
    // Dismissal lasts until the query changes — including a change back to text
    // that was searched before, which is a fresh request and a fresh list.
    setDismissed(false);
    setAttempt((previous) => ({ token: previous.token + 1, immediate: false }));
  }

  /** Enter, Search, Search again and Try again: run this query now. A request
   * already in flight for this exact text is left to finish, so an explicit tap
   * during the wait cannot double the outbound requests. */
  function runSearchNow() {
    if (inFlightQueryRef.current === trimmedQuery) return;
    setDismissed(false);
    setSettled(null);
    setAttempt((previous) => ({ token: previous.token + 1, immediate: true }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runSearchNow();
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
      const offer = await buildOffer(content);
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
  }

  if (pendingPlace && conflictState?.kind === 'checking') {
    return (
      <main className="page conflict-page">
        <p className="eyebrow">{copy.EYEBROW_SET_UP_YOUR_PLACE}</p>
        <div className="card" role="status" aria-live="polite"><p>{copy.CHECKING_SAVED_PLACE}</p></div>
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
          <p className="eyebrow">{copy.EYEBROW_SAVE_YOUR_PACK}</p>
          <div className="card" role="status" aria-live="polite"><p>{copy.PREPARING_PACK_OFFER}</p></div>
        </main>
      );
    }

    if (offerState.kind === 'failed') {
      return (
        <main className="page size-page">
          <p className="eyebrow">{copy.EYEBROW_SAVE_YOUR_PACK}</p>
          <div className="card" role="status" aria-live="polite"><p>{copy.PACK_OFFER_FAILED}</p></div>
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
        download={async () => {
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
        onSearchAgain={() => setCandidate(null)}
      />
    );
  }

  return (
    <main className="page search-page">
      <form className="search-form" onSubmit={handleSubmit}>
        <div className="search-content">
          <p className="eyebrow">{copy.EYEBROW_SET_UP_YOUR_PLACE}</p>
          <h1>{copy.ADDRESS_SEARCH_TITLE}</h1>
          <label htmlFor="address-query">{copy.ADDRESS_FIELD_LABEL}</label>
          <input
            id="address-query"
            name="addressQuery"
            value={query}
            autoComplete="off"
            aria-describedby="address-result"
            onChange={handleQueryChange}
          />

          {/* One polite live region for the field. It carries the count when the
              list changes under a screen reader, which the list markup alone
              does not announce, and it is the only place a result is claimed. */}
          <div id="address-result" className="card search-result" role="status" aria-live="polite">
            {live.kind === 'too-short' ? <p>{copy.ADDRESS_QUERY_TOO_SHORT}</p> : null}
            {live.kind === 'pending' ? <p>{copy.SEARCH_IN_PROGRESS}</p> : null}
            {live.kind === 'dismissed' ? <p>{copy.REFINE_ADDRESS_HINT}</p> : null}
            {live.kind === 'no-match' ? <p>{copy.NO_ADDRESS_MATCH}</p> : null}
            {live.kind === 'candidates' ? (
              <>
                <p>{copy.ADDRESS_RESULT_COUNT(live.returnedCount, live.candidates.length)}</p>
                {addressResultsAtLimit(live.returnedCount) ? (
                  <p>{copy.ADDRESS_RESULT_CAPPED(ADDRESS_RESULT_LIMIT)}</p>
                ) : null}
              </>
            ) : null}
            {live.kind === 'unavailable' ? (
              <>
                <p>{copy.SEARCH_COULD_NOT_RUN}</p>
                <p>{copy.SEARCH_FAILURE_MEANING}</p>
              </>
            ) : null}
          </div>

          {live.kind === 'candidates' ? (
            <Candidates
              candidates={live.candidates}
              unresolvedCount={live.unresolvedCount}
              onChoose={setCandidate}
              onNone={() => setDismissed(true)}
            />
          ) : null}
        </div>

        {/* One primary action, labelled for the state it is in. It is never
            disabled: a search that has not answered yet must still be re-runnable
            by hand, and a tap during a request in flight is a no-op, not a second
            request. */}
        <div className="actions search-actions">
          {live.kind === 'unavailable' ? (
            <button className="main-action" type="button" onClick={runSearchNow}>
              {copy.TRY_AGAIN}
            </button>
          ) : live.kind === 'no-match' ? (
            <button className="main-action" type="button" onClick={runSearchNow}>
              {copy.SEARCH_AGAIN}
            </button>
          ) : (
            <button className="main-action" type="submit">
              {copy.SEARCH}
            </button>
          )}
        </div>
      </form>
    </main>
  );
}