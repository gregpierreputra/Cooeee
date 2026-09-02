import { useState } from 'react';

import * as copy from '../../core/copy';
import {
  canSaveDestinations,
  chooseRules,
  formatDistanceM,
  ordinalLabel,
  savableCount,
} from '../../core/destination';
import { formatIsoDateShort, nspListDateLabel } from '../../core/nsp';
import type { Destination } from '../../core/types';
import ProvenanceLine from '../components/ProvenanceLine';
import StateCard from '../components/StateCard';

type DestinationsProps = {
  /** The nearest NSP rows to the saved place, ordered strictly ascending by distance
   *  (each carries `distanceM` and a zero-based `distanceOrder`). */
  ordered: Destination[];
  /** NSP rows the CFA lists for this council but could not place on the map. */
  unlocated: Destination[];
  /** The area the list applies to, for the honest-absence line. */
  area: string;
  /** 'unavailable' when the cached list could not be read at all;
   *  'not-bushfire' when the pack is for flood or heat (NSPs do not apply). */
  status?: 'ok' | 'unavailable' | 'not-bushfire';
  /** When provided, the ordered rows become selectable and the two the user
   *  picks are persisted by this callback. Absent = a read-only list. */
  save?: (chosenIds: string[]) => Promise<void>;
  /** The way on when there is nothing to choose: no place published, or only
   *  places the CFA could not put on the map. */
  onContinue?: () => void;
  now?: number;
};

type RowSelection = { chosen: boolean; onToggle: () => void };

/** What every official place states about itself, in the wizard list and in the
 *  saved pack alike: its kind, address, council, the CFA's dates, and provenance. */
export function PlaceFacts({ place, now }: { place: Destination; now: number }) {
  return (
    <>
      <p>{copy.NSP_KIND_LABEL}</p>
      {place.addressText ? <p className="muted">{place.addressText}</p> : null}
      {place.council ? <p>{copy.NSP_COUNCIL_LABEL(place.council)}</p> : null}
      {place.designatedAt ? (
        <p className="figure">{copy.NSP_DESIGNATED_ON(formatIsoDateShort(place.designatedAt))}</p>
      ) : null}
      {place.listAsAt ? <p className="figure">{nspListDateLabel(place.listAsAt)}</p> : null}
      <ProvenanceLine source={place.source} now={now} />
    </>
  );
}

function DestinationRow({
  place,
  now,
  selection,
}: {
  place: Destination;
  now: number;
  selection?: RowSelection;
}) {
  const ordinal =
    typeof place.distanceOrder === 'number' ? ordinalLabel(place.distanceOrder) : undefined;
  const distance =
    typeof place.distanceM === 'number' ? formatDistanceM(place.distanceM) : undefined;
  const name = place.name ?? copy.OFFICIAL_DESTINATION_INFORMATION;
  const inputId = `choose-${place.id}`;

  return (
    <li className="card destination-item">
      <div className="destination-item-head">
        {selection ? (
          <input
            type="checkbox"
            id={inputId}
            checked={selection.chosen}
            onChange={selection.onToggle}
          />
        ) : null}
        <h2>{selection ? <label htmlFor={inputId}>{name}</label> : name}</h2>
      </div>
      {ordinal ? <p>{ordinal}</p> : null}
      {distance ? <p className="figure">{distance}</p> : null}
      <PlaceFacts place={place} now={now} />
    </li>
  );
}

/** E2-US1-AC1/AC2 + E2-US2-AC1. Lists only officially published Neighbourhood
 *  Safer Places for the pack's area — from the NSP snapshot alone — ordered by
 *  straight-line distance, the first three labelled by position, under the
 *  mandated caveat line. When `save` is supplied, the user chooses up to two
 *  (equal status, nothing pre-selected) and saves them. */
export function Destinations({
  ordered,
  unlocated,
  area,
  status = 'ok',
  save,
  onContinue,
  now = Date.now(),
}: DestinationsProps) {
  const [chosen, setChosen] = useState<string[]>([]);
  const [capReached, setCapReached] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');

  // The way on when there is nothing to choose, shared by every such state.
  const continueAction = onContinue ? (
    <div className="actions">
      <button className="main-action" type="button" onClick={onContinue}>
        {copy.CONTINUE}
      </button>
    </div>
  ) : null;

  // One plain statement and nothing to choose.
  const statement =
    status === 'unavailable'
      ? copy.OFFICIAL_LIST_UNAVAILABLE
      : status === 'not-bushfire'
        ? copy.NSP_BUSHFIRE_ONLY
        : saveState === 'saved'
          ? copy.LAST_RESORT_PLACES_SAVED
          : null;
  if (statement) {
    return (
      <main className="page destinations-page">
        <h1>{copy.DESTINATIONS_STEP_TITLE}</h1>
        <StateCard heading={statement} />
        {continueAction}
      </main>
    );
  }

  if (saveState === 'saving') {
    return (
      <main className="page destinations-page">
        <div role="status" aria-live="polite">
          <p>{copy.SAVING_LAST_RESORT_PLACES}</p>
        </div>
      </main>
    );
  }

  const nonePublished = ordered.length === 0 && unlocated.length === 0;
  const selectable = Boolean(save) && ordered.length > 0;

  const toggle = (id: string) => {
    const next = chooseRules(chosen, id);
    if (next) {
      setChosen(next);
      setCapReached(false);
    } else {
      setCapReached(true);
    }
  };

  async function runSave() {
    if (!save) return;
    setSaveState('saving');
    try {
      await save(chosen);
      setSaveState('saved');
    } catch {
      setSaveState('failed');
    }
  }

  return (
    <main className="page destinations-page">
      <h1>{copy.DESTINATIONS_STEP_TITLE}</h1>

      {nonePublished ? (
        <>
          <StateCard heading={copy.NO_DESTINATION_PUBLISHED_FOR(area)} />
          {continueAction}
        </>
      ) : (
        <>
          {ordered.length > 0 ? (
            <>
              <p className="caveat">{copy.SORTED_BY_DISTANCE}</p>
              <ul className="list destination-list" data-testid="ordered-destinations">
                {ordered.map((place) => (
                  <DestinationRow
                    key={place.id}
                    place={place}
                    now={now}
                    selection={
                      selectable
                        ? { chosen: chosen.includes(place.id), onToggle: () => toggle(place.id) }
                        : undefined
                    }
                  />
                ))}
              </ul>
            </>
          ) : null}

          {unlocated.length > 0 ? (
            <section className="destination-unlocated">
              <h2>{copy.NSP_UNLOCATED_HEADING}</h2>
              <ul className="list destination-list" data-testid="unlocated-destinations">
                {unlocated.map((place) => (
                  <DestinationRow key={place.id} place={place} now={now} />
                ))}
              </ul>
            </section>
          ) : null}

          {selectable ? null : continueAction}

          {selectable ? (
            <>
              <p className="destination-choose-hint">
                {copy.CHOOSE_PLACES_HINT(savableCount(ordered.length))}
              </p>
              <div role="status" aria-live="polite">
                {capReached ? <p>{copy.TWO_PLACES_ALREADY_CHOSEN}</p> : null}
                {saveState === 'failed' ? <p>{copy.LAST_RESORT_SAVE_FAILED}</p> : null}
              </div>
              <div className="actions">
                <button
                  type="button"
                  className="main-action"
                  disabled={!canSaveDestinations(ordered.length, chosen.length)}
                  onClick={() => void runSave()}
                >
                  {copy.SAVE_LAST_RESORT_PLACES}
                </button>
              </div>
            </>
          ) : null}
        </>
      )}
    </main>
  );
}
