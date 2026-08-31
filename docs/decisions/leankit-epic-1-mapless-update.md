# LeanKit update — EPIC 1 mapless Iteration 1

Use this text to update the shared LeanKit cards. LeanKit remains the team
board record; this file provides the reviewed wording and audit trail.

## EPIC 1 — description

As a resident of a bushfire-prone area preparing before the season, I want to
save the place I live and have Cooeee build a versioned offline pack containing
official bushfire context and recovery references, with publisher and saved
date on every item, so the information is already on my phone before the
network fails.

## EPIC 1 — scope

The user searches and confirms one address, reviews the official bushfire-area
outcome, sees the exact structured-pack size, and explicitly saves one complete
pack to the device. The pack is readable offline and is replaced only after a
new verified pack commits atomically.

Iteration 1 is intentionally mapless. It does not build, download, store or
render basemap tiles. BlackSky is also mapless. Existing tile-compatible code
or database fields may remain dormant at zero/false and are not an Iteration 1
deliverable. A future map capability requires a new approved epic/AC.

## E1-US1-AC9 — title

The pack's size is shown before it is saved

## E1-US1-AC9 — acceptance criterion

Given a confirmed place and the local manifest builder's result, when the
prepared pack is offered for saving, then its exact structured-data size is
shown before any pack write starts, saving requires an explicit user action,
and a failed or interrupted save never presents a partial pack as complete or
changes the previous complete pack.

## E1-US1-AC9 — on screen

- `Ready to save`
- `Pack size <size>`
- `Save pack`
- On interruption: `The save stopped before it finished.`
- `Nothing has been changed. Your previous pack is untouched.`
- `Try again`
- After completion: `Place saved`, the confirmed address and `Open saved pack`

Never show `Download both`, `Text only`, `Map tiles`, `Show map`, a blank map,
or any map-absence explanation in Iteration 1.

## E1-US1-AC9 — done when

- The exact size appears before any pack row is written.
- The completed pack's recorded size matches the displayed size.
- Saving never starts automatically.
- An interrupted save exposes no partial pack and leaves the previous complete
  pack unchanged.
- The completed pack opens with its structured content and no map surface.

## E1-US2-AC1 — pack contents clarification

Every structured information item actually included in the Iteration 1 pack
must show its publisher and saved date. Remove PMTiles basemap from the list of
required Iteration 1 items.

## Decision comment for the cards

Approved 31 August 2026: Cooeee will not build a map in Iteration 1. The earlier
PMTiles, 5–20 MB tile budget, `Download both`, `Text only` and basemap
provenance requirements are superseded. This is a deliberate scope correction,
not an unresolved dependency. Historical PR/test evidence is preserved with a
dated addendum. Repository decision record:
`docs/decisions/iteration-1-mapless-scope.md`.
