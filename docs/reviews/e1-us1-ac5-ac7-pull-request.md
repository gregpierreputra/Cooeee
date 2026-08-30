# E1-US1-AC5–AC7: Add official bushfire-area outcomes

> **STACKED DRAFT — DO NOT MERGE YET**

This branch is stacked on `feature/e1-us1-ac2-ac4-address-search` so its review
shows only AC5–AC7. After AC2–AC4 is accepted into the Epic branch, update this
branch, retarget this PR to `epic/epic-1-prepared-local-pack`, rerun every gate,
and only then request merge review.

## Scope

- E1-US1-AC5: show the inside-Designated-Bushfire-Prone-Area state with DTP,
  saved date and the official-instructions priority line.
- E1-US1-AC6: keep `none-mapped-here` and `not-published` as separate states.
- E1-US1-AC7: show one failed-check state for offline/service failure, retain the
  chosen address in memory for explicit retry, and write nothing to the device.
- Query DTP WFS using `POINT(lat lon)` and request attributes only, never polygon
  geometry.
- Resolve a zero point result with a versioned BPA extent snapshot plus a live
  existence probe. The live probe controls disagreement and emits a defect signal.

## Evidence

- `npm run verify`: 193 tests passed; 100% statements, branches, functions and
  lines across `src/core`; wording scan clean; snapshot age 0 days.
- `npm run build`: passed; production PWA bundle generated.
- Focused Playwright AC5–AC7: 5/5 passed.
- Full Playwright regression: 20/22 passed. The two failures are the pre-existing
  service-worker controller timeouts isolated in Draft PR #1; all AC1–AC7 tests
  passed.
- Official BPA extent snapshot built from DTP WFS: 76 LGAs. All eleven required
  metropolitan not-published controls are absent from `publishedIn`.

## Security and privacy

- Stored: no new IndexedDB, localStorage or sessionStorage values. The selected
  address and area result remain in memory.
- Leaves the device: confirmed latitude/longitude to the official LGA and BPA
  WFS checks; the LGA name to the official BPA existence probe; same-origin
  requests for the extent index and snapshot.
- External shapes are asserted at the data boundary. HTTPS is used for WFS.
- No geometry, rating, comparison, search history, rejected candidate, device
  identifier or background retry is stored or transmitted.
- No new dependency or permission was added.

## Not included

- No complete-pack write or `Place saved` state; these require the later pack
  commit pipeline.
- No AC8 replacement decision or AC9 download-size choice.
- No service-worker correction; that remains isolated in Draft PR #1.

## Review focus

- Code quality: three-state decision, parser assertions, request cancellation,
  snapshot/probe precedence and retry lifecycle.
- Security: zero writes on AC7, minimum outbound values, no polygon geometry,
  no background retry.
- UX/accessibility: exact wording, result order, live status announcement,
  320px reflow, explicit retry and unchanged address.
