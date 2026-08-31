# Pack manifest generation topology

Status: Decision of record, revised by the approved mapless-scope decision

Original date: 29 August 2026

Revision date: 31 August 2026
Applies to: E1-US1-AC9 and the EPIC 1 pack-build pipeline

## Decision

Cooeee generates each address-specific pack offer on the user's device. There
is no Cooeee application server, manifest API, account service or remote user
database. The `build response` named by AC9 is the output of a versioned local
manifest builder, not a response from a newly invented backend.

Iteration 1 is mapless. Its pack contains text and structured official content
only. See `docs/decisions/iteration-1-mapless-scope.md`.

## Iteration 1 production flow

1. The address search sends the typed query to the official Vicmap Address WFS.
2. After confirmation and any saved-pack conflict decision, official context
   checks send the confirmed coordinates to approved Vicmap WFS layers.
3. Versioned same-origin snapshots may provide approved public reference
   content. Later-epic content enters through typed boundaries only and is not
   fabricated by EPIC 1.
4. The local manifest builder canonically encodes the complete proposed pack
   content and reports its exact byte length.
5. The app shows that exact size before any pack row or child row is written.
6. After the user explicitly chooses to save, the app stages and verifies the
   content under a hidden `building` pack.
7. Successful verification finalises the new pack atomically. For replacement,
   the same transaction exposes the new pack and removes the superseded pack.
8. Failure or cancellation removes staged rows immediately. Startup cleanup is
   crash defence, not the normal cleanup mechanism.

## Size and integrity contract

- Offer version: `1`.
- Pack bytes: exact `TextEncoder` length of canonical proposed pack content.
- Stored `sizeBytes.text` must match the accepted offer.
- Iteration 1 compatibility fields remain `sizeBytes.tiles = 0`, tile count
  `0`, and `builtWithTiles = false`.
- Stored counts and hashes must match the verified staged records.
- A mismatch, truncation or unexpected payload cannot become visible through
  the complete-pack read API.

## Privacy and outbound values

- Typed address query: official Vicmap Address WFS for user-requested search.
- Confirmed coordinates: approved official context checks only.
- Same-origin static snapshots: public identical files with no user data.
- No tile metadata or payload request is made in Iteration 1.
- Nothing else leaves the device.

## Deferred compatibility

Tile-compatible schema and code may remain dormant so this documentation
decision does not force a destructive IndexedDB migration. PMTiles, MapLibre,
tile hosting and tile attribution are not outstanding EPIC 1 gaps. Any future
map capability requires a separately approved requirement and architecture
decision.
