# Pack manifest generation topology

Status: Decision of record  
Date: 29 August 2026  
Applies to: E1-US1-AC9 and the EPIC 1 pack-build pipeline

## Decision

Cooeee generates each address-specific pack offer on the user's device. There
is no Cooeee application server, manifest API, account service or remote user
database. The `build response` named by AC9 is the output of a versioned local
manifest builder, not a response from a newly invented backend.

## Production flow

1. The explicit address search sends the typed prefix to the official Vicmap
   Address WFS.
2. After confirmation and any saved-pack conflict decision, the official
   context checks send the confirmed coordinates to approved Vicmap WFS layers.
   Results remain in memory.
3. Versioned same-origin snapshots provide public reference content and extent
   metadata. Later-epic content enters through typed boundaries only; it is not
   fabricated by EPIC 1.
4. The local manifest builder canonically encodes the complete proposed text
   payload and reports its exact byte length.
5. If the map option is available, the app reads only the self-hosted PMTiles
   header and relevant directory metadata. It calculates the exact deduplicated
   tile byte total for the pack area. These metadata reads are not tile payload
   downloads.
6. The app displays the versioned offer with separate text and tile sizes.
   Neither download choice is selected. No pack row, child row, tile row or map
   asset is written before an explicit choice.
7. After `Text only`, the app stages and verifies the text payload with an
   explicit zero-tile manifest marker. It makes no tile payload request.
8. After `Download both`, the app requests only the previously enumerated tile
   payload ranges and stages them under the building pack.
9. A successful verification finalises a new pack atomically. For replacement,
   the same transaction makes the new pack current and removes the superseded
   pack and all of its owned rows. Until that transaction, the existing pack
   remains current and byte-identical.
10. Failure or cancellation aborts outstanding work and immediately deletes
    the building pack and all owned staged rows. Startup cleanup remains crash
    defence, not the normal cleanup mechanism.

## Hosting boundary

The Victoria PMTiles archive is a public, self-hosted build artifact on
Cloudflare R2 or Vercel Blob with HTTPS, CORS and byte-range support. Its URL is
a reviewed build-time constant. No production URL currently exists, so the map
download path remains unavailable rather than using an unreviewed or changing
third-party URL.

## Size and integrity contract

- Offer version: `1`.
- Text bytes: exact `TextEncoder` length of canonical proposed pack content.
- Tile bytes: exact sum of unique PMTiles payload entry lengths plus the fixed
  map-asset bytes declared by the reviewed archive metadata.
- Stored `sizeBytes` must exactly match the accepted offer.
- Stored counts and hashes must exactly match the verified staged records.
- A mismatch, truncation or unexpected payload is a failed build and cannot
  become visible through the complete-pack read API.

## Privacy and outbound values

- Typed address prefix: official Vicmap Address WFS, explicit search only.
- Confirmed coordinates: approved official context checks only.
- PMTiles metadata and payload ranges: public archive, only for the confirmed
  pack area; no address, name, identifier or analytics field is sent.
- Same-origin static snapshots: public identical files with no user data.
- Nothing else leaves the device.

## Current implementation boundary

AC9 may implement and verify the local offer contract, zero-write-before-choice
rule, hidden staging, cancellation cleanup, text-only zero-tile behavior and
atomic finalisation using supplied complete content. Production map download
remains deferred until the archive URL and measured archive metadata are
reviewed. EPIC 2 and EPIC 4 data remain typed inputs until their contracts are
implemented; empty or synthetic production content is forbidden.
