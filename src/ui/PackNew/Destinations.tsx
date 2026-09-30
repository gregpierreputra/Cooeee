import { useState } from 'react';

import * as copy from '../../core/copy';
import {
  canSaveDestinations,
  chooseRules,
  formatDistanceM,
  placeName,
  savableCount,
} from '../../core/destination';
import { formatIsoDateShort, nspListDateLabel } from '../../core/nsp';
import type { Destination } from '../../core/types';
import ProvenanceLine from '../components/ProvenanceLine';
import Glyph from '../components/Glyph';
import KeyTerms from '../components/KeyTerms';
import StateCard from '../components/StateCard';
import FlowSteps from './FlowSteps';

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
  /** The places ticked before, when the person comes back to this step. */
  initialChosen?: string[];
  /** The way on when there is nothing to choose: no place published, or only
   *  places the CFA could not put on the map. */
  onContinue?: () => void;
  now?: number;
};

/** `full` greys a row that is not chosen once the limit is reached. It is
 *  marked unavailable, and the hint over the list says why. */
type RowSelection = { chosen: boolean; full: boolean; onToggle: () => void };

/** What every official place states about itself, in the wizard list and in the
 *  saved pack alike: its address, then council and the CFA's dates on one quiet
 *  line, then provenance. The kind is the heading of the list it sits in. */
export function PlaceFacts({ place, now }: { place: Destination; now: number }) {
  const meta = [
    place.council ? copy.NSP_COUNCIL_LABEL(place.council) : null,
    place.designatedAt ? copy.NSP_DESIGNATED_ON(formatIsoDateShort(place.designatedAt)) : null,
    place.listAsAt ? nspListDateLabel(place.listAsAt) : null,
  ].filter(Boolean);
  return (
    <>
      {place.addressText ? <p className="muted">{place.addressText}</p> : null}
      {meta.length > 0 ? <p className="muted figure place-meta">{meta.join(' · ')}</p> : null}
      <ProvenanceLine source={place.source} now={now} />
    </>
  );
}

/** The official list the places come from, and its age, said once. */
function PlaceSource({ place, now }: { place: Destination; now: number }) {
  return (
    <div className="destination-source">
      <ProvenanceLine source={place.source} now={now} extra={place.listAsAt ? [{ label: copy.SOURCE_LIST_DATE, value: formatIsoDateShort(place.listAsAt) }] : []} />
    </div>
  );
}

function DestinationRow({ place, selection }: { place: Destination; selection?: RowSelection }) {
  const distance =
    typeof place.distanceM === 'number' ? formatDistanceM(place.distanceM) : undefined;
  const name = placeName(place);
  const inputId = `choose-${place.id}`;

  // UAT: the council, list date and publisher were the same on every card, so
  // a card shows only what tells the places apart. The list's source is said
  // once, under the list.
  const where = [place.addressText, place.council ? copy.NSP_COUNCIL_LABEL(place.council) : null]
    .filter(Boolean)
    .join(' · ');
  const greyed = selection?.full && !selection.chosen;

  return (
    <li className={greyed ? 'card destination-item destination-item-greyed' : 'card destination-item'}>
      <div className="destination-item-head">
        {selection ? (
          <input
            type="checkbox"
            id={inputId}
            checked={selection.chosen}
            aria-disabled={greyed || undefined}
            onChange={selection.onToggle}
          />
        ) : null}
        <h2>{selection ? <label htmlFor={inputId}>{name}</label> : name}</h2>
      </div>
      {distance ? (
        <p className="figure with-glyph place-distance">
          <Glyph kind="go" line />
          {distance}
        </p>
      ) : null}
      {where ? <p className="muted place-meta">{where}</p> : null}
    </li>
  );
}

/** A ring that fills as places are chosen, with the count inside it. */
function ChosenRing({ chosen, total }: { chosen: number; total: number }) {
  const r = 20;
  const length = 2 * Math.PI * r;
  return (
    <svg className="chosen-ring" viewBox="0 0 48 48" role="img" aria-label={copy.PLACES_CHOSEN_COUNT(chosen, total)}>
      <circle className="chosen-ring-track" cx="24" cy="24" r={r} />
      <circle
        className="chosen-ring-fill"
        cx="24"
        cy="24"
        r={r}
        strokeDasharray={length}
        strokeDashoffset={length * (1 - chosen / total)}
      />
      <text x="24" y="24" dominantBaseline="central" textAnchor="middle" aria-hidden="true">
        {chosen}/{total}
      </text>
    </svg>
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
  initialChosen,
  onContinue,
  now = Date.now(),
}: DestinationsProps) {
  const [chosen, setChosen] = useState<string[]>(initialChosen ?? []);
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
        <FlowSteps at={2} />
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
  const limit = savableCount(ordered.length);

  const toggle = (id: string) => {
    // A greyed row refuses the tick; the hint over the list already says why.
    const next = chooseRules(chosen, id);
    if (next) setChosen(next);
  };
  // At two, the hint over the list says how to change, for as long as it is true.
  const atTwo = limit === 2 && chosen.length >= limit;

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
      <FlowSteps at={2} />
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
              <div className="choose-head">
                {selectable ? <ChosenRing chosen={chosen.length} total={limit} /> : null}
                <div>
                  <p className="caveat" role="status" aria-live="polite">
                    <strong className="choose-hint">
                      {atTwo ? copy.TWO_PLACES_ALREADY_CHOSEN : copy.CHOOSE_PLACES_HINT(limit)}
                    </strong>{' '}
                    · {copy.SORTED_SHORT}
                  </p>
                  <p className="muted"><KeyTerms text={copy.DISTANCES_NOTE} /></p>
                </div>
              </div>
              <ul className="list destination-list" data-testid="ordered-destinations">
                {ordered.map((place) => (
                  <DestinationRow
                    key={place.id}
                    place={place}
                    selection={
                      selectable
                        ? {
                            chosen: chosen.includes(place.id),
                            full: chosen.length >= limit,
                            onToggle: () => toggle(place.id),
                          }
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
                  <DestinationRow key={place.id} place={place} />
                ))}
              </ul>
            </section>
          ) : null}

          {/* Said once: every place above comes from the same official list. */}
          <PlaceSource place={ordered[0] ?? unlocated[0]} now={now} />

          {selectable ? null : continueAction}

          {selectable ? (
            <>
              <div role="status" aria-live="polite">
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
