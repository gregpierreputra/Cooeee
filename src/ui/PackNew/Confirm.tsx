import { useState, type FormEvent } from 'react';

import * as copy from '../../core/copy';
import type { AddressCandidate, PendingPlace } from '../../core/types';

type ConfirmProps = {
  candidate: AddressCandidate;
  onConfirm: (pendingPlace: PendingPlace) => void;
  onSearchAgain: () => void;
};

/** E1-US1-AC1 confirmation step. The parent owns the pending in-memory value;
 * this component performs no persistence, networking or navigation. */
export function Confirm({ candidate, onConfirm, onSearchAgain }: ConfirmProps) {
  const [name, setName] = useState(candidate.localityName);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    
    // The in-memory selection, with no normalising of user or source text: the
    // edited name is kept exactly as typed, the address exactly as returned.
    onConfirm({ name, address: candidate.address, lat: candidate.lat, lon: candidate.lon });
  }

  return (
    <main className="page confirm-page">
      <form className="confirm-form" onSubmit={handleSubmit}>
        <div className="confirm-content">
          <header className="hero">
            <span className="kicker">{copy.EYEBROW_CONFIRM_ADDRESS}</span>
            <h1>{copy.CONFIRM_ADDRESS_QUESTION}</h1>
          </header>
          <p className="returned-address" data-testid="returned-address">
            {candidate.address}
          </p>
          <label htmlFor="place-name">{copy.PLACE_NAME_LABEL}</label>
          <input
            id="place-name"
            name="placeName"
            type="text"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
        </div>
        <div className="actions confirm-actions">
          <button className="main-action" type="submit">
            {copy.SAVE_THIS_PLACE}
          </button>
          <button type="button" onClick={onSearchAgain}>
            {copy.SEARCH_AGAIN}
          </button>
        </div>
      </form>
    </main>
  );
}
