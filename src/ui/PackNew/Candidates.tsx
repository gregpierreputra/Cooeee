import * as copy from "../../core/copy";
import type { AddressCandidate } from "../../core/types";

type CandidatesProps = {
  candidates: readonly AddressCandidate[];
  onChoose: (candidate: AddressCandidate) => void;
  onNone: () => void;
};

/** E1-US1-AC2 candidate choice. The DOM order is the service order and every
 * item uses identical markup and styling, including a single-item result.
 *
 * The search runs while the user types, so this is a section BELOW the address
 * field rather than a page that replaces it: the field the list answers to has
 * to stay editable while the list is on screen. The count of what is listed is
 * announced by the field's own status region in Search.tsx, so that a list
 * appearing or changing under a screen reader is spoken once, in one place. */
export function Candidates({ candidates, onChoose, onNone }: CandidatesProps) {
  return (
    <section className="candidate-section" aria-labelledby="candidate-heading">
      <h2 id="candidate-heading">{copy.CHOOSE_ADDRESS}</h2>

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

      <div className="candidate-dismiss">
        <button type="button" onClick={onNone}>
          {copy.NONE_OF_THESE}
        </button>
      </div>
    </section>
  );
}
