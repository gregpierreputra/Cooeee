import { areaCheckView } from '../../core/area-check';
import { DTP_PUBLISHER } from '../../core/constants';
import * as copy from '../../core/copy';
import type { BushfireAreaResult, PendingPlace } from '../../core/types';
import Glyph from '../components/Glyph';
import { SourceRing } from '../components/ProvenanceLine';
import KeyTerms from '../components/KeyTerms';
import StatusPage from '../components/StatusPage';
import FlowSteps from './FlowSteps';

export type AreaCheckState =
  | { kind: 'checking' }
  | { kind: 'result'; result: BushfireAreaResult }
  | { kind: 'unavailable' };

type AreaCheckProps = {
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
      <StatusPage
        page="area-page"
        kicker={<FlowSteps at={1} />}
        card={<p>{copy.AREA_CHECK_IN_PROGRESS}</p>}
      />
    );
  }

  if (state.kind === 'unavailable') {
    return (
      <StatusPage
        page="area-page"
        kicker={<FlowSteps at={1} />}
        cardClass="area-content"
        card={
          <>
            <h1>{copy.AREA_CHECK_COULD_NOT_RUN}</h1>
            <p>{copy.AREA_NOT_SAVED}</p>
            <p className="returned-address" data-testid="pending-address">{place.address}</p>
          </>
        }
        actions={
          <>
            <button className="main-action" type="button" onClick={onRetry}>
              {copy.TRY_AGAIN}
            </button>
            <button type="button" onClick={onSearchAgain}>
              {copy.SEARCH_AGAIN}
            </button>
          </>
        }
      />
    );
  }

  const view = areaCheckView(state.result);
  return (
    <StatusPage
      page="area-page"
      kicker={<FlowSteps at={1} />}
      cardClass="area-result"
      card={
        <>
          {/* The flame in amber marks a designated area; every other answer
              shares the neutral layer drawing, so an absence never reads as
              reassurance. The words carry the meaning either way. */}
          <div className="card-head">
            {state.result.status === 'present' ? (
              <span className="tone-amber"><Glyph kind="drill" /></span>
            ) : (
              <Glyph kind="layer" />
            )}
            <h1><KeyTerms text={view.resultLine} /></h1>
          </div>
          {view.cautionLine && <p className="caution"><KeyTerms text={view.cautionLine} /></p>}
          <SourceRing
            rows={[
              { label: copy.SOURCE_PUBLISHED_BY, value: DTP_PUBLISHER },
              { label: copy.SOURCE_SAVED, value: view.savedOn },
            ]}
          />
          <p className="with-glyph">
            <Glyph kind="calls" line />
            {view.priorityLine}
          </p>
        </>
      }
      actions={
        <button className="main-action" type="button" onClick={onContinue}>
          {copy.CONTINUE}
        </button>
      }
    />
  );
}