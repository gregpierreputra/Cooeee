import { useId } from "react";
import * as copy from "../../core/copy";
import { titleCase } from "../../core/home";
import type { AddressCandidate } from "../../core/types";

type CandidatesProps = {
  candidates: readonly AddressCandidate[];
  onChoose: (candidate: AddressCandidate) => void;
  onNone: () => void;
};

/** E1-US1-AC2 candidate choice. The DOM order is the service order and every
 * item uses identical markup and styling, including a single-item result.
 *
 * The search runs while the user types, so this is a list BELOW the address
 * field rather than a page that replaces it: the field the list answers to has
 * to stay editable while the list is on screen. The count of what is listed is
 * announced by the field's own status region in Search.tsx, so that a list
 * appearing or changing under a screen reader is spoken once, in one place. */
export function Candidates({ candidates, onChoose, onNone }: CandidatesProps) {
  const headingId = useId();
  return (
    <div className="candidate-section">
      {/* The heading and each row's chevron set the results apart from the
          field above, so a row never reads as a second field. */}
      <h2 id={headingId} className="kicker candidate-heading">{copy.CANDIDATE_LIST_HEADING}</h2>
      <ul className="candidate-list" aria-labelledby={headingId}>
        {candidates.map((candidate) => (
          // The resolution makes the address unique, so a repeated key would
          // be a broken invariant rather than expected data.
          <li key={`${candidate.address}:${candidate.lon}:${candidate.lat}`}>
            <button
              className="candidate-action"
              type="button"
              onClick={() => onChoose(candidate)}
            >
              {/* A place found by its name says it over its address, so it is
                  plain which address the pack is built on. */}
              {candidate.placeName ? (
                <span className="candidate-text">
                  <span className="candidate-place">{titleCase(candidate.placeName)}</span>
                  {candidate.address}
                </span>
              ) : (
                candidate.address
              )}
              <svg className="candidate-chevron" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
                <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </li>
        ))}
      </ul>

      <div className="candidate-dismiss">
        <button type="button" onClick={onNone}>
          {copy.NONE_OF_THESE}
        </button>
      </div>
    </div>
  );
}
