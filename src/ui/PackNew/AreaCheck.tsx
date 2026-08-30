import { areaCheckView } from '../../core/area-check';
import * as copy from '../../core/copy';
import type { BushfireAreaResult, PendingPlace } from '../../core/types';

export type AreaCheckState =
  | { kind: 'checking' }
  | { kind: 'result'; result: BushfireAreaResult }
  | { kind: 'unavailable' };

export type AreaCheckProps = {
  place: PendingPlace;
  state: AreaCheckState;
  onRetry: () => void;
  onSearchAgain: () => void;
  onContinue: () => void;
};

/** E1-US1-AC5–AC7. The pending place stays in parent memory only; this screen
 * has no storage access and retry is always an explicit user gesture. */
export function AreaCheck({ place, state, onRetry, onSearchAgain, onContinue }: AreaCheckProps) {
  if (state.kind === 'checking') {
    return (
      <main className="page area-page">
        <div role="status" aria-live="polite">
          <p>{copy.AREA_CHECK_IN_PROGRESS}</p>
        </div>
      </main>
    );
  }

  if (state.kind === 'unavailable') {
    return (
      <main className="page area-page">
        <div className="area-content" role="status" aria-live="polite">
          <h1>{copy.AREA_CHECK_COULD_NOT_RUN}</h1>
          <p>{copy.AREA_NOT_SAVED}</p>
          <p className="returned-address" data-testid="pending-address">{place.address}</p>
        </div>
        <div className="actions">
          <button className="main-action" type="button" onClick={onRetry}>
            {copy.TRY_AGAIN}
          </button>
          <button type="button" onClick={onSearchAgain}>
            {copy.SEARCH_AGAIN}
          </button>
        </div>
      </main>
    );
  }

  const view = areaCheckView(state.result);
  return (
    <main className="page area-page">
      <div className="card area-result" role="status" aria-live="polite">
        <h1>{view.resultLine}</h1>
        <p>{view.publisherLine}</p>
        <p>{view.priorityLine}</p>
      </div>
      <div className="actions">
        <button className="main-action" type="button" onClick={onContinue}>
          {copy.SEE_PACK_SIZE}
        </button>
      </div>
    </main>
  );
}
