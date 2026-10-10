import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import {
  addressQueryCanRun,
  addressResultsAtLimit,
  liveSearchState,
  type AddressCandidateResolution,
  type SettledSearch,
} from '../../core/address-search';
import { bpaExposureLayer } from '../../core/area-check';
import {
  ADDRESS_QUERY_DEBOUNCE_MS,
  ADDRESS_QUERY_MAX_CHARS,
  isInsideVictoria,
  LOCATE_ROUGH_M,
  LOCATE_TOO_ROUGH_M,
  NEARBY_FIX_TIMEOUT_MS,
  PACK_HAZARD,
  PLACES_OFFERED,
} from '../../core/constants';
import * as copy from '../../core/copy';
import { chosenDestinations, formatDistanceM, orderByDistance } from '../../core/destination';
import { titleCase } from '../../core/home';
import { destinationsForPack, selectSitesForPack, toDestination } from '../../core/nsp';
import { readKept } from '../../core/kept';
import { buildPackSeed, defaultPackName, samePackName } from '../../core/pack';
import { packProgramsFor } from '../../core/recover';
import type {
  AddressCandidate,
  BushfireAreaResult,
  Destination,
  NspSite,
  NspSnapshot,
  Pack,
  PackFile,
  PackNote,
  PackOffer,
  PendingPlace,
  RecoveryProgram,
  TextPackContent,
} from '../../core/types';
import { listCompletePacks, listNotes, listPrograms, listSavedPackNames } from '../../data/db';
import { localFlagStore } from '../../data/acknowledgement';
import { loadNspSnapshot } from '../../data/nsp';
import { createPackOffer, saveTextOnlyPack } from '../../data/pack-build';
import { loadPackFiles } from '../../data/source-files';
import {
  fetchAddressCandidates,
  fetchAddressesNear,
  fetchBushfireAreaResult,
} from '../../data/wfs';
import Glyph from '../components/Glyph';
import Hint from '../components/Hint';
import StatusPage from '../components/StatusPage';
import { focusMain } from '../components/focusMain';
import { AreaCheck, type AreaCheckState } from './AreaCheck';
import { setBuilderBack } from './builder-back';
import { Candidates } from './Candidates';
import { Confirm } from './Confirm';
import { Conflict } from './Conflict';
import { Destinations } from './Destinations';
import FlowSteps from './FlowSteps';
import { Note } from './Note';
import { Size } from './Size';

/** Module scope, so the default has one stable identity for the life of the
 * module. A default created inside the component would be a new function on
 * every render, and a live search keyed on it would restart on every state
 * change — one request per keystroke of feedback, forever. */
const searchAddressRegister = (query: string, signal: AbortSignal) =>
  fetchAddressCandidates(query, undefined, signal);

/** The line above the field for the typed search, one short sentence per state. */
function typedSearchLine(live: ReturnType<typeof liveSearchState>): string {
  switch (live.kind) {
    case 'too-short':
      return copy.ADDRESS_QUERY_TOO_SHORT;
    case 'pending':
      return copy.SEARCH_IN_PROGRESS;
    case 'dismissed':
      return copy.REFINE_ADDRESS_HINT;
    case 'no-match':
      return copy.NO_ADDRESS_MATCH;
    case 'unavailable':
      return `${copy.SEARCH_COULD_NOT_RUN} ${copy.SEARCH_FAILURE_MEANING}`;
    case 'candidates': {
      const count = copy.ADDRESS_RESULT_COUNT(live.candidates.length);
      return addressResultsAtLimit(live.returnedCount) ? `${count}. ${copy.ADDRESS_RESULT_CAPPED}` : count;
    }
  }
}

/** The builder's steps, in order. Back goes to the one before. */
type Step = 'search' | 'confirm' | 'conflict' | 'area' | 'places' | 'note' | 'size';

type ConflictState =
  | { kind: 'checking' }
  | { kind: 'conflict'; savedPack: Pack }
  | { kind: 'unavailable' };

type OfferState =
  | { kind: 'building' }
  | { kind: 'ready'; offer: PackOffer; content: TextPackContent; files: PackFile[] }
  | { kind: 'failed'; result: BushfireAreaResult; destinations: Destination[] };

/** E2-US1/US2: the official places of last resort for the confirmed place,
 * read from the precached CFA snapshot. Nothing here is written to the device. */
type PlacesState =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | {
      kind: 'ready';
      snapshot: NspSnapshot;
      selection: { located: NspSite[]; unlocated: NspSite[] };
      ordered: Destination[];
      unlocated: Destination[];
    };

type SearchProps = {
  search?: (query: string, signal: AbortSignal) => Promise<AddressCandidateResolution>;
  onPendingPlace?: (place: PendingPlace) => void;
  checkArea?: typeof fetchBushfireAreaResult;
  loadPacks?: () => Promise<Pack[]>;
  loadNsp?: () => Promise<NspSnapshot>;
  loadFiles?: typeof loadPackFiles;
  loadPrograms?: () => Promise<RecoveryProgram[]>;
  onKeepSavedPlace?: () => void;
  buildOffer?: typeof createPackOffer;
  savePack?: typeof saveTextOnlyPack;
  /** The notes the pack being replaced holds. */
  loadNotes?: (packId: string) => Promise<PackNote[]>;
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
  loadNsp = loadNspSnapshot,
  loadFiles = loadPackFiles,
  loadPrograms = listPrograms,
  onKeepSavedPlace,
  buildOffer = createPackOffer,
  savePack = saveTextOnlyPack,
  loadNotes = listNotes,
  makePackId = () => crypto.randomUUID(),
  now = Date.now,
  onPackSaved,
}: SearchProps) {
  // Client-side navigation: a full document load would restart the offline
  // shell right after a save, which is the worst moment for it. Both leave the
  // wizard for good, so they replace its history entry: Back from the pack
  // never returns into a finished wizard.
  const navigate = useNavigate();
  const keepSavedPlace = onKeepSavedPlace ?? (() => navigate('/', { replace: true }));
  const openSavedPack =
    onPackSaved ?? ((packId: string) => navigate(`/packs/${packId}`, { replace: true }));
  const [query, setQuery] = useState('');
  const [settled, setSettled] = useState<SettledSearch | null>(null);
  const [dismissed, setDismissed] = useState(false);
  // Bumped by every keystroke and by every explicit run, so the debounce restarts
  // on each. `immediate` is an explicit run — Enter or Try again — which
  // does not wait out a pause the user has already ended themselves.
  const [attempt, setAttempt] = useState({ immediate: false });
  const [candidate, setCandidate] = useState<AddressCandidate | null>(null);
  // Use my location: the addresses nearest a position, shown in place of the
  // typed search until the user types again. The position is never kept.
  const [locating, setLocating] = useState(false);
  const [located, setLocated] = useState<AddressCandidate[] | null>(null);
  const [locateNotice, setLocateNotice] = useState<string | null>(null);
  // How rough the position behind the list is, when too rough to pick out one house.
  const [roughM, setRoughM] = useState<number | null>(null);
  // Bumped by every tap and every keystroke, so a late answer is dropped.
  const locateIdRef = useRef(0);
  // Stops the nearby lookup on the wire when the user moves on: its wider
  // radii would otherwise still go out, each carrying the position.
  const locateAbortRef = useRef<AbortController | null>(null);
  // Synchronous, because it guards against a second request within one tick.
  const requestIdRef = useRef(0);
  const inFlightQueryRef = useRef<string | null>(null);
  const [pendingPlace, setPendingPlace] = useState<PendingPlace | null>(null);
  const [areaState, setAreaState] = useState<AreaCheckState | null>(null);
  const [conflictState, setConflictState] = useState<ConflictState | null>(null);
  // A name another saved pack already has, shown on the name step.
  const [takenName, setTakenName] = useState<string | undefined>(undefined);
  // The saved packs' names, read from the phone once as the builder opens, so
  // the name step can start on a name no other pack has. A store that cannot
  // be read gives none, and the check on Save is still made.
  const [savedNames, setSavedNames] = useState<string[]>([]);
  useEffect(() => {
    listSavedPackNames().then(setSavedNames, () => {});
  }, []);
  const [supersedes, setSupersedes] = useState<Pack | undefined>(undefined);
  // On a replace, the old pack's notes: how many, and whether they come along.
  const [oldNotes, setOldNotes] = useState<PackNote[]>([]);
  const [keepNotes, setKeepNotes] = useState(true);
  const [offerState, setOfferState] = useState<OfferState | null>(null);
  const [placesState, setPlacesState] = useState<PlacesState | null>(null);
  // The places the user chose, held while the note step is on screen, and the
  // note itself once it is past. Both in memory only until the pack save.
  const [chosenPlaces, setChosenPlaces] = useState<Destination[] | null>(null);
  const [note, setNote] = useState<string | undefined>(undefined);
  // Made once per confirmed place, before the places step: destination rows
  // carry the pack id, so the id must exist before the user chooses them.
  const [packId, setPackId] = useState('');
  // The places ticked, kept so going back to the places step shows them again.
  const [placeIds, setPlaceIds] = useState<string[]>([]);
  const [saveStage, setSaveStage] = useState<'idle' | 'saving' | 'saved'>('idle');
  // Bumped by every step back, so an answer to a step the user has left is dropped.
  const flowRef = useRef(0);

  const trimmedQuery = query.trim();
  // While Use my location owns the list the typed search claims nothing. A
  // notice alone does not: a failed fix leaves the typed search as it was.
  const byPosition = locating || located !== null;
  const live = byPosition
    ? ({ kind: 'dismissed' } as const)
    : liveSearchState(query, settled, dismissed);
  const statusLine = locating
    ? copy.LOCATING
    : located
      ? roughM === null
        ? copy.ADDRESS_LOCATE_FOUND
        : copy.ADDRESS_LOCATE_ROUGH(formatDistanceM(roughM))
      : (locateNotice ?? typedSearchLine(live));

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

  // Leaving the screen stops a nearby lookup still on the wire, and drops a
  // position still to come: the fix must not reach the register after the
  // user has left.
  useEffect(() => () => {
    locateIdRef.current += 1;
    locateAbortRef.current?.abort();
  }, []);

  function clearLocated() {
    locateIdRef.current += 1;
    locateAbortRef.current?.abort();
    locateAbortRef.current = null;
    setLocating(false);
    setLocated(null);
    setLocateNotice(null);
    setRoughM(null);
  }

  /** Read one position, then ask the register for the addresses nearest it.
   * A position outside Victoria is never sent. Every failure leaves the typed
   * search exactly as it was. */
  function locate() {
    clearLocated();
    if (!('geolocation' in navigator)) {
      setLocateNotice(copy.ADDRESS_LOCATE_FAILED);
      return;
    }
    const id = locateIdRef.current;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        if (id !== locateIdRef.current) return;
        const position = { lat: coords.latitude, lon: coords.longitude };
        let notice: string | null = null;
        let candidates: AddressCandidate[] | null = null;
        if (!isInsideVictoria(position.lat, position.lon)) {
          notice = copy.ADDRESS_LOCATE_OUTSIDE;
        } else if (coords.accuracy > LOCATE_TOO_ROUGH_M) {
          notice = copy.ADDRESS_LOCATE_TOO_ROUGH;
        } else {
          try {
            const controller = new AbortController();
            locateAbortRef.current = controller;
            candidates = (await fetchAddressesNear(position, undefined, controller.signal)).candidates;
            if (candidates.length === 0) notice = copy.ADDRESS_LOCATE_NONE;
          } catch {
            notice = copy.SEARCH_COULD_NOT_RUN;
          }
        }
        if (id !== locateIdRef.current) return;
        setLocating(false);
        setLocateNotice(notice);
        setLocated(notice ? null : candidates);
        setRoughM(coords.accuracy > LOCATE_ROUGH_M ? coords.accuracy : null);
      },
      (error) => {
        if (id !== locateIdRef.current) return;
        setLocating(false);
        setLocateNotice(
          error.code === error.PERMISSION_DENIED
            ? copy.ADDRESS_LOCATE_DENIED
            : error.code === error.TIMEOUT
              ? copy.ADDRESS_LOCATE_SLOW
              : copy.ADDRESS_LOCATE_FAILED,
        );
      },
      // A fresh position every tap: an older one may be the rough guess just shown.
      { enableHighAccuracy: true, timeout: NEARBY_FIX_TIMEOUT_MS, maximumAge: 0 },
    );
  }

  function handleQueryChange(event: ChangeEvent<HTMLInputElement>) {
    clearLocated();
    setQuery(event.currentTarget.value);
    // Dismissal lasts until the query changes — including a change back to text
    // that was searched before, which is a fresh request and a fresh list.
    setDismissed(false);
    setAttempt({ immediate: false });
  }

  /** Enter and Try again: run this query now. A request
   * already in flight for this exact text is left to finish, so an explicit tap
   * during the wait cannot double the outbound requests. */
  function runSearchNow() {
    clearLocated();
    if (inFlightQueryRef.current === trimmedQuery) return;
    setDismissed(false);
    setSettled(null);
    setAttempt({ immediate: true });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runSearchNow();
  }

  async function runAreaCheck(place: PendingPlace) {
    const flow = flowRef.current;
    setAreaState({ kind: 'checking' });
    try {
      const result = await checkArea(place);
      if (flow === flowRef.current) setAreaState({ kind: 'result', result });
    } catch {
      if (flow === flowRef.current) setAreaState({ kind: 'unavailable' });
    }
  }

  async function runPlaces(place: PendingPlace, result: BushfireAreaResult) {
    // The same id when the places are shown again, so the ticks still match.
    const id = packId || makePackId();
    setPackId(id);
    const flow = flowRef.current;
    setPlacesState({ kind: 'loading' });
    try {
      const snapshot = await loadNsp();
      if (flow !== flowRef.current) return;
      const selection = selectSitesForPack(
        snapshot.sites,
        place,
        result.lgaName,
        PLACES_OFFERED,
        PACK_HAZARD,
      );
      const asRow = (site: NspSite) => toDestination(site, id, snapshot);
      const { ordered } = orderByDistance(selection.located.map(asRow), place);
      const unlocated = selection.unlocated.map(asRow);
      setPlacesState({ kind: 'ready', snapshot, selection, ordered, unlocated });
    } catch {
      if (flow === flowRef.current) setPlacesState({ kind: 'unavailable' });
    }
  }

  async function buildPackOfferForResult(
    place: PendingPlace,
    result: BushfireAreaResult,
    destinations: Destination[],
  ) {
    const flow = flowRef.current;
    setOfferState({ kind: 'building' });
    try {
      // The programs saved in Recover go into the pack, or none if nothing is
      // saved. A store that cannot be read gives none, never a failed pack.
      const programs = await loadPrograms().catch(() => []);
      // A replacement keeps the date its place was first saved, so refreshing a
      // pack never moves it on Home.
      const createdAt = supersedes?.createdAt ?? now();
      const seed = buildPackSeed(packId, createdAt, place, result.lgaName, result.source, supersedes?.id);
      const content: TextPackContent = {
        pack: seed,
        layers: [bpaExposureLayer(seed.id, result)],
        destinations,
        // Copied so the pack carries them and their pages with no signal.
        recovery: packProgramsFor(seed.id, programs, readKept(localFlagStore())),
      };
      // The PDF copies of the source pages and the map of the area travel with
      // the pack, so their bytes are part of the one size stated before
      // anything is written.
      const files = await loadFiles(seed.id, content);
      const offer = await buildOffer(content, files);
      if (flow === flowRef.current) setOfferState({ kind: 'ready', offer, content, files });
    } catch {
      if (flow === flowRef.current) setOfferState({ kind: 'failed', result, destinations });
    }
  }

  async function handleConfirmedPlace(place: PendingPlace) {
    onPendingPlace(place);
    setPendingPlace(place);
    const flow = flowRef.current;
    setConflictState({ kind: 'checking' });
    try {
      // Several packs may be saved, one per address. A pack already saved for
      // this same address requires an explicit keep-or-replace decision before
      // the next network call; any other address goes straight on.
      const packs = await loadPacks();
      if (flow !== flowRef.current) return;
      // One name per pack. The pack for this same address is not counted: it
      // is the one a replace would take the place of.
      if (packs.some((pack) => pack.address !== place.address && samePackName(pack.name, place.name))) {
        setConflictState(null);
        setTakenName(place.name);
        return;
      }
      const same = packs.find((pack) => pack.address === place.address);
      if (same) {
        setConflictState({ kind: 'conflict', savedPack: same });
      } else {
        setConflictState(null);
        await runAreaCheck(place);
      }
    } catch {
      if (flow === flowRef.current) setConflictState({ kind: 'unavailable' });
    }
  }

  function resetToSearch() {
    flowRef.current += 1;
    setTakenName(undefined);
    setPackId('');
    setPlaceIds([]);
    setPendingPlace(null);
    setAreaState(null);
    setConflictState(null);
    setCandidate(null);
    setSupersedes(undefined);
    setOldNotes([]);
    setKeepNotes(true);
    setOfferState(null);
    setPlacesState(null);
    setChosenPlaces(null);
    setNote(undefined);
  }

  // The step on screen, read from what the builder holds.
  const at: Step = offerState ? 'size'
    : chosenPlaces ? 'note'
    : placesState ? 'places'
    : areaState ? 'area'
    : conflictState ? 'conflict'
    : candidate ? 'confirm'
    : 'search';
  const busy = conflictState?.kind === 'checking' || areaState?.kind === 'checking'
    || placesState?.kind === 'loading' || offerState?.kind === 'building' || saveStage === 'saving';

  /** One step back. Every answer given so far is kept, so going forward again
   *  shows the same address name, ticks and note. */
  function stepBack() {
    flowRef.current += 1;
    if (at === 'confirm') resetToSearch();
    else if (at === 'conflict') setConflictState(null);
    else if (at === 'area') {
      setAreaState(null);
      setConflictState(null);
      setSupersedes(undefined);
      setOldNotes([]);
      setKeepNotes(true);
    } else if (at === 'places') setPlacesState(null);
    else if (at === 'note') setChosenPlaces(null);
    else if (at === 'size') setOfferState(null);
  }

  // Back, from the bar or the phone, steps back one step at a time. The steps
  // past the address search share one history entry marked ?step=<name>. Going
  // back pops it, the builder steps back, and the entry is put back on top while
  // a step past the search remains. So nothing is left in history once the
  // builder is left, and a reload with nothing held starts at the search.
  const [params, setParams] = useSearchParams();
  const urlStep = params.get('step');
  const hadStep = useRef(false);
  useEffect(() => {
    const wasInSteps = hadStep.current;
    hadStep.current = urlStep !== null;
    if (wasInSteps && urlStep === null) {
      if (saveStage === 'saved') navigate('/', { replace: true });
      // A check or the save is running: hold the step until it is done.
      else if (busy) setParams({ step: at });
      else stepBack();
      return;
    }
    if (at === 'search') {
      if (urlStep === null) return;
      // Search again from a later step pops the entry; a reload just drops it.
      if (wasInSteps) navigate(-1);
      else setParams({}, { replace: true });
      return;
    }
    if (urlStep !== at) setParams({ step: at }, { replace: urlStep !== null });
  }, [urlStep, at]);

  // The Back bar hides while a check or the save runs, and once the pack is
  // saved, where the screen's own Back to Home is the one way out.
  useEffect(() => {
    setBuilderBack(busy || saveStage === 'saved' ? 'hidden' : 'step');
  }, [busy, saveStage]);
  useEffect(() => () => setBuilderBack('step'), []);

  // Each step replaces the page under the same path, so focus is moved to it
  // and the page starts at its top here; the route change that would
  // otherwise do both never happens.
  const step = [
    !!candidate, !!pendingPlace, conflictState?.kind, areaState?.kind,
    placesState?.kind, !!chosenPlaces, offerState?.kind,
  ].join();
  useEffect(() => {
    window.scrollTo(0, 0);
    focusMain();
  }, [step]);

  if (pendingPlace && conflictState?.kind === 'checking') {
    return (
      <StatusPage
        page="conflict-page"
        kicker={<FlowSteps at={0} />}
        card={<p>{copy.CHECKING_SAVED_PLACE}</p>}
      />
    );
  }

  if (pendingPlace && conflictState?.kind === 'conflict') {
    return (
      <Conflict
        savedAddress={conflictState.savedPack.address}
        onKeep={() => {
          keepSavedPlace();
          resetToSearch();
        }}
        onReplace={() => {
          setSupersedes(conflictState.savedPack);
          setKeepNotes(true);
          setOldNotes([]);
          loadNotes(conflictState.savedPack.id).then(setOldNotes, () => setOldNotes([]));
          setConflictState(null);
          void runAreaCheck(pendingPlace);
        }}
      />
    );
  }

  if (conflictState?.kind === 'unavailable') {
    return (
      <StatusPage
        page="conflict-page"
        kicker={<FlowSteps at={0} />}
        cardClass="conflict-content"
        card={
          <>
            <h1>{copy.SAVED_PLACE_CHECK_FAILED}</h1>
            <p>{copy.NOTHING_CHANGED}</p>
          </>
        }
        actions={
          <button type="button" onClick={resetToSearch}>
            {copy.SEARCH_AGAIN}
          </button>
        }
      />
    );
  }

  if (pendingPlace && offerState) {
    if (offerState.kind === 'building') {
      return (
        <StatusPage
          page="size-page"
          kicker={<FlowSteps at={4} />}
          card={<p>{copy.PREPARING_PACK_OFFER}</p>}
        />
      );
    }

    if (offerState.kind === 'failed') {
      return (
        <StatusPage
          page="size-page"
          kicker={<FlowSteps at={4} />}
          card={<p>{copy.PACK_OFFER_FAILED}</p>}
          actions={
            <>
              <button
                className="main-action"
                type="button"
                onClick={() =>
                  void buildPackOfferForResult(
                    pendingPlace,
                    offerState.result,
                    offerState.destinations,
                  )
                }
              >
                {copy.TRY_AGAIN}
              </button>
              <button type="button" onClick={resetToSearch}>
                {copy.SEARCH_AGAIN}
              </button>
            </>
          }
        />
      );
    }

    return (
      <Size
        offer={offerState.offer}
        address={offerState.content.pack.address}
        download={async () => {
          setSaveStage('saving');
          try {
            await savePack(offerState.content, offerState.offer, now(), offerState.files, note, keepNotes);
            setSaveStage('saved');
          } catch (error) {
            setSaveStage('idle');
            throw error;
          }
        }}
        onContinue={() => openSavedPack(offerState.content.pack.id)}
      />
    );
  }

  // The note step, after the places and before the size. The example names the
  // nearest chosen place, so the note is about this pack from the first word.
  if (pendingPlace && areaState?.kind === 'result' && chosenPlaces) {
    const nearest = chosenPlaces.find((row) => row.kind === 'nsp-bushfire');
    const replacingNotes = supersedes !== undefined && oldNotes.length > 0;
    return (
      <Note
        example={copy.NOTE_EXAMPLE(pendingPlace.name, nearest)}
        // A replace with notes already written starts empty, so going on adds
        // no second example beside them.
        initial={note ?? (replacingNotes ? '' : undefined)}
        replacing={replacingNotes ? { notes: oldNotes, keep: keepNotes, onKeep: setKeepNotes } : undefined}
        onContinue={(text) => {
          setNote(text);
          void buildPackOfferForResult(pendingPlace, areaState.result, chosenPlaces);
        }}
      />
    );
  }

  if (pendingPlace && areaState?.kind === 'result' && placesState) {
    const { result } = areaState;
    if (placesState.kind === 'loading') {
      return (
        <StatusPage
          page="places-page"
          kicker={<FlowSteps at={2} />}
          card={<p>{copy.LOADING_LAST_RESORT_PLACES}</p>}
        />
      );
    }

    if (placesState.kind === 'unavailable') {
      return (
        <StatusPage
          page="places-page"
          kicker={<FlowSteps at={2} />}
          card={<p>{copy.OFFICIAL_LIST_UNAVAILABLE}</p>}
          actions={
            <>
              <button
                className="main-action"
                type="button"
                onClick={() => void runPlaces(pendingPlace, result)}
              >
                {copy.TRY_AGAIN}
              </button>
              <button type="button" onClick={resetToSearch}>
                {copy.SEARCH_AGAIN}
              </button>
            </>
          }
        />
      );
    }

    // The pack keeps exactly the places the user chose, or the absence row
    // when the CFA publishes none for this area (see destinationsForPack).
    // Holding them moves the wizard on to the note step above.
    const { snapshot, ordered, unlocated } = placesState;
    const area = titleCase(result.lgaName);
    const continueWith = async (chosen: Destination[]) =>
      setChosenPlaces(destinationsForPack(chosen, packId, snapshot, area, PACK_HAZARD));
    return (
      <Destinations
        ordered={ordered}
        unlocated={unlocated}
        area={area}
        status={PACK_HAZARD === 'bushfire' ? 'ok' : 'not-bushfire'}
        initialChosen={placeIds}
        save={(ids) => {
          setPlaceIds(ids);
          return continueWith(chosenDestinations(ordered, ids));
        }}
        onContinue={() => void continueWith([])}
      />
    );
  }

  if (pendingPlace && areaState) {
    return (
      <AreaCheck
        place={pendingPlace}
        state={areaState}
        onRetry={() => void runAreaCheck(pendingPlace)}
        onSearchAgain={resetToSearch}
        onContinue={() => {
          if (areaState.kind === 'result') void runPlaces(pendingPlace, areaState.result);
        }}
      />
    );
  }

  if (candidate) {
    return (
      <Confirm
        candidate={candidate}
        // The default is offered in normal case, not the official list's
        // capitals, so a pack saved with it reads right everywhere.
        initialName={pendingPlace?.name ?? titleCase(defaultPackName(candidate, savedNames))}
        initialIcon={pendingPlace?.icon}
        takenName={takenName}
        onConfirm={(place) => void handleConfirmedPlace(place)}
        onSearchAgain={resetToSearch}
      />
    );
  }

  return (
    <main className="page search-page">
      <form className="search-form" onSubmit={handleSubmit}>
        <div className="search-content">
          <header className="hero">
            <FlowSteps at={0} />
            {/* Why the exact address matters, that some have no place close by,
                and where a position goes, wait behind the ring beside the title. */}
            <Hint label={copy.ABOUT_ADDRESS} head={<h1>{copy.ADDRESS_SEARCH_TITLE}</h1>}>
              <ul className="info-lines glyph-lines">
                <li><Glyph kind="place" line />{copy.ADDRESS_FIELD_HINT}</li>
                <li><Glyph kind="found" line />{copy.ADDRESS_SEARCH_DISCLOSURE}</li>
                <li><Glyph kind="lock" line />{copy.ADDRESS_LOCATE_DISCLOSURE}</li>
              </ul>
            </Hint>
          </header>
          {/* One small polite line above the field. It says what to type, then
              follows the search as the user types, and it is the only place a
              result is claimed, which the list markup alone does not announce. */}
          <p id="address-result" className="muted search-hint" role="status" aria-live="polite">
            {statusLine}
          </p>
          <div className="search-row">
            <input
              id="address-query"
              name="addressQuery"
              type="search"
              value={query}
              autoComplete="off"
              maxLength={ADDRESS_QUERY_MAX_CHARS}
              aria-label={copy.ADDRESS_FIELD_LABEL}
              aria-describedby="address-result"
              onChange={handleQueryChange}
            />
            <button
              type="button"
              className="info-ring search-locate"
              aria-label={locating ? copy.LOCATING : copy.USE_MY_LOCATION}
              onClick={locate}
              disabled={locating}
            >
              <Glyph kind="locate" line />
            </button>
          </div>

          {live.kind === 'candidates' ? (
            <Candidates
              candidates={live.candidates}
              onChoose={setCandidate}
              onNone={() => setDismissed(true)}
            />
          ) : null}
          {located ? (
            <Candidates
              candidates={located}
              onChoose={setCandidate}
              onNone={() => {
                clearLocated();
                setLocateNotice(copy.REFINE_ADDRESS_HINT);
              }}
            />
          ) : null}
        </div>

        {/* The search runs as the user types, and Enter runs it at once, so the
            only button is Try again when the search could not run: the same
            text typed again would not ask the register a second time. */}
        {live.kind === 'unavailable' ? (
          <div className="actions search-actions">
            <button className="main-action" type="button" onClick={runSearchNow}>
              {copy.TRY_AGAIN}
            </button>
          </div>
        ) : null}
      </form>
    </main>
  );
}