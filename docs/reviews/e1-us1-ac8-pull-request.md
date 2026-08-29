# E1-US1-AC8: Add explicit saved-place conflict choice

> **STACKED DRAFT — DO NOT MERGE YET**

This branch is stacked on `feature/e1-us1-ac5-ac7-area-check` so review shows
only AC8. After AC5–AC7 is accepted into the Epic branch, update this branch,
retarget this PR to `epic/epic-1-prepared-local-pack`, rerun every gate, and
only then request merge review.

## Scope

- Check the complete-pack store after address confirmation and before any area
  network request.
- If one complete pack exists, show the existing and proposed addresses
  together with equal-weight `Keep the saved place` and
  `Replace it with this one` controls.
- Keep and leave/cancel preserve the existing pack byte-for-byte.
- Replace records an explicit in-memory decision and starts the next build
  stage while the existing pack remains current and unchanged.
- Store-read failure and an invalid multiple-pack condition stop the flow,
  state that nothing changed, and make no area request.

## Decision record

EPIC 1 permits one complete pack. `Keep` returns without changing it. `Replace`
authorises a hidden replacement build; it does not delete or modify the current
pack. The final `Saved place replaced` state may appear only after the future
complete-pack pipeline verifies the staged replacement and atomically swaps it
with the existing pack, as required by baseline R4.

## Security and privacy

- Stored: no new values. AC8 reads complete packs through the sanctioned API.
- Leaves the device: nothing while the conflict decision is unresolved.
- Keep, leave, store failure and invalid-multiple paths make no area request and
  perform no write.
- Replace starts the already reviewed official area check only after the tap.
- No dependency, permission, background task or device identifier was added.

## Verification evidence

- `npm run verify`: 198/198 tests passed; 100% statements, branches, functions
  and lines across `src/core`; wording scan clean; snapshot age 0 days.
- `npm run build`: passed; production PWA bundle generated.
- Focused AC5–AC8 Playwright regression: 11/11 passed.
- Full Playwright regression: 26/28 passed. Both failures are the pre-existing
  service-worker controller timeouts isolated in Draft PR #1; every AC1–AC8
  feature test passed.
- AC8 cases cover display order, equal controls, target size, zero pre-choice
  area calls, Keep, Leave, Replace authorisation, store failure and
  invalid-multiple handling.

## Status

`Partial` — the compare-and-choose state and explicit replacement authorisation
are implemented. Final atomic replacement and the `Saved place replaced` state
remain dependent on the complete-pack build pipeline after AC9.

## Review focus

- Code quality: pure conflict decision, exhaustive state handling and read-only
  use of complete packs.
- Security: prove every write path is absent from this AC and no area request
  happens before explicit Replace.
- UX/accessibility: both addresses are unchanged and ordered correctly; neither
  option is selected or visually favoured; labels state their outcomes.
