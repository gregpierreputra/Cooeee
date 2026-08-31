import * as copy from '../../core/copy';
import { nspListDateLabel } from '../../core/nsp';
import type { Destination } from '../../core/types';
import ProvenanceLine from '../components/ProvenanceLine';
import StateCard from '../components/StateCard';

export type DestinationsProps = {
  /** NSP rows within the pack radius, already mapped from the snapshot. */
  located: Destination[];
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
  return (
    <li className="card destination-item">
      <h2>{place.name ?? copy.OFFICIAL_DESTINATION_INFORMATION}</h2>
      <p>{copy.NSP_KIND_LABEL}</p>
      {place.addressText ? <p className="muted">{place.addressText}</p> : null}
      {place.council ? <p>{copy.NSP_COUNCIL_LABEL(place.council)}</p> : null}
      <p className="figure">{listLine}</p>
      <ProvenanceLine source={place.source} now={now} />
    </li>
  );
}

/** E2-US1-AC1. Lists only officially published Neighbourhood Safer Places for
 *  the pack's area, each with its responsible council and the list's recorded
 *  date. There is no path for any non-official place to appear: the data comes
 *  from the NSP snapshot alone, with no join to the basemap. Distance, ordinals
 *  and selection arrive in AC2 and E2-US2-AC1. */
export function Destinations({
  located,
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
  const nonePublished = located.length === 0 && unlocated.length === 0;

  return (
    <main className="page destinations-page">
      <h1>{copy.DESTINATIONS_STEP_TITLE}</h1>

      {nonePublished ? (
        <StateCard heading={copy.NO_DESTINATION_PUBLISHED_FOR(area)} />
      ) : (
        <>
          {located.length > 0 ? (
            <ul className="list destination-list">
              {located.map((place) => (
                <DestinationRow key={place.id} place={place} listLine={listLine} now={now} />
              ))}
            </ul>
          ) : null}

          {unlocated.length > 0 ? (
            <section className="destination-unlocated">
              <h2>{copy.NSP_UNLOCATED_HEADING}</h2>
              <ul className="list destination-list">
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
