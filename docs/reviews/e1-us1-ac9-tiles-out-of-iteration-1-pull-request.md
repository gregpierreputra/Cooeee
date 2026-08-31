# E1-US1-AC9 — Pack size before any write, tiles out of Iteration 1

## Pull request

**Title:** `E1-US1-AC9: Narrow the pack offer to one size and one action`

**Source branch:** `feature/e1-us1-ac9-size-before-write`

## Scope

Authority: `docs/decisions/iteration-1-mapless-scope.md` (approved 31 August 2026) — Cooeee builds no basemap in Iteration 1, and the earlier AC9 wording requiring separate text/tile sizes, `Download both` and `Text only` is superseded. The criterion narrows to — the pack's size is shown before anything is written to the device, and a failed or interrupted save never leaves a partial pack presented as complete, with the previous store state intact.

- The Size screen offers one action. With no tiles there is one kind of pack, so a choice between two would be a decision the user does not have.
- The size line states one size.
- `PackOffer` loses `tileBytes`, `tileCount` and `tilesAvailable`; `createPackOffer` loses its tile-metadata parameter; `offerMatchesStoredSize` loses its `withTiles` flag and now requires the stored tile count to be zero.
- `Search.tsx` no longer passes a hardcoded tiles object.

## Baseline override recorded

AC9 as written mandates the two-size line, both download choices, and the text-only literals `Saved without map tiles` and `Maps were not downloaded. Everything else in this pack works offline.` Rule 0.1 makes mandated literals exact, so removing them is an override rather than a tidy-up, authorised by the team decision. `TC-1.1.9-A` narrows to one size, `TC-1.1.9-C` is deleted with the choice it tested, and `TC-1.1.9-B` — the interruption case — is unchanged and remains the centre of the criterion.

## Schema decision: no Dexie version bump

The stored pack record keeps `sizeBytes: { text, tiles }`, `manifest.groups.tiles` and `builtWithTiles`, and the `tiles` table stays. Tiles were removed from the offer, the screens and the copy only.

This matches the decision record's own boundary: existing tile-compatible fields may remain dormant to avoid an unrelated migration, provided they stay zero/false in the Iteration 1 flow. That is enforced rather than assumed: `stageTextOnlyPack` writes `builtWithTiles: false` and `sizeBytes.tiles: 0` unconditionally, and `offerMatchesStoredSize` refuses to finalise any staged pack whose stored tile count is not zero — with a unit test for that rejection.

The deciding argument: a `db.version(2)` upgrade rewrites every complete pack row at startup, which is mutating the user's current pack outside an explicit choice — the one thing R6 and Rule 0.2 exist to prevent. The upside would have been cosmetic. Two supporting reasons: the stored values are already the honest description of a pack with no tiles (`tiles.count: 0` is the lifecycle contract's explicit no-tiles marker, not a placeholder), and the `tiles` table remains the sweep net that `sweepBuilding` and `discardBuildingPack` use to clear orphaned rows by `packId`.

## Deliberate deferral

Four places now hold a value that is constant for Iteration 1. Each carries a `ponytail:` marker naming the ceiling and the upgrade path, which is the basemap capability:

| place | ceiling | upgrade path |
|---|---|---|
| `types.ts` `Pack.builtWithTiles`, `Pack.sizeBytes.tiles` | always `false` / `0` | the basemap capability populates them; no migration needed |
| `types.ts` `PackManifest.groups.tiles` | always `{ count: 0, bytes: 0 }` | filled from the range reader |
| `provenance.ts` `packDetailItems` basemap branch | unreachable — nothing can build a pack with tiles | the rendering the basemap capability will need |

These are deferred, not dead: they are the shape the stored record already has, kept so that restoring tiles is a feature change rather than a second migration.

## What is unchanged, and is now the whole criterion

- The size is stated before any write. Asserted: nothing has run and the store holds zero packs, layers, destinations and tiles while the offer is on screen.
- Staging writes one hidden `building` pack; verification happens outside the transaction; a single-row atomic status flip is what makes it complete.
- An interrupted save discards the building pack immediately and leaves the previous complete pack byte-identical — asserted by comparing the full stored pack rows before and after, then retrying successfully.
- The stored size equals the stated size.

## Tests

**Deleted, not weakened** — `AC9 makes unavailable maps explicit while keeping text-only available`; `rejects invalid tile metadata` (both cases); the `tileBytes`/`tileCount`/`tilesAvailable` offer assertions; the split-size-line assertion; the two `withTiles: true` cases; the `Saved without map tiles` and `Maps were not downloaded…` assertions in the size, provenance and save-flow specs.

**Added** — `AC9 offers exactly one action`: the actions region holds one button, it is `Save this pack`, the screen mentions no tile or map wording, and nothing has run. Plus `states the pack size as one figure`, `requires the stored text bytes to be exactly the stated size` at value−1/value/value+1, and `rejects a stored pack claiming tile bytes nothing can produce`.

## Verification recorded

- `npm run verify`: clean — eslint, `tsc --noEmit`, 298/298 tests,
  100% core coverage, wording scan and snapshot age.
- `npm run build`: clean — 68 modules transformed; production PWA generated.
- `npm run e2e`: clean — 66/66 passed.

## Not included

- No Dexie version bump, per the decision above.
- No visual polish, and no rewording beyond removing the tile lines.
- No other acceptance criterion. The `Text only` button taps in the AC1, AC8 and US2 specs were retargeted to the single action because the button they named no longer exists; those specs' own assertions are untouched.
