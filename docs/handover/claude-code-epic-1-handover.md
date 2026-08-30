# Claude Code handover - Cooeee Epic 1

**Handover date:** 30 August 2026 (Australia/Melbourne)

**Repository:** `https://github.com/gregpierreputra/Cooeee`

**Local repository:** `/Users/dap/Monash/FIT5120/Cooeee-Workspace/Cooeee`

**Private local guidance:** `/Users/dap/Monash/FIT5120/Cooeee-Workspace/local-guidance`

**Current production branch:** `main` at `be293899660e22ea9331146f497a0d68aaf5e4dd`

## 1. Read this first

This document hands over the current Epic 1 implementation and its unresolved work. It is intentionally honest: Epic 1 has strong tested foundations, but the production application is not yet the uninterrupted cloud-to-device journey shown in the system and sequence diagrams.

Before changing code:

1. Read this document completely.
2. Read `README.md`, `docs/evaluation/epic-1-evaluation-pack.md`, `docs/evaluation/epic-1-code-evidence.md`, and every applicable document under `docs/reviews/`.
3. Read the private controller prompt `../local-guidance/agentic-development/prompt-bank/feature-development.txt` completely.
4. Read both authoritative requirement files named by that controller completely.
5. Trace the real production flow and every caller of code that may change.
6. Run the existing verification gates before editing and retain the output as the before-state.
7. Present the controller's Phase 2 plan and obtain approval before editing.

Do not treat this handover as permission to resolve material product or architecture decisions silently.

## 2. Repository and guidance structure

```text
Cooeee-Workspace/
├── Cooeee/                         public Git repository
│   ├── CLAUDE.md                   Claude entry point
│   ├── src/
│   │   ├── core/                   pure decisions, types, copy, constants
│   │   ├── data/                   WFS, IndexedDB, integrity, pack building
│   │   ├── ui/                     React rendering and interaction
│   │   ├── app.tsx                 production routes
│   │   └── main.tsx                startup cleanup and service worker
│   ├── tests/                      Vitest unit/integration tests
│   ├── e2e/                        Playwright and test-only harness
│   ├── scripts/                    policy and snapshot checks/builders
│   ├── public/                     PWA/static assets
│   ├── docs/architecture/          pack topology decision
│   ├── docs/reviews/               AC-specific review records
│   └── docs/evaluation/            Epic 1 tutor/evaluation evidence
└── local-guidance/                 private source material; never commit
    ├── requirements/
    └── agentic-development/prompt-bank/
```

`local-guidance/` is deliberately outside the Git repository. Read it locally but do not copy it into the public repository.

## 3. How development was controlled

Every run was governed by `feature-development.txt`. Only Part A changes for a run; Parts B and C define stable source routing and the six-phase process:

1. Understand the selected AC and all degraded states.
2. Show a file-by-file plan and wait for approval.
3. Implement one bounded AC or approved AC group.
4. Add unit, integration, negative and browser evidence.
5. Report storage, outbound data, permissions, integrity, licensing and wording.
6. Run verification and report faithful status, gaps and evidence.

The implementation follows these mechanical boundaries:

- `src/core/`: pure decisions only; no React, DOM, fetch or Dexie.
- `src/data/`: external parsing, networking, persistence and integrity.
- `src/ui/`: rendering and interaction; no raw database reads.
- User-facing copy belongs in `src/core/copy.ts`.
- Thresholds belong in `src/core/constants.ts`.
- Offline surfaces must make zero requests.
- A staged pack stays hidden until verified and complete.
- Replacement is explicit and atomic; the old complete pack survives failure.
- Absence, unavailable and not-published are different states.
- Synthetic records belong only in `e2e/harness/`, excluded from production.

## 4. Git and review workflow

`main` is protected and Greg is the production custodian. The documented flow is:

```text
main
├── fix/<problem>                    one production/baseline repair -> PR to main
└── epic/<epic-name>                 temporary epic integration branch
    └── feature/<acceptance-criteria> reviewable feature PR -> epic branch
```

Feature work does not bypass the epic integration branch. After the integrated epic passes all agreed reviews, one final epic PR targets `main`. Delete short-lived branches after merge. If `main` changes while an epic is active, synchronise the epic before continuing.

Epic 1 merge history:

| PR | Scope | Final state |
|---|---|---|
| #1 | Service-worker control fix | Merged to `main` |
| #2 | Branch and PR workflow | Merged to `main` |
| #3 | E1-US1 AC1 confirmation foundation | Merged into Epic 1 stack |
| #4 | E1-US1 AC2-AC4 address outcomes | Merged into Epic 1 stack |
| #5 | E1-US1 AC5-AC7 area outcomes | Merged into Epic 1 stack |
| #6 | E1-US1 AC8 pack conflict | Merged into Epic 1 |
| #7 | E1-US1 AC9 pack offer/staging | Merged into Epic 1 stack |
| #8 | E1-US2 AC1-AC5 provenance/offline sources | Merged into Epic 1 stack |
| #9 | Corrected `main` baseline sync | Merged |
| #10 | Reviewed AC2-AC7 integration sync | Merged |
| #12 | Final Epic 1 package | Merged into `main` |

GitHub issue and PR numbers share one sequence; do not assume a missing PR because the sequence skips a number.

## 5. Current implementation

### E1-US1 - create and maintain a prepared local pack

| AC | Current aggregate status | What exists |
|---|---|---|
| AC1 | Implemented foundation; production integration gap remains | Candidate confirmation, exact returned address, editable name, in-memory pending place |
| AC2 | Implemented | Explicit candidate list; no auto-selection, including one result |
| AC3 | Implemented | Honest no-match state; typed query retained; no substitute place |
| AC4 | Implemented | Offline/service-failure state and explicit retry |
| AC5 | Implemented | Inside designated BPA state with publisher/date and official-first wording |
| AC6 | Implemented | Distinct `none-mapped-here` and `not-published` outcomes |
| AC7 | Implemented | Failed area check retains pending address and writes nothing |
| AC8 | Implemented | Explicit keep/replace choice; existing complete pack protected |
| AC9 | Partial | Exact offer, provenance filtering, text-only staging, integrity verification and atomic finalisation exist; production content/service/tiles and UI wiring are incomplete |

### E1-US2 - understand what is in a saved pack

| AC | Status | What exists / gap |
|---|---|---|
| AC1 | Partial | Shared item projection with publisher and saved date exists; complete genuine later-epic content is unavailable |
| AC2 | Implemented | Items missing display provenance are excluded before storage with explicit explanation |
| AC3 | Partial | Stored detail is network-blind and tested offline; final real pack content path is incomplete |
| AC4 | Implemented | Day-age and day-31 stale labels do not disable content |
| AC5 | Implemented | First source action never navigates; a second explicit external action is required |

Important implementation files:

- `src/data/wfs.ts`: Vicmap address and BPA/LGA requests plus boundary assertions.
- `src/ui/PackNew/Search.tsx`: address -> candidate -> confirmation -> conflict -> area flow.
- `src/core/types.ts`: domain contracts and honesty-bearing unions.
- `src/data/db.ts`: Dexie v1, complete-pack-only reads and startup sweep.
- `src/data/pack-build.ts`: offer, hidden staging, verification, cleanup and atomic finalisation.
- `src/core/provenance.ts`: provenance completeness, age and source-access decision.
- `src/ui/PackDetail.tsx`: network-blind saved-pack detail and two-step source access.
- `src/app.tsx`: current production routes.

## 6. Verification baseline

At the final reviewed Epic 1 state, recorded evidence reported:

- `npm run verify`: 249/249 tests passed; gated `src/core/**` coverage 100%.
- Full Playwright suite: 38/38 passed.
- PR #12 checks: verify, browser regression and Vercel passed.

These are historical SHA-bound results, not permission to skip verification. Rerun on the current branch and report actual output.

```bash
npm install
npm run verify
npm run build
npm run e2e
```

Node 20 or newer is required. Playwright may require `npx playwright install chromium` on a new machine.

## 7. Critical live issue discovered during handover

The production address screen at `http://localhost:5173/packs/new` currently enters the AC4 service-unavailable state for every query tested.

On 30 August 2026, a direct read-only request from the development Mac to:

`https://opendata.maps.vic.gov.au/geoserver/wfs`

timed out with zero response bytes. A GetCapabilities request also timed out. The known schema sample query for `6 RIDGE ROAD KALORAMA 3766` could therefore not be evaluated. This establishes an upstream/network integration failure at that time; it does not establish that the address is absent.

Do not use `12 EXAMPLE ROAD CLAYTON SOUTH 3169`; it was illustrative text, not verified test data. The Kalorama address in the browser harness is synthetic/test-only even though the prompt-bank schema recorded a previously verified Vicmap sample. Never promote harness data to production.

Current address behaviour:

- browser calls Vicmap WFS directly;
- explicit search, minimum three characters;
- uppercase prefix match on official `ezi_address`;
- active records only, maximum ten;
- coordinates read from GeoJSON `[lon, lat]`, never bbox;
- all request, HTTP, timeout and parse failures intentionally collapse to the honest unavailable state.

Before editing, determine whether the official endpoint is temporarily unavailable, has moved, or needs an approved integration adapter. A same-origin proxy can address browser/CORS/control concerns but cannot repair an upstream that returns no bytes. Do not replace Vicmap with OpenRouteService without an approved data/product decision: Cooeee needs authoritative Victoria-wide addresses, while the prior Unwind application used server-side OpenRouteService geocoding constrained to Melbourne CBD.

## 8. Plan-versus-implementation audit

The plan source reviewed during handover is:

`/Users/dap/Documents/2026 08 28 DeSGN Slide Template_Iter1.pdf`

Relevant slides are the system diagram (16), data entities (21), application sequence (22) and Epic 1 definition (25). The current verdict is **partially aligned**.

### System architecture

Aligned:

- local IndexedDB pack store;
- PWA/service-worker foundation;
- complete-pack-only offline reads;
- source/licence/saved-date provenance;
- explicit source exit;
- no warnings, live routes or eligibility decisions.

Not implemented in production:

- cloud open-data ingestion and normalisation;
- cloud Pack Builder;
- HTTPS versioned Pack Service;
- production pack payload assembly;
- reviewed PMTiles archive/download;
- production BlackSky and Recovery routes.

The repository currently builds a static Vite application with no functions, API keys or server database. Address and area checks call Vicmap directly. The AC9 pack offer is device-generated from caller-supplied content.

### Data model differences requiring an explicit decision

| Slide plan | Current code | Decision needed |
|---|---|---|
| Separate `SAVED_LOCATION` with 1:N pack builds | Location identity is embedded in `Pack`; replacement removes the old complete pack | Add a v2 location/version model or revise the diagram |
| Separate normalised `DATA_SOURCE` | `Source` is embedded on pack and rendered items | Normalise in v2 or approve per-record immutable provenance |
| `EXPOSURE_LAYER.geometry` | Geometry is deliberately prohibited; status and selected attributes are stored | Decide which contract is authoritative before adding geometry |
| Destination `primary`/`backup` roles | Code deliberately gives up to two chosen destinations equal status | Update diagrams; detailed Epic 2 AC says neither is primary/backup/best |
| Pack-owned recovery references | Recovery programs are a verified global local snapshot referenced by manifest | Approve manifest topology or redesign with migration |
| `READY_KIT_ITEM` and `REHEARSAL_SESSION` | Not implemented; `ActionItem` is not the slide model | Leave to their epics; do not smuggle into Epic 1 repair |

The slide deck is internally inconsistent about destinations: its entity/sequence diagrams use primary/backup, while its detailed Epic 2 AC requires equal status. Current code follows the detailed AC and must not be changed silently.

### Production sequence gap

Planned sequence:

```text
save location
-> request versioned pack and size
-> user approves download
-> store complete pack with refresh date
-> open it offline
```

Current production sequence:

```text
search
-> candidates
-> confirmation
-> existing-pack decision
-> BPA/LGA check
-> stops at area result
```

`Size`, `saveTextOnlyPack`, downstream pack detail fixtures and failure branches are exercised through `e2e/harness/`, not wired into the production route. The harness is acceptance evidence for components and contracts, not evidence of an uninterrupted production journey.

## 9. Recommended next work, in order

Do not combine these into one unreviewable change.

### Work package 1 - address integration diagnosis/repair

1. Confirm the current official Vicmap Address access method from an authoritative source.
2. Capture status, timing, response headers/body shape and browser CORS behaviour.
3. Preserve the current distinctions among no-match, unavailable and malformed response.
4. If an adapter/proxy is required, document its privacy, deployment, rate, caching and failure contracts before implementation.
5. Add a regression test that proves the old live/integration failure and the corrected path.
6. Do not add silent retries, widened searches, synthetic fallbacks or alternate providers without approval.

Because the released `main` address capability is unavailable, a narrow repair normally uses `fix/vicmap-address-connectivity` from current `main` and targets `main`. If the approved solution materially changes the target architecture, stop and agree the branch/epic plan first.

### Work package 2 - production pack-flow integration

Wire an approved real flow:

```text
area result
-> obtain/assemble approved pack content and versioned offer
-> show exact text/tile size before payload download
-> record explicit text-only or text+map choice
-> hidden staging
-> manifest and byte verification
-> atomic completion/replacement
-> navigate to home or saved pack detail
```

The integration must reuse `createPackOffer` and `saveTextOnlyPack`; do not duplicate their decisions in UI code. Real tiles remain unavailable until a reviewed archive and licence exist. Do not claim `Download both` works until it does.

### Work package 3 - reconcile target architecture and schema

Obtain a product/architecture decision for every row in Section 8 before changing persistent structure. Any Dexie change is `db.version(2)` plus upgrade tests; never edit version 1.

### Work package 4 - update evaluation and prompt records

- Update Epic 1 evaluation status after each accepted repair.
- Preserve before/after SHA-bound evidence.
- Create the pending single prompt record at `docs/evaluation/epic-1-prompt-record.txt`.
- Record the governing `feature-development.txt` reference and the specific controller instructions for each PR, including PR #12.
- Do not fabricate verbatim historical prompts that cannot be recovered; mark reconstructed summaries clearly.

## 10. Manual and automated testing

The test harness is started separately:

```bash
npm exec vite -- --config e2e/harness/vite.config.ts
```

Useful deterministic test-only routes:

- `/area?mode=present`
- `/area?mode=none`
- `/area?mode=unpublished`
- `/area?mode=retry`
- `/area?mode=failure`
- `/conflict`
- `/conflict?mode=unavailable`
- `/conflict?mode=multiple`
- `/size`
- `/size?mode=unavailable`
- `/size?mode=interrupt`
- `/size?mode=omission`
- `/detail`
- `/detail?mode=stale`
- `/detail-launch`

Default harness input:

```text
query: RIDGE
candidate: 6 RIDGE ROAD KALORAMA 3766
place name: KALORAMA
coordinates: lat -37.817939, lon 145.36594
```

This is controlled test data. For UAT, clearly separate:

- deterministic harness acceptance;
- live official-service integration;
- production end-to-end journey;
- real-device offline, accessibility and permission testing.

Automated CI was green when merged, but the team explicitly deferred manual Code Quality, Security and UX/UAT testing. Keep these sign-offs pending until named reviewers attach evidence. Do not convert a deferred review into a pass.

## 11. Security and privacy invariants

- Typed address queries may leave the device only for the explicit approved address search.
- Confirmed coordinates may leave only for approved official context checks or pack request.
- Search history, rejected candidates, position history, device identifiers and analytics are not stored or sent.
- Packs and user actions stay in the one local IndexedDB database.
- Optional content missing publisher or saved date is omitted before storage.
- Required content with incomplete or unapproved provenance fails the build.
- Source URLs are HTTPS and allow-listed.
- Offline pack detail makes zero automatic requests.
- First source action only explains; a second explicit action may open the web.
- A `building` pack is never user-visible and is swept on startup.
- Failed replacement preserves the prior complete pack byte-for-byte.

## 12. Known documentation issues

- `README.md` still contains a stale “Where this is up to” paragraph saying several now-existing modules are not built. Correct it in a focused documentation change.
- Evaluation links may still target historical feature branches. Replace them with stable `main`/commit permalinks where appropriate.
- The system and data diagrams need status labels or revision after architecture decisions.
- The prompt record requested by the team is still pending.

## 13. Definition of a successful handover continuation

Claude's first response should not be a large implementation. It should provide:

1. the current branch/SHA and clean/dirty state;
2. the selected work package and exact requirement/AC;
3. actual baseline verification results;
4. the official-service diagnosis evidence;
5. the Phase 2 file/state/network/store/test plan;
6. explicit decisions needed from the product owner;
7. a clear list of what will not be changed.

Only after approval should implementation begin. A successful result preserves the existing honesty and atomicity guarantees, closes one bounded production gap, leaves runnable regression evidence, and reports remaining partial work without inflating status.

## 14. First Claude Code session

Start Claude Code from the repository root:

```bash
cd /Users/dap/Monash/FIT5120/Cooeee-Workspace/Cooeee
claude
```

Use this as the first prompt:

```text
Read CLAUDE.md and docs/handover/claude-code-epic-1-handover.md completely.
Then read the private feature-development.txt controller and the authoritative
requirements it routes to. This first turn is an audit and Phase 1/Phase 2 plan
only: do not edit files, create commits, push branches or open PRs yet.

Confirm the current main SHA and worktree state, run the baseline verification
gates, trace the production address-to-pack flow, and validate the current
official Vicmap Address access method using read-only evidence. Select only Work
Package 1 (address integration diagnosis/repair) unless evidence proves that a
different first blocker must be resolved. Report the exact files, states,
network calls, stores, tests, security/privacy impacts, decisions required and
items deliberately not being changed. Wait for my approval before implementation.
```

After Claude reports the audit, compare its claims with this handover and the actual command output. Resolve any architecture question before approving edits.
