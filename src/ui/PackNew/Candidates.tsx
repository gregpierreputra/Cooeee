import * as copy from '../../core/copy';
import type { AddressCandidate } from '../../core/types';

export type CandidatesProps = {
  candidates: readonly AddressCandidate[];
  onChoose: (candidate: AddressCandidate) => void;
  onNone: () => void;
};

/** E1-US1-AC2 candidate choice. The DOM order is the service order and every
 * item uses identical markup and styling, including a single-item result. */
export function Candidates({ candidates, onChoose, onNone }: CandidatesProps) {
  return (
    <main className="page candidate-page">
      <h1>{copy.CHOOSE_ADDRESS}</h1>
      <ul className="candidate-list" aria-label={copy.CANDIDATE_LIST_LABEL}>
        {candidates.map((candidate) => (
          <li key={`${candidate.address}:${candidate.lon}:${candidate.lat}`}>
            <button
              className="candidate-action"
              type="button"
              onClick={() => onChoose(candidate)}
            >
              {candidate.address}
            </button>
          </li>
        ))}
      </ul>
      <div className="actions">
        <button type="button" onClick={onNone}>
          {copy.NONE_OF_THESE}
        </button>
      </div>
    </main>
  );
}
