# E1-US1-AC9: Add pack size offer and text-only staging

> **STACKED DRAFT — DO NOT MERGE YET**

This branch is stacked on `feature/e1-us1-ac8-pack-conflict` so review shows
only AC9. After AC8 is accepted into the Epic branch, update this branch,
retarget this PR to `epic/epic-1-prepared-local-pack`, rerun every gate, and
only then request merge review.

## Scope

- Generate a versioned device-local offer with exact canonical text bytes,
  group hashes/counts, and separately reported map-tile metadata.
- Show `Ready to download`, the text/map size split, and equal unselected
  `Download both` and `Text only` controls.
- Make an unavailable map option explicit while leaving text-only available.
- Perform no pack-content request or device write before an explicit choice.
- Stage text content under a hidden `building` pack, reread and verify its
  manifest and size, then expose it atomically as `complete`.
- Record text-only packs with zero tile bytes/count and no blank map.
- On interruption, immediately remove the building pack and owned rows while
  leaving any previous complete pack byte-identical; retry remains explicit.
- For a verified replacement, atomically expose the new pack and remove the
  superseded pack and its owned rows in the same transaction.

## Decision record

The production topology was frozen before implementation in
`docs/architecture/pack-manifest-topology.md` (commit `1bf13c5`). The AC9
`build response` is generated locally; no backend, account service, or remote
user database was invented. The builder accepts complete typed content from
approved sources and must not fabricate data owned by later epics.

## Security and privacy

- Stored after consent: the hidden pack row and supplied text layers and
  destinations; recovery records are verified against the existing local
  snapshot store. A completed text-only pack declares zero tiles.
- Stored before consent: nothing. Offer generation performs no IndexedDB write.
- Leaves the device during the implemented text-only path: nothing.
- Map metadata may be read before consent only to calculate the offer; tile
  payload ranges may be requested only after `Download both`.
- Building packs are excluded from the sanctioned read API. Verification or
  download failure triggers immediate targeted cleanup; startup sweeping
  remains crash defence.
- Every record requires complete source provenance. Canonical group hashes and
  exact byte counts must match before finalisation.

## Verification evidence

- Focused unit/data regression: 36/36 passed.
- AC9 Playwright evidence: 4/4 passed.
- `npm run verify`: 221/221 tests passed; 100% statements, branches, functions
  and lines; wording scan clean; snapshot age 0 days.
- `npm run build`: passed; production PWA bundle generated.
- Full Playwright regression: 30/32 passed. Both failures are the unchanged
  service-worker controller timeouts isolated in Draft PR #1; every AC1–AC9
  feature test passed.
- AC9 cases cover exact displayed sizes and order, equal unselected controls,
  zero pre-choice writes/callbacks, verified text-only storage, explicit zero
  tiles, no blank map, immediate interruption cleanup, byte-identical previous
  pack preservation, retry, and unavailable-map messaging.

## Status

`Partial` — the local offer contract, exact text accounting, consent boundary,
text-only staging/finalisation, replacement transaction and failure cleanup are
implemented. Production `Download both` remains unavailable until a reviewed
self-hosted PMTiles archive URL and measured metadata exist. Production flow
integration also waits for the real EPIC 2 and EPIC 4 content contracts rather
than inserting empty or synthetic product data.

## Review focus

- Code quality: canonical encoding, deterministic manifest checks, strict
  core/data/UI separation, and atomic lifecycle transitions.
- Security: prove zero writes before consent, no hidden outbound user data,
  complete provenance, and no partial pack visibility or orphan rows.
- UX/accessibility: exact copy and order, equal choices, disabled map option
  with a stated reason, target sizes, interruption truthfulness, and retry.
