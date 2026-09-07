import * as copy from '../../core/copy';
import BackHomeLink from '../components/BackHomeLink';

type ConflictProps = {
  savedAddress: string;
  onKeep: () => void;
  onReplace: () => void;
};

/** E1-US1-AC8 keep-or-replace state, reached only when the confirmed address
 * already has a saved pack. Both options intentionally use the same control
 * style and neither is selected or presented as the expected one. */
export function Conflict({ savedAddress, onKeep, onReplace }: ConflictProps) {
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
      </div>
      <div className="actions conflict-actions">
        <button type="button" onClick={onKeep}>{copy.KEEP_SAVED_PACK}</button>
        <button type="button" onClick={onReplace}>{copy.REPLACE_SAVED_PACK}</button>
        <BackHomeLink />
      </div>
    </main>
  );
}
