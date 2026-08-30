# Cooeee Epic 1 Evaluation Pack

**Scope:** E1-US1 and E1-US2<br>
**Prepared for:** Senior Tutor Evaluation<br>
**Evidence date:** 30 August 2026<br>
**Reviewed code snapshot:** `45506cfc4dcda372526f84f31d92e9600d4795a9`<br>
**Repository:** [gregpierreputra/Cooeee](https://github.com/gregpierreputra/Cooeee)

## 1. Evaluation purpose

This pack summarises the Epic 1 implementation, connects each acceptance criterion to its code and tests, and records the remaining gaps honestly. It is intended to help the senior tutor evaluate:

- business-requirement traceability;
- architecture and implementation quality;
- privacy, security and data-integrity decisions;
- automated verification evidence;
- UX and accessibility behaviour; and
- readiness for controlled integration into the Epic branch and, later, `main`.

Epic 1 provides an end-to-end **prepared local pack foundation**. It does not claim that every production dataset is complete. Real destination, recovery and PMTiles assets owned by later epics are deliberately not fabricated.

## 2. Product outcome

A user can progress through this local-first flow:

```text
Search address
  -> review explicit search outcome
  -> confirm the selected place and editable name
  -> check the official bushfire-area result
  -> resolve any existing-pack conflict
  -> review exact text/tile size choices
  -> build, verify and atomically expose the pack
  -> open the completed pack
  -> inspect publisher, saved date and age while offline
```

The implementation keeps uncertainty visible. It distinguishes “nothing mapped at this address” from “the layer was not published”, separates failed checks from valid negative results, and never exposes a partially built pack as complete.

## 3. Scope boundaries

### Included

- One prepared local pack for one confirmed Victorian place.
- Explicit address-search, confirmation and bushfire-area states.
- Existing-pack conflict choice.
- Exact local pack offer and text-only build path.
- Atomic replacement and interruption cleanup.
- Complete-pack-only local reads.
- Item-level source provenance and offline source-link handling.
- Unit, data-integration and browser acceptance evidence.

### Deliberately excluded or deferred

- Live emergency warnings, routes or personalised safety advice.
- Multiple simultaneously active packs.
- Fabricated EPIC 2 destination data or EPIC 4 recovery-program data.
- A production PMTiles archive where the reviewed asset is not yet available.
- A genuine online refresh pipeline and refresh control.
- Final deployed-device, VoiceOver and airplane-mode evidence, which belongs to TEST/UAT sign-off.

## 4. Acceptance-criteria traceability

### E1-US1 — Create and maintain a prepared local pack

Status vocabulary in this pack has two values only:

- **Implemented:** the current aggregate Epic 1 code satisfies the criterion and has direct automated evidence.
- **Partial:** an implemented slice exists, but named production assets, integration or acceptance evidence is still missing.

| AC | Implemented outcome | Status | Main evidence |
|---|---|---|---|
| AC1 | Confirm the selected address, preserve the editable place name exactly, and continue without adding unrequested validation. | **Implemented** | [AC1 review](https://github.com/gregpierreputra/Cooeee/blob/feature/e1-us2-ac1-ac5-pack-provenance/docs/reviews/e1-us1-ac1-pull-request.md), `PlaceConfirmation` tests |
| AC2 | Present explicit address-search results and selectable candidates. | **Implemented** | [AC2–AC4 review](https://github.com/gregpierreputra/Cooeee/blob/feature/e1-us2-ac1-ac5-pack-provenance/docs/reviews/e1-us1-ac2-ac4-pull-request.md), address-search browser tests |
| AC3 | Present the defined no-match outcome without inventing a place. | **Implemented** | [AC2–AC4 review](https://github.com/gregpierreputra/Cooeee/blob/feature/e1-us2-ac1-ac5-pack-provenance/docs/reviews/e1-us1-ac2-ac4-pull-request.md) |
| AC4 | Present the defined offline/service-failure outcome and allow retry. | **Implemented** | [AC2–AC4 review](https://github.com/gregpierreputra/Cooeee/blob/feature/e1-us2-ac1-ac5-pack-provenance/docs/reviews/e1-us1-ac2-ac4-pull-request.md) |
| AC5 | Show the inside-designated-bushfire-prone-area outcome with source date and official-information priority. | **Implemented** | [AC5–AC7 review](https://github.com/gregpierreputra/Cooeee/blob/feature/e1-us2-ac1-ac5-pack-provenance/docs/reviews/e1-us1-ac5-ac7-pull-request.md), `area-check` tests |
| AC6 | Keep `none-mapped-here` and `not-published` as distinct domain states. | **Implemented** | [AC5–AC7 review](https://github.com/gregpierreputra/Cooeee/blob/feature/e1-us2-ac1-ac5-pack-provenance/docs/reviews/e1-us1-ac5-ac7-pull-request.md) |
| AC7 | Show a failed-check state while retaining the confirmed place for retry. | **Implemented** | [AC5–AC7 review](https://github.com/gregpierreputra/Cooeee/blob/feature/e1-us2-ac1-ac5-pack-provenance/docs/reviews/e1-us1-ac5-ac7-pull-request.md) |
| AC8 | Detect an existing pack and require an explicit keep-or-replace choice. | **Implemented** | [AC8 review](https://github.com/gregpierreputra/Cooeee/blob/feature/e1-us2-ac1-ac5-pack-provenance/docs/reviews/e1-us1-ac8-pull-request.md), replacement integration tests |
| AC9 | Calculate exact offer bytes, support the available build choice, stage invisibly, verify, clean up interruption and replace atomically. | **Partial** | [AC9 review](https://github.com/gregpierreputra/Cooeee/blob/feature/e1-us2-ac1-ac5-pack-provenance/docs/reviews/e1-us1-ac9-pull-request.md), [manifest topology](https://github.com/gregpierreputra/Cooeee/blob/feature/e1-us2-ac1-ac5-pack-provenance/docs/architecture/pack-manifest-topology.md) |

**AC1 status clarification:** its original feature PR was correctly Partial because it contained only place confirmation. In the current aggregate Epic 1 code, the later pack-build work completes the save-and-reopen path, so AC1 is now Implemented.

**Why AC9 remains Partial:** the controlled text-only implementation is present, but “Download both” cannot be accepted until a reviewed production PMTiles archive exists.

### E1-US2 — Understand what is in a saved pack

| AC | Implemented outcome | Status | Main evidence |
|---|---|---|---|
| AC1 | List available stored items with publisher and saved date through one shared provenance view. | **Partial** | [US2 review](https://github.com/gregpierreputra/Cooeee/blob/feature/e1-us2-ac1-ac5-pack-provenance/docs/reviews/e1-us2-ac1-ac5-pull-request.md), pack-detail tests |
| AC2 | Omit an item missing publisher or saved date before offer calculation and storage; explain the omission. | **Implemented** | Provenance unit tests, IndexedDB integration tests, browser inspection |
| AC3 | Render the same stored pack content online and offline with zero automatic requests. | **Partial** | Zero-request Playwright evidence; final later-epic content evidence is pending |
| AC4 | Calculate age on-device, treat day 30 as current and day 31 as not recently verified, and clamp future-clock values to today. | **Partial** | Boundary unit tests; genuine refresh pipeline is pending |
| AC5 | Always intercept the first original-source action, explain that the source is on the web, retain the open pack, and require a second explicit action before leaving Cooeee. | **Implemented** | Core decision test, zero-request browser test and accessible dialog behaviour |

## 5. Architecture and key decisions

The implementation follows a layered design:

| Layer | Responsibility | Examples |
|---|---|---|
| `src/core/` | Pure decisions, state models, copy and validation | area-state resolution, offer calculation, provenance age |
| `src/data/` | IndexedDB transactions, integrity checks and controlled persistence | hidden staging, complete-pack reads, manifests |
| `src/ui/` | Accessible rendering and user interaction | search outcomes, pack choices, pack detail |
| `tests/` and `e2e/` | Unit, integration and user-visible acceptance evidence | boundary tests, storage inspection, offline checks |

Key controls:

1. **Explicit uncertainty at the decision boundary.** A zero point hit is resolved using `published`, `unpublished` or `unknown`. Only the three verified outcomes may be persisted; a failed probe cannot become a confident negative result.
2. **Two-phase pack visibility.** A pack starts as `building` and becomes readable only after its stored contents match its offer and manifest.
3. **Atomic replacement.** The existing complete pack is retained until the new pack has passed verification; final exposure and old-pack removal occur in one transaction.
4. **Complete provenance before persistence.** Optional information with missing display provenance is removed before offer sizing and storage. Invalid source URLs or missing licences fail the build invariant.
5. **Network-blind pack detail.** Opening a pack reads complete local data only. Every first source action is intercepted without consulting `navigator.onLine`; leaving Cooeee requires a second explicit action.
6. **No silent overclaiming.** Unavailable later-epic datasets and tiles remain explicit gaps instead of being represented by synthetic production content.

## 6. Representative implementation code

These short excerpts show the core decisions. The linked source files remain the authoritative implementation.

### 6.1 Honest bushfire-area state

Source: [`src/core/area-check.ts`](https://github.com/gregpierreputra/Cooeee/blob/45506cfc4dcda372526f84f31d92e9600d4795a9/src/core/area-check.ts)

```ts
export function resolveBushfireAreaStatus(
  pointHits: number,
  publication: LayerPublicationStatus,
): LayerStatus {
  if (pointHits > 0) return 'present';
  if (publication === 'unknown') return 'unknown';
  return publication === 'published' ? 'none-mapped-here' : 'not-published';
}
```

This decision prevents the application from treating missing publication as a valid negative spatial result.

### 6.2 Exclude incomplete provenance before offer and storage

Source: [`src/core/provenance.ts`](https://github.com/gregpierreputra/Cooeee/blob/45506cfc4dcda372526f84f31d92e9600d4795a9/src/core/provenance.ts)

```ts
export function prepareProvenancedContent(content: TextPackContent) {
  const omittedItems: OmittedItem[] = [];
  const keep = <T extends { id: string; source: Source }>(row: T): boolean => {
    const missing = missingDisplayProvenance(row.source);
    if (!missing) return true;
    omittedItems.push({ id: row.id, missing });
    return false;
  };

  return {
    content: {
      ...content,
      layers: content.layers.filter(keep),
      destinations: content.destinations.filter(keep),
      recovery: content.recovery.filter(keep),
    },
    omittedItems,
  };
}
```

The same filtered content feeds size calculation, manifest generation and persistence, avoiding a mismatch between what was offered and what was saved.

### 6.3 Hidden staging and atomic exposure

Source: [`src/data/pack-build.ts`](https://github.com/gregpierreputra/Cooeee/blob/45506cfc4dcda372526f84f31d92e9600d4795a9/src/data/pack-build.ts)

```ts
const buildingPack: Pack = {
  ...content.pack,
  status: 'building',
  verifiedAt: 0,
  builtWithTiles: false,
  sizeBytes: { text: offer.textBytes, tiles: 0 },
  manifest: textOnlyManifest(offer),
};

await db.transaction('rw', db.packs, db.layers, db.destinations, async () => {
  if (await db.packs.get(buildingPack.id)) throw new Error('pack id already exists');
  await db.packs.add(buildingPack);
  await db.layers.bulkAdd(prepared.content.layers);
  await db.destinations.bulkAdd(prepared.content.destinations);
});
```

After the staged records are re-read and verified, the final transaction removes the superseded complete pack, where applicable, and changes the new pack to `complete`. A caught failure invokes `discardBuildingPack`; it does not remove a complete pack.

### 6.4 Explicit source interaction

Source: [`src/ui/PackDetail.tsx`](https://github.com/gregpierreputra/Cooeee/blob/45506cfc4dcda372526f84f31d92e9600d4795a9/src/ui/PackDetail.tsx)

```tsx
const interceptSource = (
  event: MouseEvent<HTMLAnchorElement>,
  item: PackDetailItem,
) => {
  event.preventDefault();
  setOfflineSource(decideOriginalSourceAccess(item).item);
};
```

The first action never navigates or sends a source request, including when a network interface exists but traffic is unavailable. A focused dialog displays local provenance and contains the second, explicit external link.

## 7. Privacy, security and integrity evaluation

| Question | Epic 1 answer |
|---|---|
| What is stored? | Confirmed pack identity, allowed source metadata, verified pack-owned layers/destinations, referenced recovery rows and manifest/size metadata. |
| What is not stored? | Rejected candidates, search history, device identifiers, user position, needs selection, unverified optional items or fabricated content. |
| What leaves the device? | Opening and reading a pack sends nothing. The first source action also sends nothing. Only the second, clearly labelled external link may initiate a request after explicit user choice. |
| What permissions are requested? | None. |
| How is partial data controlled? | `building` packs are hidden from complete-pack reads and removed on failure. |
| How is replacement controlled? | The user chooses explicitly; the existing complete pack survives until the new pack verifies. |
| How are sources controlled? | Retained items require publisher, saved date, non-empty licence and an HTTPS URL in the reviewed official-domain register. |
| How is integrity checked? | Canonical manifests, byte counts and stored rows are compared before finalisation; recovery content is withheld when its local snapshot does not match the pack manifest. |
| Are analytics or accounts used? | No backend, account, analytics service, API key or environment variable is introduced by Epic 1. |

## 8. Verification evidence

Evidence is tied to immutable code snapshots because every lower-stack merge can change the tested state.

| Snapshot | Gate | Result |
|---|---|---|
| `45506cfc4dcda372526f84f31d92e9600d4795a9` | `npm run verify` | **Passed** — 249/249 tests; 100% statements, branches, functions and lines across the gated `src/core/**` scope; wording scan clean; snapshot age 0 days |
| `45506cfc4dcda372526f84f31d92e9600d4795a9` | `npm run build` | **Passed** — production PWA generated; initial JavaScript 115.33 kB gzip, within the 150 kB budget |
| `45506cfc4dcda372526f84f31d92e9600d4795a9` | Focused E1-US2 Playwright | **Passed** — 6/6, including always-confirm source access |
| `1b279f376146d54bfe7454482b91945a23843904` | Full Playwright regression | **36/38 passed** — two service-worker controller timeouts on the pre-fix baseline |
| Current integrated Epic snapshot | Full Playwright regression | **Pending** — required after `main` and the feature stack are synchronised |

The red full-suite result has the same visual weight as the passing gates. PR #1 is now merged, but its change is not considered verified for Epic 1 until the Epic branch is synchronised and the complete suite is rerun.

### Reproduction commands

```bash
npm install
npm run verify
npm run build
npm run e2e
```

Use Node.js 20 as pinned in `.nvmrc` and npm 10.8.2. Reviewers should record the commit SHA, browser, operating system and actual output when reproducing the results.

## 9. Pull-request chain and controlled release

Current GitHub state checked on 30 August 2026:

| Order | PR | Head → target | Current state |
|---:|---|---|---|
| 0 | [#1 Service-worker control fix](https://github.com/gregpierreputra/Cooeee/pull/1) | `fix/service-worker-control` → `main` | Merged |
| 0 | [#2 Branch and PR workflow](https://github.com/gregpierreputra/Cooeee/pull/2) | `docs/branching-workflow` → `main` | Merged |
| 1 | [#3 E1-US1-AC1](https://github.com/gregpierreputra/Cooeee/pull/3) | AC1 feature → Epic 1 | Merged |
| 2 | [#4 E1-US1-AC2–AC4](https://github.com/gregpierreputra/Cooeee/pull/4) | AC2–AC4 feature → AC1 feature | Merged; Epic sync pending |
| 3 | [#5 E1-US1-AC5–AC7](https://github.com/gregpierreputra/Cooeee/pull/5) | AC5–AC7 feature → AC1 feature | Merged; Epic sync pending |
| 4 | [#6 E1-US1-AC8](https://github.com/gregpierreputra/Cooeee/pull/6) | AC8 feature → AC1 feature | Draft, mergeable |
| 5 | [#7 E1-US1-AC9](https://github.com/gregpierreputra/Cooeee/pull/7) | AC9 feature → AC8 feature | Draft |
| 6 | [#8 E1-US2-AC1–AC5](https://github.com/gregpierreputra/Cooeee/pull/8) | US2 feature → AC9 feature | Draft |

The feature PRs are intentionally stacked so each review shows only its own change. The next controlled sequence is:

1. Synchronise Epic 1 from the verified `main` baseline containing PRs #1 and #2.
2. Synchronise the updated AC1 branch into Epic 1 so the already-reviewed AC2–AC7 work reaches the integration branch.
3. Retarget PR #6 to Epic 1, rerun CI, review and merge AC8.
4. Retarget PR #7 to Epic 1, rerun CI, review and merge AC9.
5. Retarget PR #8 to Epic 1, rerun CI, review and merge US2 plus the accepted review fixes.
6. Record Code Quality, Security and UX/UAT findings in the relevant PR before each merge.
7. After complete integration and acceptance, open one final Epic 1 PR to `main` for Greg's approval.

No feature PR should bypass the Epic branch and merge directly into `main`.

## 10. Suggested senior-tutor evaluation walkthrough

1. **Traceability:** select any acceptance criterion in Section 4 and follow its review document, source link and automated evidence.
2. **Address outcomes:** inspect candidate, no-match and offline/service-failure behaviour; confirm that no synthetic place is shown.
3. **Place confirmation:** edit the place name, including empty or whitespace-only text, and verify that the exact value is preserved as required.
4. **Area outcomes:** exercise `present`, `none-mapped-here`, `not-published` and failed-check states; confirm their wording and retry boundaries remain distinct.
5. **Conflict choice:** create an existing complete pack and verify that keep/replace is explicit and that cancellation leaves it unchanged.
6. **Build interruption:** interrupt text-only staging and confirm no `building` pack appears as complete and the old pack survives.
7. **Atomic completion:** finalise a verified replacement and confirm that the new pack appears only after verification and the old owned rows are removed atomically.
8. **Provenance:** inspect publisher, Australian saved date, same-day text and the day-30/day-31 boundary.
9. **Offline behaviour:** open the completed pack offline and activate an original-source link; confirm no request is sent, the pack remains visible and the explanation repeats local provenance.
10. **Accessibility:** review semantic headings/lists, keyboard focus in the offline dialog, natural link semantics and 200% text behaviour.

## 11. Remaining evidence and delivery risks

| Gap or risk | Effect | Required owner/action |
|---|---|---|
| Service-worker controller timing | The last complete run was red on the pre-fix feature baseline | Synchronise merged PR #1 into Epic 1 and rerun the complete suite |
| Genuine destination and recovery contracts/content | US1/US2 cannot demonstrate every final production item type | Integrate reviewed EPIC 2 and EPIC 4 deliverables |
| Reviewed production PMTiles archive | “Download both” and final basemap provenance cannot be accepted | Data owner supplies and licenses the reviewed archive |
| Genuine refresh pipeline | US2 age messaging exists, but refresh action is not yet deliverable | Implement in its approved future story |
| Real-device evaluation | Automated evidence cannot replace VoiceOver, airplane-mode and target-device UAT | TEST/UAT owners execute and attach results |
| Stacked-branch drift | A lower-branch change can invalidate later evidence | CI now runs verify, build and full Playwright on every PR; retain SHA-bound evidence after each merge |

## 12. Initial review findings response

| Finding | Resolution | Evidence |
|---|---|---|
| H1 — `navigator.onLine` cannot prove reachability | **Fixed.** The first source action is now always intercepted. Local provenance is shown before a second explicit external link is offered. | `src/core/provenance.ts`, `src/ui/PackDetail.tsx`, focused Playwright 6/6 |
| H2 — boolean publication cannot express a failed check | **Fixed.** `LayerPublicationStatus` is `published | unpublished | unknown`; zero hits plus `unknown` resolve to `unknown`. Persisted records accept verified statuses only. | `src/core/types.ts`, `src/core/area-check.ts`, unit tests |
| H3 — exception cleanup does not cover killed sessions | **Already implemented; evidence added.** `sweepBuilding()` deletes building packs and owned rows before first render and is idempotently tested. | `src/data/db.ts`, `src/main.tsx`, `tests/data/db.test.ts` |
| M1 — coverage scope omitted | **Corrected.** Coverage is stated as 100% across gated `src/core/**`, excluding pure types as configured. | Section 8, `vitest.config.ts` |
| M2 — passing gate visually outweighed red regression | **Corrected.** Every gate now occupies one row, including the red and pending full regression. | Section 8 |
| M3 — AC1 Partial reason unrelated | **Corrected.** AC1 is Implemented in the aggregate code; the original isolated feature PR remains historically Partial. | Section 4 |
| M4 — evidence lacked immutable SHA | **Corrected.** Each result is tied to its tested commit snapshot. | Section 8 |
| M5 — no CI mitigation for stack drift | **Fixed in code.** GitHub Actions now runs verify/build and full Playwright on every PR; its result becomes effective when the workflow reaches the PR base. | `.github/workflows/ci.yml` |
| M6 — source decision lived in UI | **Fixed.** The always-explain decision is pure core logic and has a unit test; the UI renders that decision. | `src/core/provenance.ts`, `tests/core/provenance.test.ts` |
| L1 — environment range was too broad | **Corrected.** Reproduction specifies pinned Node 20 and npm 10.8.2. | Section 8 |
| L2 — inconsistent status vocabulary | **Corrected.** Only Implemented and Partial are used and defined. | Section 4 |
| L3 — fragile evidence links | **Corrected.** Evidence-index links use repository URLs; the complete code snapshot is copied into the appendix. | Section 13 |
| L4 — unexplained Pending sign-offs | **Corrected.** The table now distinguishes initial review, scheduled specialist review, asset dependency and final approval. | Section 14 |

## 13. Evidence index

- [Tier 1 and Tier 2 code evidence](https://github.com/gregpierreputra/Cooeee/blob/feature/e1-us2-ac1-ac5-pack-provenance/docs/evaluation/epic-1-code-evidence.md)
- [AC1 review](https://github.com/gregpierreputra/Cooeee/blob/feature/e1-us2-ac1-ac5-pack-provenance/docs/reviews/e1-us1-ac1-pull-request.md)
- [AC2–AC4 review](https://github.com/gregpierreputra/Cooeee/blob/feature/e1-us2-ac1-ac5-pack-provenance/docs/reviews/e1-us1-ac2-ac4-pull-request.md)
- [AC5–AC7 review](https://github.com/gregpierreputra/Cooeee/blob/feature/e1-us2-ac1-ac5-pack-provenance/docs/reviews/e1-us1-ac5-ac7-pull-request.md)
- [AC8 review](https://github.com/gregpierreputra/Cooeee/blob/feature/e1-us2-ac1-ac5-pack-provenance/docs/reviews/e1-us1-ac8-pull-request.md)
- [AC9 review](https://github.com/gregpierreputra/Cooeee/blob/feature/e1-us2-ac1-ac5-pack-provenance/docs/reviews/e1-us1-ac9-pull-request.md)
- [US2 AC1–AC5 review](https://github.com/gregpierreputra/Cooeee/blob/feature/e1-us2-ac1-ac5-pack-provenance/docs/reviews/e1-us2-ac1-ac5-pull-request.md)
- [Pack-manifest topology](https://github.com/gregpierreputra/Cooeee/blob/feature/e1-us2-ac1-ac5-pack-provenance/docs/architecture/pack-manifest-topology.md)
- [Project README](https://github.com/gregpierreputra/Cooeee/blob/main/README.md)

## 14. Evaluation sign-off

| Review area | Suggested reviewer | Outcome / evidence link |
|---|---|---|
| Product and AC traceability | Senior Tutor | Initial review received; findings response implemented; final evaluation pending |
| Code quality and architecture | Code Quality reviewer | Scheduled after Epic synchronisation |
| Security, privacy and integrity | Security reviewer | Scheduled after Epic synchronisation |
| UX, accessibility and UAT | UX/UAT reviewer | Scheduled after Epic synchronisation |
| Data provenance and licensing | Data owner | Final later-epic assets pending |
| Final Epic-to-main approval | Repository custodian (Greg) | Pending final Epic PR |

### Senior tutor conclusion

_To be completed after evidence review:_

- Decision: **Accept / Accept with conditions / Rework required**
- Conditions or findings:
- Evidence reviewed:
- Evaluator and date:
