# Cooeee — technical overview

**Audience.** A TypeScript/JavaScript engineer new to this repository. This is the one
cross-epic document: what the product does, how the code is organised, and where every
implemented acceptance criterion lives — in code and in tests. Per-AC detail stays in the
existing single-purpose documents, which this file links rather than repeats.

**Status date.** 1 September 2026. Implemented and merged to `main`: **Epic 1** (E1-US1
AC1–AC9, E1-US2 AC1–AC5) and **Epic 3** (E3-US1 AC1–AC4, E3-US2 AC1–AC3, E3-US3 AC1–AC2).
Epics 2, 4, 5, 6 and 7 have no code.

---

## 1. What Cooeee is

Cooeee helps a person in bushfire-prone Victoria assemble an **offline pack** of official
information about one place *while they still have a connection*, and then read it — and
orient by it — when they have none. The product's central discipline is honesty: it never
invents data, never softens an absence into reassurance, and never claims more confidence
than its sources give it. That discipline is enforced by machinery (build gates, schema
shapes, exact-match tests), not by convention.

**Iteration 1 is mapless.** The decision of record is
[`docs/decisions/iteration-1-mapless-scope.md`](decisions/iteration-1-mapless-scope.md):
no basemap, no tile downloads. Every pack is text-only, and the stored tile fields
(`builtWithTiles: false`, `sizeBytes.tiles: 0`, manifest `tiles: { count: 0, bytes: 0 }`)
are kept as the honest description of a pack with no tiles, not removed — so no migration
is needed when the basemap capability lands.

---

## 2. Architecture

One React 19 + TypeScript + Vite progressive web app. Six runtime dependencies: `react`,
`react-dom`, `react-router`, `dexie` (IndexedDB), `@turf/bearing`, `@turf/distance`.

### 2.1 The three layers

| Layer | Path | Role | Rule |
|---|---|---|---|
| Core | `src/core/` | Pure decision logic and every user-facing string. | Imports nothing with an I/O surface — no React, no Dexie, no fetch. Enforced by ESLint (`eslint.config.js`, RULE 1). Unit-tested with a 90% coverage gate (currently 100%). |
| Data | `src/data/` | IndexedDB via Dexie (`db.ts`, `pack-build.ts`, `integrity.ts`) and the one network client (`wfs.ts`). | UI components may not touch raw Dexie tables — only the sanctioned complete-pack read functions. Enforced by ESLint (`NO_RAW_DB`). |
| UI | `src/ui/` | React components, one stylesheet (`theme.css`). | Contains no inline user-facing literals; everything renders from `core/copy.ts`. The offline surfaces (`BlackSky.tsx`, `PackDetail.tsx`) cannot import the network path or call `fetch` — ESLint RULE 2. |

### 2.2 Routes

Declared in `src/app.tsx`. The `<html data-mode>` attribute switches the theme:
`/blacksky` gets the dark low-power palette, everything else `prepare`.

| Route | Component | Purpose |
|---|---|---|
| `/` | `src/ui/Home.tsx` | Pack list with freshness label; hosts the hold-to-enter BlackSky control. |
| `/packs/new` | `src/ui/PackNew/Search.tsx` | The whole E1-US1 wizard: search → confirm → conflict → area check → size → save. `Search.tsx` orchestrates; each step screen is its own component in `src/ui/PackNew/`. |
| `/packs/:packId` | `src/ui/PackDetail.tsx` | E1-US2: the saved pack with provenance on every item. |
| `/blacksky` | `src/ui/BlackSky.tsx` | Epic 3 in its entirety. |

Shared UI: `src/ui/components/StateCard.tsx` (the one card treatment) and
`src/ui/components/StatusPage.tsx` (the one shell for transient status screens —
kicker + polite live-region card + optional actions).

### 2.3 Storage and atomicity

`src/data/db.ts` defines the Dexie v1 schema: `packs`, `layers`, `destinations`,
`programs`, `tiles`, `kv`. A pack's `status` field (`'building' | 'complete'`) **is** the
atomicity mechanism: `src/data/pack-build.ts` stages a hidden `building` pack, re-reads
and verifies every row against a SHA-256 manifest (`src/data/integrity.ts`), and only then
flips the status to `complete` — the single write that exposes the pack. All UI reads go
through complete-only functions (`listCompletePacks`, `getCompletePackContent`,
`listCompletePacksWithPlaces`); a `sweepBuilding` at startup removes any pack a crash left
half-built.

### 2.4 The build gates

`npm run verify` = ESLint + `tsc --noEmit` + Vitest with coverage + two custom gates:

- **`scripts/banned-terms.mjs`** walks every string literal under `src/` against the
  lists in `src/core/banned-terms.ts` and fails the build on wording the product forbids
  ("safe", "route", "recommended", "all clear", …). The unit test
  `tests/core/banned-terms.test.ts` runs the real scanner over fixtures.
- **`scripts/snapshot-age.mjs`** fails the build if the newest committed data snapshot in
  `public/data/` is older than `SNAPSHOT_MAX_AGE_DAYS`, so a stale snapshot cannot ship
  silently.

CI (`.github/workflows/ci.yml`) runs `verify`, the production build, and the full
Playwright suite.

### 2.5 Tests

- **Unit (Vitest, `tests/`)**: every `src/core` module, plus the Dexie transaction logic
  in `tests/data` against `fake-indexeddb`. Coverage gate: 90% on `src/core` (excluding
  the types-only `types.ts`); currently 100% of statements.
- **End-to-end (Playwright, `e2e/`)**: 68 tests. Most run against the component harness
  (`e2e/harness/`, a second Vite app on port 4174 that mounts real components with
  synthetic data); `pack-save-flow.spec.ts` and the two offline specs run against the real
  production build on port 4173 with only the official WFS endpoint intercepted. Shared
  helpers live in `e2e/helpers.ts`.

---

## 3. Epic 1 — Build a Prepared Local Pack

Two user stories. The full traceability pack with code excerpts and screenshots is
[`docs/evaluation/epic-1-evaluation-pack.md`](evaluation/epic-1-evaluation-pack.md); each
AC also has a PR write-up in [`docs/reviews/`](reviews/).

### 3.1 E1-US1 — Save My Place

The wizard at `/packs/new`. Nothing is written to the device before AC9's explicit save;
the query, candidates, confirmed place and area result live only in component memory.

| AC | Requirement (short) | Implementation | Proven by |
|---|---|---|---|
| AC1 | Show the returned address immutably; the editable place name is preserved exactly; the pending place stays in memory. | `src/ui/PackNew/Confirm.tsx` | `e2e/confirm-place.spec.ts` (6 tests, incl. WCAG contrast and 200% zoom) |
| AC2 | Live suggestions while typing (min 3 chars, 250 ms debounce); every de-duplicated candidate listed in service order, never auto-selected; stale responses cancelled two ways (abort + request id). | `src/core/address-search.ts` (`liveSearchState`, candidate resolution) driven by `src/ui/PackNew/Search.tsx`; list in `src/ui/PackNew/Candidates.tsx` | `e2e/address-search.spec.ts` (29 tests), `tests/core/address-search.test.ts` (38 tests) |
| AC3 | A successful-but-empty search says "No matching address found…" and keeps the typed query; never widened, never guessed. | same modules — the `no-match` state of `liveSearchState` | same specs |
| AC4 | A search that *could not run* is a distinct state from "nothing found"; retry only on an explicit tap. | same modules — the `unavailable` state | same specs |
| AC5 | Inside a Designated Bushfire Prone Area: state it, name the publisher (DTP) and saved date, lead with the official-instructions priority line. | `src/core/area-check.ts` (`resolveBushfireAreaStatus`, `areaCheckView`), fetch in `src/data/wfs.ts` (point query, attributes only, never polygon geometry) | `e2e/area-check.spec.ts`, `tests/core/area-check.test.ts`, `tests/data/wfs.test.ts` |
| AC6 | "None mapped here" and "not published for this area" are separate states — absence of data is never presented as absence of hazard. | same — zero point hits are resolved against a live layer-existence probe plus the versioned extent snapshot in `public/data/` | same |
| AC7 | A failed check is one state of its own; the address is retained in memory for explicit retry; zero device writes. | `AreaCheck.tsx` `unavailable` screen | `e2e/area-check.spec.ts` storage assertions |
| AC8 | If one complete pack already exists, show both addresses with equal-weight Keep/Replace; Keep or abandon leaves the stored pack byte-identical; more than one pack, or a failed store read, stops the flow. | conflict logic inline in `Search.tsx` (`handleConfirmedPlace`); screens in `src/ui/PackNew/Conflict.tsx` | `e2e/pack-conflict.spec.ts` (6 tests) |
| AC9 | The pack's exact size is shown before anything is written; one size, one `Save this pack` action (mapless); save stages hidden, verifies, and exposes atomically; an interruption leaves the previous pack untouched. | `src/core/pack-offer.ts` (exact `TextEncoder` byte count), `src/core/pack.ts` (`buildPackSeed`), `src/data/pack-build.ts` (stage → verify → flip) ; screen `src/ui/PackNew/Size.tsx` | `e2e/pack-size.spec.ts`, `e2e/pack-save-flow.spec.ts`, `tests/data/pack-build.test.ts` |

Architecture note for AC9: offers are generated **on-device** — there is no backend and no
manifest API. The decision of record is
[`docs/architecture/pack-manifest-topology.md`](architecture/pack-manifest-topology.md).

### 3.2 E1-US2 — Trust What I Saved

The pack detail at `/packs/:packId`.

| AC | Requirement (short) | Implementation | Proven by |
|---|---|---|---|
| AC1 | Every stored item shows `Published by <publisher> · Saved <date>` (full Australian month, no leading zero). | `src/core/provenance.ts` (`provenanceView`, `formatSavedDate`, `packDetailItems`), rendered by `src/ui/components/ProvenanceLine.tsx` | `e2e/pack-provenance.spec.ts`, `tests/core/provenance.test.ts` |
| AC2 | An item missing publisher or date is removed *before* sizing and storage, the omission is stated, and there is no keep-anyway. | `prepareProvenancedContent` in `provenance.ts`, called by `pack-build.ts`; omission notice on the saved screen in `Size.tsx` | `e2e/pack-provenance.spec.ts` omission test |
| AC3 | Identical content online and offline, zero requests. | complete-only Dexie reads; `PackDetail.tsx` cannot import the network path (ESLint RULE 2) | `e2e/pack-provenance.spec.ts` offline test |
| AC4 | Age computed on-device from `Source.retrievedAt`; day 30 inclusive, day 31 → `Not recently verified`; a future clock clamps to `Saved today`. | `savedAgeDays` (clamped at 0) and the `stale` flag in `provenance.ts`; the pack-level label in `src/core/pack.ts` (`freshness`) | `tests/core/provenance.test.ts`, `tests/core/pack.test.ts`, `e2e/pack-provenance.spec.ts` day-31 test |
| AC5 | Opening an original source is always intercepted with an explanation (never guessed from `navigator.onLine`); the pack stays open; leaving takes a second explicit action. | `decideOriginalSourceAccess` in `provenance.ts`; the dialog in `PackDetail.tsx`; `isAllowedSourceUrl` allow-lists HTTPS official domains from `core/constants.ts` | `e2e/pack-provenance.spec.ts` AC5 test |

---

## 4. Epic 3 — BlackSky: Reach Prepared Information Offline

The single screen at `/blacksky`, designed for the moment the radios are off. All
decisions live in `src/core/blacksky.ts`; the component `src/ui/BlackSky.tsx` renders
them and is banned from importing any network path.

### 4.1 The state ladder

`deriveState` in `core/blacksky.ts` resolves exactly one screen state, in strict
precedence order — each state can only be reached when every state above it does not
apply:

```
NO_PACK  →  ACQUIRING  →  LOW_ACCURACY  →  OUT_OF_AREA  →  IN_AREA
```

Accuracy is checked **before** area membership, so a weak fix can never place the user
confidently inside or outside anything. Boundary values are pinned in
`tests/core/blacksky.test.ts` (staleness at 29/30/31 s, accuracy at 99/100/101 m,
containment inclusive at the radius).

### 4.2 Per-AC map

| AC | Requirement (short) | Implementation | Proven by |
|---|---|---|---|
| E3-US1-AC1 | Show both saved places with arrow glyph, distance and compass point — `sorted by distance, not a safety ranking` — plus the pack reminder and the fix's `± N m`. Never a route, ETA or arrival promise. | `IN_AREA` state; bearing/distance in `src/core/geo.ts` (`bearingDeg`, `distanceM`, `arrowGlyph`, `cardinalAbbr` — one haversine feeds ordering and display); figures composed by `copy.BEARING_FIGURE`/`distanceLabel` | `tests/core/blacksky.test.ts`, `tests/core/geo.test.ts`, `tests/core/copy.test.ts` |
| E3-US1-AC2 | Without a GPS fix, degrade to the saved reference text — "No GPS fix — showing your saved information." — never a stale arrow. | `ACQUIRING` state (`no-fix` / `stale` / `denied`) | `tests/core/blacksky.test.ts` precedence and staleness suites |
| E3-US1-AC3 | Accuracy is always shown; a fix worse than `ACCURACY_MAX_M` (100 m) or older than `FIX_STALE_MS` (30 s) withholds the arrow with its own error figure. | `LOW_ACCURACY` state; constants in `src/core/constants.ts` | accuracy-boundary tests |
| E3-US1-AC4 | "I'm standing at my saved place" marks a position; every readout says **ESTIMATE** with uncertainty stated as growing; past the confidence threshold the estimate is withdrawn. | `estimateFix` in `blacksky.ts` (`MARK_START_ACCURACY_M` 25 m + `MARK_DRIFT_M_PER_S` 1.4 m/s of assumed walking drift — time-only, a deliberate `ponytail:` simplification pending the dead-reckoning spike) | `estimateFix` suite, `copy.test.ts` ESTIMATE wording |
| E3-US2-AC1 | Outside every prepared area: say so, list each pack with the distance to its area's *edge* (never a bearing), and show the built-in general guidance (000, VicEmergency 1800 226 226, ABC radio). | `OUT_OF_AREA` state; guidance strings pinned character-for-character in `copy.ts` | `blacksky.test.ts` OUT_OF_AREA suite, emergency-number exact-match tests |
| E3-US2-AC2 | No pack stored: state it plainly, show built-in preparation guidance readable on a fresh offline install, link to `/packs/new`. | `NO_PACK` state | `e2e/blacksky-offline.spec.ts` — cold start with radios genuinely off, zero failed requests |
| E3-US2-AC3 | BlackSky never says "safe": every place is described as `Official place of last resort · <publisher>` and nothing more. | `copy.PLACE_DESCRIPTOR`; the banned-terms gate makes the forbidden wordings a build failure everywhere under `src/` | `copy.test.ts`, `scripts/banned-terms.mjs` in `npm run verify` |
| E3-US3-AC1 | Entry is deliberate: a 2-second hold on Home (`HOLD_MS`), a stray tap earns only the hint; one plainly named `Leave BlackSky` exit. | hold control in `src/ui/Home.tsx`; exit in `BlackSky.tsx` | `e2e/blacksky-offline.spec.ts` hold test |
| E3-US3-AC2 | One screen, few decisions, little battery: geolocation updates land in a ref and the screen re-renders once per `TICK_MS` (5 s); dark palette, no animation. | the tick loop in `BlackSky.tsx`; `data-mode="blacksky"` theme in `theme.css` | code review + the offline spec |

---

## 5. Numbering schemes

Three numbering schemes coexist across the project's documents and history. They refer to
the same requirements:

| Requirements register | LeanKit board / this repo | Example meaning |
|---|---|---|
| `EPIC 1.0`, `US 1.1`, `AC 1.1.1` | `EPIC 1`, `E1-US1`, `E1-US1-AC1` | Save a place from one confirmed address |
| `AC 1.1.4` | `E1-US1-AC9` | The pack's size is shown before anything is saved (added to the board via `docs/decisions/leankit-epic-1-mapless-update.md`; there is no AC9 card) |
| `US 3.1`, `AC 3.1.1` | `E3-US1`, `E3-US1-AC1` | Show prepared direction |

Branch and commit names use the lowercase form (`feature/e1-us1-ac9-mapless`). This
document and the repo's docs use the board form (`E1-US1-AC9`).

---

## 6. Epics not yet implemented

| Epic | Title | Status |
|---|---|---|
| 2 | Record Official Last-Resort References | No code. Packs store `destinations: []` honestly rather than fabricating places; the `Destination` schema type (including the `absence` row kind and the no-ranking rule) is already defined in `src/core/types.ts` because stored packs and BlackSky read that shape. |
| 4 | Find Support That May Match | No code. The `RecoveryProgram` schema type exists for the same reason. |
| 5 | Rehearse And Fix Gaps | No code. |
| 6 | Manage Multiple Packs | No code — Epic 1 deliberately enforces the one-pack invariant (E1-US1-AC8). |
| 7 | Reach The Channel, Keep A Record | No code. |

Earlier iterations carried typed placeholder modules for Epics 2 and 4
(`core/destination.ts`, `core/recovery.ts`, `core/connectivity.ts`). They had no
production callers and were removed in the September 2026 cleanup (§7); they remain in
git history if those epics start.

---

## 7. The September 2026 code-reduction refactor

Commit `refactor: remove dead code and consolidate duplication` on
`polish/code-cleanup`: **42 files, +303 / −1,105 lines**, with zero behaviour change to
any implemented AC — all 247 unit tests and 68 Playwright tests pass, and `src/core`
coverage stayed at 100%.

**Deleted** (dead code — nothing imported it in production):

- The Epic 2/4 placeholder modules and their tests (`recovery.ts`, `destination.ts`,
  `connectivity.ts`).
- Copy constants rendered nowhere (wording reserved for unbuilt epics), the 16-point
  cardinal *names* (only the abbreviations render), and the unused geo helpers
  `cardinal`, `withinRadius`, `bboxAround`.
- Constants for absent features: tile zoom/size caps, compass heading/declination,
  connectivity-probe timing.
- Configuration pointing at files that do not exist: an ESLint block for
  `src/ui/Recovery.tsx`, Workbox ignores for MapLibre chunks, the `/recover` route mode
  and its entire theme palette, and four dead CSS selectors.
- The stale generated snapshot `public/data/layer-extent.v2026-08-28.json` (the index
  references only the 08-31 version, and `scripts/build-extent.mjs` regenerates it).

**Consolidated** (same behaviour, one home instead of several):

- `src/ui/components/StatusPage.tsx` now renders the nine copy-pasted
  kicker + status-card + actions screens across `Search.tsx`, `AreaCheck.tsx` and
  `Size.tsx`, so the `role="status"` / `aria-live="polite"` announcement markup cannot
  drift between screens.
- Two 14-line single-caller modules were inlined where they were used:
  `makePendingPlace` into `Confirm.tsx`, `decidePackConflict` into `Search.tsx` (its six
  behaviour tests live on in `e2e/pack-conflict.spec.ts`).
- `src/core/pack.ts` lost three aliases: `layerStatus` (a verbatim wrapper around
  `area-check.ts`), `textBytes` (a duplicate of `pack-offer.ts`'s `exactTextBytes`), and
  `ageDays` (now shared with `provenance.ts`'s clamped `savedAgeDays`, which also gives
  the pack-level freshness label the same future-clock behaviour AC4 requires of items).
- `e2e/helpers.ts` holds the one copy of `waitForController` (previously three verbatim
  copies), the storage inspectors, the `addressFeature` fixture builder and the harness
  URL.
- `scripts/snapshot-age.mjs` reads its limit from `constants.ts` with a regex instead of
  transpiling TypeScript at runtime.

**Deliberately kept**, and why:

- TypeScript everywhere, strict. The discriminated-union screen states are how several
  ACs are made unrepresentable rather than merely tested.
- `src/data/wfs.ts`'s hand-written validators — input validation at the trust boundary.
- `@turf/bearing` / `@turf/distance` — proven geodesy over 15 saved lines.
- The tile fields in the schema (`builtWithTiles`, `sizeBytes.tiles`, manifest `tiles`)
  and the basemap branch of `packDetailItems` — stored data shapes; removing them would
  rewrite users' packs for no benefit.
- The banned-terms lists in `src/core/banned-terms.ts` — the unit tests import them as
  typed TS; moving them to a script-side data file would trade transpile machinery for
  type-declaration machinery.
- `Search.tsx` as one orchestrator rather than five files — it is real sequencing logic,
  and splitting it would scatter the flow the wizard exists to keep in one place.
