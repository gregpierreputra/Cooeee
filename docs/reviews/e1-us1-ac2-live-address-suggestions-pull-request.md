# E1-US1-AC2 — Live address suggestions

## Pull request

**Title:** `E1-US1-AC2: Run the address search while the user types`

**Provisional target:** `fix/wire-production-pack-save`, retargeted to the Epic 1 line once that merges
**Source branch:** `feature/e1-us1-ac2-live-address-suggestions`

## Scope

`vicmap-address.txt` USE 1 specifies the address search as a runtime query that runs while the user types, at three characters or more, and `system-architecture.txt` lists it as sanctioned network call 2, "while typing in the pack builder". The screen required an explicit submit; that gap was recorded as a deliberate deferral and is closed here.

- The query runs from `ADDRESS_QUERY_MIN_CHARS` after `ADDRESS_QUERY_DEBOUNCE_MS` of quiet.
- Below the minimum: no request, no list, and a line saying what to do. No spinner in any state.
- The candidate list moved from a page that replaced the field to a section below it, because a live list must not take the screen away from the text it answers.
- The explicit Search button remains; it, and Enter, run the current query immediately. A tap while that query is already in flight is a no-op rather than a second request.
- Every candidate rule is unchanged: no auto-select at any count including one, no ranking, no score, retired records excluded, `is_primary` a deduplication tie-break only, service order preserved.

## The three states that must never be conflated

`liveSearchState` in `src/core/address-search.ts` is the only place the screen's state is decided, and a settled answer carries the query it answers. A result claim is therefore reachable only through an answer whose own query still matches the field.

| state | reached when | shown |
|---|---|---|
| still typing / in flight | the query has no answer of its own | `SEARCH_IN_PROGRESS`, nothing else |
| ran and returned nothing | this exact query was answered with nothing | the baseline R2 literal |
| could not run | this exact query failed | AC4's two sentences, unchanged |

The mandated no-match sentence is unreachable while a request is pending or in flight, by construction rather than by care. Each state has its own end-to-end test.

## Stale responses

A superseded request is cancelled twice over: the browser aborts it on the wire when the query changes (asserted through Chromium's own `net::ERR_ABORTED` record, not the app's opinion), and any answer that still arrives is dropped on arrival by request id. A cancelled request never settles as AC4's unavailable state, because our own cancellation is not the register failing to answer.

## Counting

`ADDRESS_RESULT_COUNT` states both numbers in one line: how many records the register returned, and how many distinct addresses are listed. AC2's "the number of lines shown equals the number of candidates returned" holds on the second number; the first exists so that a capped response of ten reads as a cap and not as the whole register, with `ADDRESS_RESULT_CAPPED` naming the cap when it is reached.

## Accessibility

Two existing checks are unchanged (WCAG 1.3.1, the list is marked up as a list so its length is announced; WCAG 1.4.1, no candidate is distinguished by colour alone). One is added:

- **WCAG 4.1.3** — the number of results is announced when the list changes, without the user moving focus. The list updates while a screen-reader user types, which 1.3.1 does not cover: it describes the list on arrival, not its replacement. Test, one minute: turn on VoiceOver, type `RIDGE` in the address field, then type one further character, and confirm the new count is spoken without touching the list.

## Data and privacy

- Outbound: the trimmed, uppercased, CQL-escaped typed prefix, by GET, to the Vicmap WFS address endpoint. One endpoint, no body, no other host — asserted by a route interceptor over every request the page makes.
- The typed prefix leaves the device more often than under an explicit submit. `ADDRESS_QUERY_MIN_CHARS` and `ADDRESS_QUERY_DEBOUNCE_MS` are what bound the volume: a nineteen-character address costs one request, asserted.
- Nothing typed, returned, rejected or dismissed is written to IndexedDB, localStorage or sessionStorage — asserted after four queries, a dismissal and a correction.
- No analytics, device identifier, position or background retry is introduced. No fifth Iteration 1 network-call category is introduced.

## Verification recorded

- `npm run verify`: clean, including ESLint and `tsc --noEmit`.
- Unit and integration: 299/299 passed. Core coverage 100% statements, branches, functions, lines.
- `node scripts/banned-terms.mjs`: clean. `node scripts/snapshot-age.mjs`: 1 snapshot, oldest 2 days (limit 60).
- Playwright: 66/66 passed, including every pre-existing AC1, AC3–AC9 and US2 spec unchanged.
- `npm run build`: passed.

## Review requested

- Code quality: the state model, the debounce and cancellation, and the effect's dependencies.
- Security/privacy: outbound volume, and that nothing typed is retained.
- UX/accessibility: the live region announcement, the list under the field, and the retained Search button.
- Acceptance review: AC2, with AC3 and AC4 re-checked on the live path.

## Not included

- Removing the Search submit button. It would touch three specs belonging to other criteria while this branch is stacked on an unmerged fix; raised as its own change, with a user check.
- Combobox or autocomplete ARIA semantics; the mandated list markup is kept.
- Substring or widened search, caching, suggestion history, ranking or scoring.
- Any change to Dexie schema version 1.
