# Iteration 1 mapless scope

Status: Approved product-scope decision

Date: 31 August 2026

Applies to: EPIC 1, E1-US1-AC9, E1-US2 pack contents and BlackSky

## Decision

Cooeee will not build, download, store or render a basemap in Iteration 1.
The prepared local pack is a text-and-structured-data pack. BlackSky remains a
mapless experience and does not depend on map tiles.

The earlier EPIC 1 wording that required PMTiles, separate text/tile sizes,
`Download both`, `Text only`, a basemap provenance row and a 5–20 MB tile
budget is superseded for Iteration 1.

## Iteration 1 outcome

The user can:

1. confirm one address;
2. review the official bushfire-area outcome;
3. see the exact prepared-pack size before saving;
4. explicitly save the pack;
5. close and reopen Cooeee and find the saved pack; and
6. read the stored content and its provenance with no network.

The save remains atomic: no partial pack becomes visible, and a failed or
interrupted replacement leaves the previous complete pack unchanged.

## Boundaries

- No PMTiles archive, tile-range request, tile payload, MapLibre view or map
  download is an Iteration 1 deliverable.
- No map control or blank-map placeholder is shown.
- Existing tile-compatible database fields and code may remain dormant to
  avoid an unrelated schema migration. They are not evidence of a map feature
  and must stay zero/false in the Iteration 1 flow.
- A future map feature requires a new approved epic/AC, dataset and licence
  review, privacy/network assessment, storage budget and acceptance evidence.

## Governance

This decision changes prospective product scope. Historical SHA-bound review
and test evidence remains historical and must not be rewritten as if the map
requirement never existed. Current requirements, LeanKit cards, evaluation
status and handover notes must link to or reproduce this decision.
