import * as copy from '../../core/copy';
import type { AddressCandidate } from '../../core/types';

type CandidatesProps = {
  candidates: readonly AddressCandidate[];
  unresolvedCount: number;
  onChoose: (candidate: AddressCandidate) => void;
  onNone: () => void;
};

/** E1-US1-AC2 candidate choice. The DOM order is the service order and every
 * item uses identical markup and styling, including a single-item result. An
 * address the register describes at more than one point is stated as such and
 * offered no button: an identical-looking line would ask the user to choose a
 * coordinate they cannot see.
 *
 * The search runs while the user types, so this is a section BELOW the address
 * field rather than a page that replaces it: the field the list answers to has
 * to stay editable while the list is on screen. The count of what is listed is
 * announced by the field's own status region in Search.tsx, so that a list
 * appearing or changing under a screen reader is spoken once, in one place. */
export function Candidates({ candidates, unresolvedCount, onChoose, onNone }: CandidatesProps) {
  const hasCandidates = candidates.length > 0;
  const unresolvedHeading = unresolvedCount === 1
    ? copy.ADDRESS_NOT_RESOLVED
    : copy.ADDRESSES_NOT_RESOLVED(unresolvedCount);

  return (
    <section className="candidate-section" aria-labelledby="candidate-heading">
      <h2 id="candidate-heading">{hasCandidates ? copy.CHOOSE_ADDRESS : unresolvedHeading}</h2>

      {unresolvedCount > 0 ? (
        // The same neutral card as every other state. Absence of an answer is
        // not an error and is not reassurance.
        <div className="card">
          {hasCandidates ? <h3>{unresolvedHeading}</h3> : null}
          <p className="muted">{copy.ADDRESS_NOT_RESOLVED_REASON}</p>
          <p className="muted">{copy.REFINE_ADDRESS_HINT}</p>
        </div>
      ) : null}

      {hasCandidates ? (
        <ul className="candidate-list" aria-label={copy.CANDIDATE_LIST_LABEL}>
          {candidates.map((candidate) => (
            // The resolution makes the address unique, so a repeated key would
            // be a broken invariant rather than expected data.
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
      ) : null}

      <div className="candidate-dismiss">
        <button type="button" onClick={onNone}>
          {hasCandidates ? copy.NONE_OF_THESE : copy.SEARCH_AGAIN}
        </button>
      </div>
    </section>
  );
}