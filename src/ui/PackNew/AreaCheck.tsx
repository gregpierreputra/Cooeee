import { areaCheckView } from '../../core/area-check';
import { DTP_PUBLISHER } from '../../core/constants';
import * as copy from '../../core/copy';
import type { BushfireAreaResult, PendingPlace } from '../../core/types';
import Glyph from '../components/Glyph';
import KeyTerms from '../components/KeyTerms';
import { SourceText } from '../components/ProvenanceLine';
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
  const inside = state.result.status === 'present';
  return (
    <StatusPage
      page="area-page"
      kicker={<FlowSteps at={1} />}
      cardClass="area-result"
      card={
        <>
          {/* Laid out as the pack page's Bushfire area: the map's drawing and
              the section's name, then the answer at full width. A planning
              area is not a fire, so no flame. As on the pack page, only the
              words that say inside are amber, and outside, that fire can
              still reach the person. */}
          <div className="pack-section-head">
            <Glyph kind="map" />
            <span className="kicker">{copy.BUSHFIRE_AREA}</span>
          </div>
          <h1>{inside ? <KeyTerms text={view.resultLine} /> : view.resultLine}</h1>
          {view.cautionLine && (
            <p className="muted">
              <KeyTerms text={view.cautionLine} />
            </p>
          )}
          {/* The pack's own reminder, the card's footer: no phone, as there is
              nothing here to call. */}
          <p className="area-priority">{view.priorityLine}</p>
          <SourceText
            rows={[
              { label: copy.SOURCE_PUBLISHED_BY, value: DTP_PUBLISHER },
              { label: copy.SOURCE_SAVED, value: view.savedOn },
            ]}
          />
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