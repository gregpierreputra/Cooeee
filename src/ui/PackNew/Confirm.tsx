import { useState, type FormEvent } from 'react';

import { PACK_NAME_MAX_CHARS } from '../../core/constants';
import * as copy from '../../core/copy';
import { samePackName } from '../../core/pack';
import Glyph from '../components/Glyph';
import FlowSteps from './FlowSteps';
import type { AddressCandidate, PendingPlace } from '../../core/types';

type ConfirmProps = {
  candidate: AddressCandidate;
  /** The name to start with: the one given before when the person comes back
   *  to this step, or the builder's default otherwise. */
  initialName?: string;
  /** A name another saved pack already has, sent back by the parent. */
  takenName?: string;
  onConfirm: (pendingPlace: PendingPlace) => void;
  onSearchAgain: () => void;
};

/** E1-US1-AC1 confirmation step. The parent owns the pending in-memory value;
 * this component performs no persistence, networking or navigation. */
export function Confirm({ candidate, initialName, takenName, onConfirm, onSearchAgain }: ConfirmProps) {
  const [name, setName] = useState(initialName ?? candidate.localityName);
  // The message stays while the name still matches the taken one, and goes as
  // soon as the person types a different name.
  const taken = takenName !== undefined && samePackName(name, takenName);

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
            <FlowSteps at={0} />
            <h1>{copy.CONFIRM_ADDRESS_QUESTION}</h1>
          </header>
          <p className="returned-address with-glyph" data-testid="returned-address">
            <Glyph kind="place" line />
            {candidate.address}
          </p>
          <label htmlFor="place-name">{copy.PLACE_NAME_LABEL}</label>
          <input
            id="place-name"
            name="placeName"
            type="text"
            value={name}
            maxLength={PACK_NAME_MAX_CHARS}
            aria-invalid={taken || undefined}
            aria-describedby={taken ? 'place-name-taken' : undefined}
            onChange={(event) => setName(event.currentTarget.value)}
          />
          {taken ? (
            <p id="place-name-taken" className="field-message with-glyph" role="alert">
              <Glyph kind="caution" line />
              {copy.PACK_NAME_TAKEN}
            </p>
          ) : null}
        </div>
        <div className="actions confirm-actions">
          <button className="main-action" type="submit" disabled={name.trim() === ''}>
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
