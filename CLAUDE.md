# Claude Code entry point

Read `docs/handover/claude-code-epic-1-handover.md` completely before planning or editing.

The private, local development controller is outside this repository at:

`../local-guidance/agentic-development/prompt-bank/feature-development.txt`

Follow its six phases for every change. Do not copy or commit `local-guidance/` into this public repository. The current Part A is historical and names E1-US1-AC1; update Part A locally for the newly approved task before running it.

Non-negotiable working rules:

- Start from a clean, current `main` and create a correctly scoped branch. Never push directly to `main`.
- Show the Phase 2 plan and wait for approval before editing implementation files.
- Keep decisions pure in `src/core/`, external I/O in `src/data/`, and rendering in `src/ui/`.
- Put every user-facing string in `src/core/copy.ts` and every threshold in `src/core/constants.ts`.
- Never expose a `building` pack, silently replace a complete pack, invent unavailable data, or describe absence as safety.
- Do not mutate Dexie schema version 1. Any schema change requires a new version and migration.
- Treat `e2e/harness/` data as test-only. Never move synthetic addresses or records into the production bundle.
- Do not call Epic 1 complete merely because automated tests pass. The current production flow and target architecture still have documented gaps.
- Before reporting Done, run `npm run verify`, `npm run build`, and `npm run e2e`; report actual output and any manual testing still deferred.

