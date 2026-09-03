# Cooeee

Cooeee builds a pack of official bushfire information for one address while the phone has
signal. The pack then works with no connection at all. Cooeee gives no warnings, no live routes
and no eligibility decisions.

There are no maps. Every pack is text only.

## Setup

Use Node 24 through nvm. Install nvm first if you do not have it.

```bash
nvm install
npm install
```

The browser tests need Chromium. Install it once.

```bash
npx playwright install chromium
```

On a fresh Linux machine Chromium also needs system libraries. Playwright can install them for
you with its deps option.

## Commands

* `npm run dev` starts the Vite dev server.
* `npm run build` writes the production build to `dist`.
* `npm run preview` serves that build locally.
* `npm test` runs Vitest in watch mode.
* `npm run e2e` runs Playwright against a real production build.
* `npm run server` starts the Nearby places API server.
* `npm run verify` is the gate. It runs ESLint, the TypeScript check, Vitest with coverage,
  the banned terms scan and the snapshot age check.

`npm run verify` must pass before any work is called done.

The scripts under `scripts` rebuild the bundled data. One fetches the layer extent, one fetches
the CFA safer places list and one renders the source PDFs. They write to `public/data`.

The PDF script opens live third party pages in a headless browser, so run it on a machine that
holds no repository write token. Read each PDF it produces before committing it. The file ships
to users as a copy of an official page, and its fingerprint is recorded beside it so the app
refuses any other copy.

## Rules that are enforced

**Layer rule.** Decisions live in `src/core` and are pure. No DOM, no fetch, no React, no
Dexie. Time is always a parameter. I/O lives in `src/data`. Rendering lives in `src/ui`. ESLint
enforces this, so move the code rather than fighting it.

**Offline rule.** The BlackSky screen and the pack detail screen may not fetch anything. ESLint
bans the fetch global and the network module in those files.

**Atomicity rule.** A pack is written as building and flipped to complete in one transaction.
Never await anything other than Dexie inside a Dexie transaction. Cancel leaves the store
unchanged. Nothing is replaced silently.

**Wording rule.** Every user facing string lives in `src/core/copy.ts`. No inline text in
components. Mandated lines are exact. The banned terms scan fails the build on a hit.

**Dependency rule.** Do not add a dependency without saying what it replaces and why a few lines
of platform code could not do the job. No date library, no state manager, no form library, no UI
kit and no point in polygon library.

**Parallel developer rule.** Touch only the files your story needs. Add to copy, constants and
the Dexie schema by appending named keys. Never renumber or rewrite what is there. A schema
change is a new Dexie version, never an edit of an old one.

## Branch and pull request flow

`main` is protected. Every change reaches it through a reviewed pull request.

1. A `fix/<problem>` branch comes from `main` for one existing problem. Its pull request goes to
   `main`. Delete the branch after merge.
2. An `epic/<name>` branch comes from the latest verified `main`. It collects the accepted work
   for one epic.
3. A `feature/<criterion>` branch comes from its epic branch. Keep one acceptance criterion in
   each. Its pull request goes to the epic branch, not `main`.
4. When the whole epic passes review and testing, open one pull request from the epic branch
   into `main`.
5. If a fix merges into `main` while an epic is open, update the epic branch from `main` first.

Run `npm run verify`, `npm run build` and `npm run e2e` before asking for review. GitHub
Actions runs the same checks on every pull request and on pushes to `main` and epic branches.

## Layout

```
src/
  main.tsx   boot. sweeps unfinished packs, then registers the service worker
  app.tsx    routes, page mode and the update banner
  core/      pure logic. types, constants, copy, geo, pack, blacksky, nearby
  data/      Dexie database, network calls, snapshots and pack build
  ui/        screens and components
public/
  data/      bundled snapshots and source PDFs
  icons/     PWA icons
scripts/     snapshot builders, banned terms scan and snapshot age check
server/      Nearby places API server
tests/       Vitest unit and integration tests. core has a 90 percent coverage gate
e2e/         Playwright against the real production bundle
```

Screens are `/` for saved packs, `/packs/new` for the search and build flow, `/packs/<id>` for
one pack, `/nearby` for the nearest official places and `/blacksky` for the offline compass.

## Deploying

The web app is static output from `vite build`. No environment variables and no API keys.

On vercel.com import this repository with the Vite preset, root directory `.`, build command
`npm run build` and output directory `dist`.

`vercel.json` sends every path to `index.html` for the router and sets the security headers.
Production deploys from `main`. Every other branch gets a preview URL.

## The API server

`server` is a small Node 24 and SQLite service behind the Nearby screen. It uses the SQLite
module built into Node, so it has no dependencies. It ingests the CFA Neighbourhood Safer Places
layer, the five Community Fire Refuges, Vicmap postcode centroids and the live VicEmergency
feed. It serves them read only under `/api/v1`.

```bash
npm run server
```

It listens on localhost port 8787. The Vite dev server proxies `/api` to it. `PORT`, `HOST` and
`DB_PATH` override the defaults. The database file lives in `server/data` and is git ignored.

* The client syncs the static and dynamic snapshots into IndexedDB and answers every query on
  the device. Nothing the user types leaves the phone.
* Vercel cannot host the 60 second poller. The server runs on Railway, and the `/api` rewrite in
  `vercel.json` points at that origin. The hostname is one Railway allocates under its own domain.
  If the project ever lapses, that name could be claimed by someone else while the rewrite still
  points at it, so a custom domain the team owns at the registrar is the intended end state.
* A daily SQLite snapshot is kept in `server/data/backups` for seven days.

## Where this is up to

Merged to `main`

* **Epic 1.** Build a prepared local pack. Address search, confirmation, conflict handling, the
  official bushfire area check, the atomic text only save and provenance on every item.
* **Epic 2.** Official last resort places. The nearest Neighbourhood Safer Places and refuges are
  saved into the pack and shown on the Nearby screen from local data.
* **Epic 3.** BlackSky. The offline screen with a compass, bearing and distance to each saved
  place, honest degradation without GPS and hold to enter activation.
* **Polish.** Personal notes on packs, offline reading of stored source PDFs, a connection
  notice bar and the Nearby places server.

Iteration 1 has no maps. Later epics have no code yet.
