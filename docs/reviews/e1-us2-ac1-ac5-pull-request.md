# E1-US2-AC1–AC5: Add offline pack provenance and source handling

> **STACKED DRAFT — DO NOT MERGE YET**

This branch is stacked on `feature/e1-us1-ac9-pack-size-download` so review
shows only US2. After AC9 is accepted into the Epic branch, update this branch,
retarget this PR to `epic/epic-1-prepared-local-pack`, rerun every gate, and
only then request merge review.

## Scope

- Open a complete saved pack from Home and list each available stored layer,
  destination, manifest-verified recovery reference and attributed basemap.
- Group each item name with `Published by <publisher> · Saved <date>` and its
  device-calculated age, using full Australian month names and no leading zero.
- Label items from day 31 as `Not recently verified` without hiding, dimming or
  disabling their content or source controls.
- Remove a layer, destination or recovery item missing publisher or saved date
  before offer calculation and storage, then show the mandated omission reason.
- Reject other incomplete or unreviewed provenance, including non-HTTPS or
  non-allow-listed source URLs and missing licence values.
- Open pack detail from local complete-pack reads only. Recovery rows render
  only when the current local snapshot exactly matches the pack manifest.
- Intercept an original-source link while offline, keep the pack open behind
  the explanation, and repeat the locally stored publisher and saved date.

## Decisions

- `Source.retrievedAt` is the item saved-date field. Age does not use a
  publisher date, `Pack.createdAt`, or the current network.
- Device-clock dates in the future clamp to `Saved today`; the app does not
  display a negative age or claim that the device clock is correct.
- The day-30 refresh window is inclusive. `Not recently verified` begins on
  day 31 and is informational only.
- AC3's authoritative requirement that online and offline pack content be
  identical controls this surface. Opening PackDetail adds no network-dependent
  content or connectivity banner.
- Pack-detail recovery rows are not inferred from global storage: their count
  and canonical SHA-256 must match the pack manifest or they are withheld with
  an explicit integrity state.
- Original source links accept HTTPS subdomains of the reviewed source-domain
  register only. Link activation is an explicit user action; PackDetail itself
  contains no fetch path.

## Security and privacy

- Stored: no new record type or field. Valid layers, destinations, recovery
  rows and packs retain their existing shapes. Missing-publisher/date items are
  absent from IndexedDB, confirmed by integration and browser inspection.
- Not stored: omission details remain in the transient offer only. No search
  history, rejected address candidate, position, needs selection, device
  identifier, document content or polygon geometry was added.
- Leaves the device: opening a pack and every offline source interaction send
  zero requests. An online source link can navigate only to the selected
  validated HTTPS source URL.
- Queued: no job is created or changed.
- Permissions: none requested.
- Integrity: building packs remain inaccessible; recovery manifests are
  checked before rows render; malformed display provenance is omitted before
  offer size/hash calculation; other incomplete provenance fails the build.
- Licence: every retained source still requires a non-empty licence. NSP
  provenance remains explicitly `permission to be confirmed`.
- Wording: absence and integrity failures are stated; no substitute or
  placeholder is invented; the banned-terms gate is clean.

## Verification evidence

- Focused core/data/UI tests: passed.
- US2 Playwright acceptance evidence: 6/6 passed.
- US2 plus AC9 focused browser regression: 10/10 passed.
- `npm run verify`: 247/247 tests passed; 100% statements, branches, functions
  and lines; wording scan clean; snapshot age 0 days.
- `npm run build`: passed; production PWA bundle generated at 115.14 kB gzip,
  within the 150 kB initial-JS budget.
- Full Playwright regression: 36/38 passed. The only failures are the unchanged
  service-worker controller timeouts isolated in Draft PR #1; every AC1–US2
  feature test passed.

## AC status

- `E1-US2-AC1 — Partial`: all available typed item categories render through
  the shared provenance component, but final evidence with real EPIC 2
  destinations, EPIC 4 recovery content and production basemap remains blocked
  by those approved contracts/assets.
- `E1-US2-AC2 — Implemented`: missing publisher/date items are excluded before
  offer calculation and storage, the reason is shown, and no keep-anyway
  control exists.
- `E1-US2-AC3 — Partial`: the local, immediate, zero-request behaviour is
  implemented and tested for available item types; the same later-content
  evidence gap as AC1 remains.
- `E1-US2-AC4 — Partial`: saved date, same-day wording, elapsed days, future
  clock handling and the day-30/31 boundary are implemented. A genuine pack
  refresh action remains deferred because the refresh pipeline is not yet
  present; no non-functional control was added.
- `E1-US2-AC5 — Implemented`: the link remains a link, offline activation sends
  no request, the explanatory state repeats local provenance, and dismissal
  restores the unchanged pack.

## Evidence for reviewers

- Code quality: review pure provenance decisions in `src/core/provenance.ts`,
  canonical recovery verification, and the complete-pack-only read boundary.
- Security: inspect the omission browser test's empty destination store and the
  zero-request AC3/AC5 tests.
- UX/accessibility: inspect the 200% text case, semantic list grouping, natural
  link role, unchanged stale controls and offline source state over the pack.

## Deferred

- Real EPIC 2 destination and EPIC 4 recovery contracts/content.
- Reviewed production PMTiles archive and basemap attribution row.
- Genuine online pack-refresh pipeline and refresh control.
- Deployed-build, real-device VoiceOver and airplane-mode evidence remain for
  TEST/UAT owners before mentor acceptance.
