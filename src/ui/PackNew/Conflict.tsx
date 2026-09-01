import * as copy from '../../core/copy';
import BackHomeLink from '../components/BackHomeLink';

export type ConflictProps = {
  savedAddress: string;
  newAddress: string;
  onKeep: () => void;
  onReplace: () => void;
};

/** E1-US1-AC8 compare-and-choose state. Both options intentionally use the
 * same control style and neither is selected or presented as the expected one. */
export function Conflict({ savedAddress, newAddress, onKeep, onReplace }: ConflictProps) {
  return (
    <main className="page conflict-page">
      <div className="conflict-content">
        <header className="hero">
          <span className="kicker">{copy.EYEBROW_SET_UP_YOUR_PLACE}</span>
          <h1>{copy.PLACE_ALREADY_SAVED}</h1>
        </header>
        <section className="card" aria-labelledby="saved-address-label">
          <h2 id="saved-address-label">{copy.SAVED_ADDRESS_LABEL}</h2>
          <p data-testid="saved-address">{savedAddress}</p>
        </section>
        <section className="card" aria-labelledby="new-address-label">
          <h2 id="new-address-label">{copy.NEW_ADDRESS_LABEL}</h2>
          <p data-testid="new-address">{newAddress}</p>
        </section>
      </div>
      <div className="actions conflict-actions">
        <button type="button" onClick={onKeep}>{copy.KEEP_SAVED_PLACE}</button>
        <button type="button" onClick={onReplace}>{copy.REPLACE_WITH_THIS_ONE}</button>
        <BackHomeLink />
      </div>
    </main>
  );
}

export function ConflictBlocked({ multiple, onSearchAgain }: {
  multiple: boolean;
  onSearchAgain: () => void;
}) {
  return (
    <main className="page conflict-page">
      <span className="kicker">{copy.EYEBROW_SET_UP_YOUR_PLACE}</span>
      <div className="card conflict-content" role="status" aria-live="polite">
        <h1>{multiple ? copy.MULTIPLE_SAVED_PACKS : copy.SAVED_PLACE_CHECK_FAILED}</h1>
        <p>{copy.NOTHING_CHANGED}</p>
      </div>
      <div className="actions">
        <button type="button" onClick={onSearchAgain}>{copy.SEARCH_AGAIN}</button>
        <BackHomeLink />
      </div>
    </main>
  );
}
