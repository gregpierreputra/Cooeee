# Cooeee

Cooeee assembles a location-specific pack of official bushfire information while a phone has
signal, then keeps every part of it usable with the radios off. It issues no warnings, no live
routes and no eligibility decisions.

**Iteration 1 is mapless.** Address and official-context checks use the approved
services while connected; the completed structured-data pack then opens with
zero connectivity. No basemap or map-tile download is an Iteration 1 outcome.

---

## Setup

Node 20 LTS, via nvm (user-local, no sudo):

```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
exec $SHELL -l
nvm install        # reads .nvmrc
npm install
```

For the end-to-end suite, Chromium and its system libraries:

```bash
npx playwright install chromium
sudo npx playwright install-deps chromium     # needs a password; one time only
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Vitest in watch mode |
| `npm run e2e` | Playwright against a real production build |
| **`npm run verify`** | **The gate. ESLint → `tsc --noEmit` → Vitest with coverage → banned terms → snapshot age.** |

`npm run verify` must be green before anything is called Done (DoD Level 1, item 2). Attach its
output to the board card; a claim is not evidence.

---

## The rules that are mechanically enforced

**The layer rule.** Decisions live in `src/core/` and are pure — no DOM, no `fetch`, no React, no
Dexie, time always a parameter. I/O lives in `src/data/`. Rendering lives in `src/ui/`. An
`if`-statement about a number inside a component is in the wrong file. ESLint enforces it; move the
code rather than fighting it.

**The offline rule.** `ui/BlackSky.tsx` and `ui/Recovery.tsx` may import `src/core/*` and
`src/data/db.ts` only (Recovery may also import `src/data/probe.ts`). Never `wfs`, `tiles`,
`snapshots` or `fetch`. There are exactly four sanctioned Iteration 1 network-call categories in
the product; if you are adding a fifth, stop and raise it.

**The atomicity rule.** A pack is written `status: 'building'` and flipped to `'complete'` in one
single-row transaction. Never `await` a non-Dexie promise inside a Dexie transaction. Cancel leaves
the store byte-identical. Nothing is replaced silently: new beside old, verify, diff, swap on
acknowledgement.

**The wording rule.** Every user-facing string goes in `src/core/copy.ts`. No inline literals in
components. Mandated lines are exact, em dashes included. `scripts/banned-terms.mjs` scans every
string literal under `src/` and fails the build on a hit.

**The dependency rule.** Do not add one without saying what it replaces and why a few lines of
platform API could not do the job. Specifically not: a date library, a state manager, a form
library, a UI kit, `@turf/turf`, or a point-in-polygon library.

**The parallel-developer rule.** Other developers are on other stories on other branches. Touch only
the files your story needs. Add to `copy.ts`, `constants.ts` and the Dexie schema by **appending**
named keys — never renumber, reorder or rewrite what is there. A schema change is `db.version(2)`,
never an edit of version 1.

---

## Branch and pull-request flow

`main` is the protected production branch. Never push changes directly to it; every change reaches
it through a reviewed pull request (PR).

```text
main
├── fix/<problem>                 short-lived repair; PR → main; delete after merge
└── epic/<epic-name>              temporary integration branch for one epic
    ├── feature/<acceptance-criterion>   PR → epic branch
    └── feature/<acceptance-criterion>   PR → epic branch
```

- Create a `fix/*` branch from `main` only for one existing production or baseline problem. After
  testing and review, merge its PR into `main`, then delete the branch. A fix branch is not a
  permanent collection branch.
- Create an `epic/*` branch from the latest verified `main`. It temporarily collects the accepted
  work for that epic.
- Create each `feature/*` branch from its epic branch. Keep one acceptance criterion or similarly
  reviewable feature in each branch, and target its PR at the epic branch—not `main`.
- After every feature PR is accepted and the complete epic passes code-quality, security, UX,
  accessibility and acceptance testing, open one final PR from the epic branch into `main`.
- If a fix merges into `main` while an epic is active, update the epic branch from `main` before
  continuing feature integration.

Run `npm run verify`, `npm run build` and the applicable `npm run e2e` checks before requesting
review. GitHub and Vercel checks must also pass before merge.

---

## Layout

```
src/
  main.tsx        boot; sweepBuilding() before render; registerSW({ onNeedRefresh })
  app.tsx         routes; <html data-mode>; the update banner
  core/           PURE — types, constants, copy, banned-terms, geo, pack,
                  destination, blacksky, recovery, connectivity
  data/           db.ts (Dexie v1 + the three sanctioned functions)
  ui/             Home.tsx, theme.css, components/
public/
  ping.txt        "ok" — excluded from the precache on purpose
  icons/          maskable PWA icons
scripts/          banned-terms.mjs, snapshot-age.mjs
tests/core/       unit tests, ≥90% coverage gate over src/core
tests/data/       fake-indexeddb integration tests
e2e/              Playwright, against the real production bundle
```

This mirrors `prompt-bank/architecture/module-map-and-import-rules.txt`, which every story prompt
loads. Keep them in agreement.

## Deploying

Static output from `vite build`. No functions, no database, no environment variables — there are no
API keys, because there are no authenticated services.

At [vercel.com](https://vercel.com) → **Add New… → Project** → import this repository:

| Setting | Value |
|---|---|
| Framework preset | Vite |
| Root directory | `.` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Environment variables | none |

`vercel.json` already rewrites every path to `/index.html` for the SPA router; Vercel checks the
filesystem first, so `/ping.txt` and `/assets/*` still resolve as real files. Production deploys
from `main`; every other branch gets its own preview URL.

## Where this is up to

Milestones 1 and 2 of `documentation/Cooeee, Implementation Specification.md` §15: the scaffold and
the full pure core, with the boundary values the register names under test.

Not built yet, each belonging to a story with a named owner: the pack build pipeline (`pack-build.ts`),
the WFS client (`wfs.ts`), tiles, snapshots, the connectivity probe, every screen beyond Home, the
`scripts/build-*.ts` snapshot builders, and MapLibre.
