import * as copy from '../../core/copy';
import { formatDistanceM, ordinalLabel } from '../../core/destination';
import { nspListDateLabel } from '../../core/nsp';
import type { Destination } from '../../core/types';
import ProvenanceLine from '../components/ProvenanceLine';
import StateCard from '../components/StateCard';

export type DestinationsProps = {
  /** NSP rows within the pack radius, ordered strictly ascending by distance
   *  (each carries `distanceM` and a zero-based `distanceOrder`). */
  ordered: Destination[];
  /** NSP rows the CFA lists for this council but could not place on the map. */
  unlocated: Destination[];
  /** The snapshot's own `listAsAt` (ISO date). Shown as the list's date. */
  listAsAt: string;
  /** The area the list applies to, for the honest-absence line. */
  area: string;
  /** 'unavailable' when the cached list could not be read at all. */
  status?: 'ok' | 'unavailable';
  now?: number;
};

function DestinationRow({
  place,
  listLine,
  now,
}: {
  place: Destination;
  listLine: string;
  now: number;
}) {
  const ordinal =
    typeof place.distanceOrder === 'number' ? ordinalLabel(place.distanceOrder) : undefined;
  const distance =
    typeof place.distanceM === 'number' ? formatDistanceM(place.distanceM) : undefined;

  return (
    <li className="card destination-item">
      <h2>{place.name ?? copy.OFFICIAL_DESTINATION_INFORMATION}</h2>
      {ordinal ? <p>{ordinal}</p> : null}
      {distance ? <p className="figure">{distance}</p> : null}
      <p>{copy.NSP_KIND_LABEL}</p>
      {place.addressText ? <p className="muted">{place.addressText}</p> : null}
      {place.council ? <p>{copy.NSP_COUNCIL_LABEL(place.council)}</p> : null}
      <p className="figure">{listLine}</p>
      <ProvenanceLine source={place.source} now={now} />
    </li>
  );
}

/** E2-US1-AC1 + AC2. Lists only officially published Neighbourhood Safer Places
 *  for the pack's area — from the NSP snapshot alone, with no join to the
 *  basemap — ordered by straight-line distance from the saved place, the first
 *  three labelled by position, under the mandated caveat line. The order carries
 *  no judgement beyond distance. Selection is E2-US2-AC1. */
export function Destinations({
  ordered,
  unlocated,
  listAsAt,
  area,
  status = 'ok',
  now = Date.now(),
}: DestinationsProps) {
  if (status === 'unavailable') {
    return (
      <main className="page destinations-page">
        <h1>{copy.DESTINATIONS_STEP_TITLE}</h1>
        <StateCard heading={copy.OFFICIAL_LIST_UNAVAILABLE} />
      </main>
    );
  }

  const listLine = nspListDateLabel(listAsAt);
  const nonePublished = ordered.length === 0 && unlocated.length === 0;

  return (
    <main className="page destinations-page">
      <h1>{copy.DESTINATIONS_STEP_TITLE}</h1>

      {nonePublished ? (
        <StateCard heading={copy.NO_DESTINATION_PUBLISHED_FOR(area)} />
      ) : (
        <>
          {ordered.length > 0 ? (
            <>
              <p className="caveat">{copy.SORTED_BY_DISTANCE}</p>
              <ul className="list destination-list" data-testid="ordered-destinations">
                {ordered.map((place) => (
                  <DestinationRow key={place.id} place={place} listLine={listLine} now={now} />
                ))}
              </ul>
            </>
          ) : null}

          {unlocated.length > 0 ? (
            <section className="destination-unlocated">
              <h2>{copy.NSP_UNLOCATED_HEADING}</h2>
              <ul className="list destination-list" data-testid="unlocated-destinations">
                {unlocated.map((place) => (
                  <DestinationRow key={place.id} place={place} listLine={listLine} now={now} />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
