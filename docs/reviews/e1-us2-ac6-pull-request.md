# E1-US2-AC6: Know where I stand the moment I open the app

Branch: `feature/e1-us2-ac6-home-shell`, branched from `main`.

Builds E1-US2-AC6 only. E1-US1-AC6 (the published-data absence states) is a
different, already-built criterion and is untouched; E1-US2-AC1 to AC5 are
drafted on their own branch and are neither merged nor depended on here.

## Scope

- The returning-user home screen: with a pack saved, the saved place, its age,
  one way into the pack and the hold-to-enter BlackSky control, all on screen
  without scrolling or tapping.
- With no pack saved, the screen states that plainly and offers to build one.
  BlackSky stays reachable in both states.
- A fixed header, mounted once by the application shell and carried by every
  screen after home: mark and name on the left returning home, the saved pack's
  age on the right, and a connection dot with no words.
- One preparation line per day, grounded in Country Fire Authority plan-and-
  prepare guidance, with its source named on screen beside it.
- Bottom navigation with two Iteration 1 destinations. BlackSky is not one.

## Baseline overrides named in the plan

- **R13.** AC6 is new scope added 1 September 2026. The day arithmetic
  (`savedAgeDays()`, `PACK_REFRESH_DAYS`) and the hold-to-enter gesture
  (`HOLD_MS`, the pointer handlers, the vibration cue) already existed and were
  reused and extracted rather than rebuilt.
- **R13.** `Home.tsx` previously listed every saved pack and always offered
  "Build a pack". That predated the one-pack Open-or-Build rule and this branch
  replaces it, as the resolution anticipates.
- **R12.** Iteration 1 is mapless. Nothing on this screen renders, mentions or
  reserves space for a map.
- **Rule 0.2.** The refresh window is 30 calendar days and inclusive: day 30 is
  still reported in days, and the label starts on day 31.

## Decisions

- The header's wording is deliberately not the pack card's. `Checked N days
  ago` reports when the pack's contents were last checked; `Saved N days ago`
  reports when the pack was written. Both derive from the same `savedAgeDays()`
  call, so the two lines can never disagree about the number while staying
  distinguishable in words. Alternative rejected: reusing `SAVED_DAYS_AGO` in
  the header, which would have made one line stand for two different facts.
- The header is mounted once in `src/app.tsx` rather than rendered per screen,
  which is what the AC's "one component reused by every screen" requires. It is
  withheld on `/blacksky` only: that mode is a full-screen surface with one
  deliberate way out, and a second top bar across it would be a second way to
  leave it by accident. Recorded as a judgement call, not a baseline resolution.
- The existing `NoticeBar` (connection, in words) and `BackBar` (the persistent
  way back) belong to other accepted criteria and were left in place. The
  header's dot and the notice bar therefore both report connectivity, in
  different forms. Consolidating them would rewrite another criterion's mandated
  surface and is left to a scope decision rather than taken here.
- The preparation line is chosen from whole days since the epoch, not at
  random. The AC requires it to be fixed for the life of the screen; a day-based
  index is fixed across remounts as well, so navigating away and back cannot
  reshuffle it, and it is testable with no clock stubbing.
- The header reports the OLDEST complete pack. Iteration 1 stores exactly one,
  so this is the same pack the screen shows; the rule matters only if a later
  epic ever stores more, where the oldest is the honest figure.
- With a pack saved, home offers Open and no Build. That is the Open-or-Build
  rule, and it is what keeps this screen from being the way a second complete
  pack comes to exist. The consequence is recorded under Deferred.
- `HOME_TITLE` ("Your packs") was left unchanged. No acceptance criterion
  mandates it, and changing it would ripple into `BACK_TO_YOUR_PACKS`, which is
  another criterion's on-screen literal.

## Security and privacy

- **Stored.** No new record type, no new field, no Dexie version change. The
  header and the home screen only read, through `listCompletePacks()`. Nothing
  is written from either surface.
- **Leaves the device.** Nothing. Neither `AppHeader.tsx`, `Home.tsx`,
  `BottomNav.tsx` nor `HoldButton.tsx` contains a `fetch`, an import of `wfs`,
  `tiles` or `snapshots`, or any other outbound path. The offline cold-start
  end-to-end test asserts zero failed requests with the radios genuinely off.
- **Queued.** No job is created or changed.
- **Permissions.** None requested. There is no call to
  `navigator.geolocation` anywhere on this screen or in the header. The only
  platform calls are `navigator.onLine` plus the online/offline events, and
  `navigator.vibrate` as the confirmation cue on a completed hold.
- **Integrity.** Reads route through the sanctioned complete-pack API, so a
  building pack stays invisible here as everywhere else. The header renders no
  age at all when there is no pack, rather than a dash, a zero or a placeholder.
- **Licence.** The preparation lines are the app's own plain-language wording,
  grounded in Country Fire Authority plan-and-prepare guidance and rendered with
  that source named on screen. No third-party text is reproduced or cached.
- **Wording.** The banned-terms scan is green. The screen says nothing about
  conditions or incidents, offers no praise or blame for being prepared, and
  never suggests entering BlackSky when the connection is lost.

## Verification

- `npm run verify` — green. 19 test files, 368 tests. Core coverage:
  statements 100%, branches 99.62%, functions 97.8%, lines 100%.
- `npm run build` — green.
- `npm run e2e` — green. 106 tests, including the new `e2e/home-shell.spec.ts`.

Test cases mapped:

| Case | Where |
|---|---|
| TC-1.2.6-A (0 days) | `tests/core/home.test.ts`, `e2e/home-shell.spec.ts` |
| TC-1.2.6-B (30 days, no label) | `tests/core/home.test.ts`, `e2e/home-shell.spec.ts` |
| TC-1.2.6-C (31 days, label) | `tests/core/home.test.ts`, `e2e/home-shell.spec.ts` |
| TC-1.2.6-D (no pack, no age, offer to build) | `tests/core/home.test.ts`, `e2e/home-shell.spec.ts` |
| TC-1.2.6-E (a tap does not enter) | `e2e/home-shell.spec.ts`, `e2e/blacksky-offline.spec.ts` |
| WCAG 2.5.5 (44px target, hint after a cut-short press) | `e2e/home-shell.spec.ts` |
| WCAG 4.1.2 (the age is real text) | `e2e/home-shell.spec.ts` |

## Proof to capture for the board card

- Deployed build on a phone, four captures: a fresh pack, a pack older than 30
  days, no pack saved, and the same screen with the connection turned off.
- A recording showing a tap on the BlackSky control does not enter it and a
  sustained hold does.
- The passing unit run for the age wording at 0, 29, 30, 31 and 44 days and for
  the preparation-line selector.

## Deferred

- With a pack saved, home no longer carries an entry into the build flow, which
  is what the Open-or-Build rule requires. The replace path (E1-US1-AC8) is
  therefore not reachable from home on this branch. Its entry point belongs to
  that criterion's own surface and needs a scope decision about where it lives.
- The connection dot duplicates `NoticeBar`'s connectivity reporting. Merging
  the two is a change to another accepted criterion's mandated surface.
- Bottom navigation lists only the Iteration 1 destinations. EPIC 2 and EPIC 4
  surfaces are not fabricated here.
