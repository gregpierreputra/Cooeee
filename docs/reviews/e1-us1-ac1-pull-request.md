# E1-US1-AC1 — Place confirmation

## Pull request

**Title:** `feat(epic-1): add AC1 place confirmation`

**Target branch:** `epic/epic-1-prepared-local-pack`  
**Source branch:** `feature/e1-us1-ac1-confirm-place`

## Summary

Implements the place-confirmation portion of Epic 1, User Story 1, Acceptance Criterion 1.

- Displays the returned address as immutable text.
- Allows the user to edit the place name.
- Preserves an empty or whitespace-only edited name exactly.
- Holds the pending place in memory with GeoJSON longitude/latitude ordering.
- Discards the pending place when the user searches again or abandons the flow.
- Does not add persistence, automatic selection, address lookup, or external network activity.

## Acceptance-criterion status

**E1-US1-AC1: Partial**

This pull request covers the approved place-confirmation slice only. The following remain deferred to later acceptance criteria or feature work:

- complete-pack persistence;
- the “Place saved” outcome;
- reopening a saved place;
- address search;
- bushfire checking;
- other later Epic 1 acceptance criteria.

## Verification evidence

Evidence recorded at the time this draft was prepared:

- Unit tests: 146/146 passed.
- Coverage: 100% for the verified scope.
- Production build: passed.
- AC1 browser tests: 6/6 passed.
- Keyboard, contrast, and target-size accessibility checks: passed.
- No test fixture is included in the production application.
- No persistence or external network request is introduced by this slice.

Re-run the verification suite after updating the Epic branch or rebasing this feature branch, and replace these figures if the results change.

## Review requested

- Code quality and maintainability.
- Security and privacy, particularly unintended persistence or network activity.
- UX and accessibility of the confirmation interaction.
- Business-analysis review against the approved AC1 scope and deferred items.

## Merge condition

Open this pull request only after the service-worker fix has been merged into `main` and the Epic 1 integration branch has been updated from that corrected baseline. Greg, as the `main` branch custodian, retains final merge authority.
