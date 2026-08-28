# E1-US1-AC2–AC4 — Address search outcomes

## Pull request

**Title:** `feat(epic-1): add explicit address search outcomes`

**Provisional target:** the Epic 1 integration branch after AC1 and the service-worker fix are incorporated  
**Source branch:** `feature/e1-us1-ac2-ac4-address-search`

## Scope

- AC2 lists every active, deduplicated Vicmap candidate in returned order.
- No candidate is selected, highlighted, ranked or saved before a user tap.
- One candidate remains a one-item choice list.
- AC3 represents a successful empty response with the baseline R2 exact literal.
- AC3 retains the typed query and runs no fallback or widened search.
- AC4 represents offline, request failure, timeout and invalid responses as search unavailable.
- AC4 distinguishes service failure from a successful empty result and retries only after a user tap.
- A selected candidate continues into the existing AC1 confirmation state.

## Data and privacy

- Outbound value: the explicitly submitted, trimmed and uppercased address query, CQL-escaped, sent to the official Vicmap WFS endpoint.
- No analytics, device identifier, rejected candidate or background retry is introduced.
- Typed queries and candidate records remain in React memory only.
- No IndexedDB, localStorage or sessionStorage write occurs in AC2–AC4.
- External feature collections and records are asserted before use.
- Inactive records are excluded and exact duplicates are collapsed without changing visible order.

## Verification recorded

- `npm run verify`: passed.
- Unit/data tests: 162/162 passed.
- Core coverage: 100% statements, branches, functions and lines.
- Banned-terms check: clean.
- Snapshot-age check: no snapshots present.
- AC2–AC4 Playwright tests: 8/8 passed.
- Production build: passed as part of the Playwright run.

The complete Playwright suite currently has three failures in the pre-existing service-worker cold-start area while the dedicated service-worker fix PR is awaiting merge. Rebase or merge the corrected baseline into this branch and rerun the complete suite before opening or approving this pull request.

## Review requested

- Code quality: state separation, filtering and response parsing.
- Security/privacy: outbound query, no persistence and no automatic retry.
- UX/accessibility: semantic list, equal candidate presentation, live failure status and 200% text sizing.
- Acceptance review: AC2, AC3 and AC4 separately, in register order.

## Not included

- AC5 or later bushfire-area checks.
- Pack persistence or complete-pack commit.
- Suggested, widened or fallback address searches.
- Automatic selection, ranking or background retry.
- Final visual-system refinement.
