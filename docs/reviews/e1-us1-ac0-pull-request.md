# E1-US1-AC0: First-open disclosure and acknowledgement

Branch: `feature/e1-us1-ac0-landing-consent`, branched from `main`.

This acceptance criterion is new scope, added to the canonical register on
1 September 2026 to close a first-open disclosure gap the original EPIC 1
package never covered. There is no proposal or feasibility citation for it.

## Scope

- On first open, before any other screen, show the mark, the name, one line of
  purpose, the four disclosure statements in full, the VicEmergency and Triple
  Zero line, one unchecked acknowledgement checkbox and an inactive continue
  button.
- Bind the continue button's `disabled` attribute to the checkbox itself, so
  the inactive state is announced to assistive technology and not only styled.
- Record the acknowledgement on continue, in one browser storage flag, so the
  screen never appears again on this device.
- Treat an unreadable, absent or unexpected stored value as "not acknowledged":
  show the screen again rather than block the app.
- Clearing the browser's site data returns the app to first open and changes
  nothing about a saved pack.
- Make no network request and no call to `navigator.geolocation` on this
  screen.

## Files

| File | Change |
|---|---|
| `src/core/acknowledgement.ts` | New. Pure read, write and opening-screen decisions over an injected storage interface. |
| `src/data/acknowledgement.ts` | New. The one place `window.localStorage` is reached; returns `null` where site data is blocked. |
| `src/ui/FirstOpen.tsx` | New. The screen: mark, purpose, four statements, official-channels line, checkbox, continue. |
| `src/app.tsx` | Reads the opening screen synchronously before the router mounts; records the acknowledgement on continue. |
| `src/core/constants.ts` | Appended `ACKNOWLEDGEMENT_KEY`, `ACKNOWLEDGEMENT_VALUE`. |
| `src/core/copy.ts` | Appended the AC0 block: purpose, four statements and their headings, official-channels line, checkbox, continue. |
| `src/ui/theme.css` | Appended first-open layout, the 44 px checkbox row and the disabled primary action. |
| `tests/core/acknowledgement.test.ts` | New. 15 unit tests over the flag and the opening decision. |
| `tests/core/copy.test.ts` | Appended 8 exact-match tests over the disclosure wording. |
| `e2e/first-open.spec.ts` | New. 8 browser tests: TC-1.1.0-A to D, screen order, site-data clearing, zero off-origin requests and no position ask, and the single-marker flag. |
| `e2e/helpers.ts` | Added `acknowledgeFirstOpen()`. |
| `e2e/blacksky-offline.spec.ts`, `e2e/offline-cold-start.spec.ts`, `e2e/pack-save-flow.spec.ts` | Open as a returning device, so each spec still exercises the screen it is about. |

## Decisions

- **The flag is one browser storage entry, not a database row** (DATA-1). It is
  a fact about this browser profile, it must be readable before any store
  opens, and clearing site data is the documented way back to the screen. The
  rejected alternative was a Dexie table, which would have forced a schema
  version for a single boolean and tied a disclosure to pack data.
- **The key is versioned** (`cooeee.acknowledgement.v1`). A future change to
  what is being disclosed asks again rather than inheriting an old answer.
- **The value is a marker and nothing else.** No date, counter or identifier is
  written, so the flag cannot become a record of the person.
- **Only the exact marker counts as acknowledged.** An unexpected value, an
  absent value or a throwing store all read as "not acknowledged" and show the
  screen — the Done-when rule that storage which cannot be read must not block
  the app.
- **A refused write still lets the user through.** `writeAcknowledgement`
  reports whether the flag will survive, and the app moves on either way: a
  browser that cannot keep the flag is a reason to ask again next open, never a
  reason to trap someone on this screen.
- **The disabled state is the `disabled` attribute bound directly to the
  checkbox state**, with no intermediate flag and no core helper between them,
  which is what the Must-show item asks for. It is announced as disabled rather
  than merely styled (WCAG 4.1.2).
- **The gate renders before `BrowserRouter`.** No route, back bar or connection
  notice mounts behind it, so "before any other screen" holds literally, with
  no frame in which another screen paints.
- **The mark is the precached app icon** rendered with an empty `alt`, because
  the wordmark beside it already carries the name in text. Nothing on the
  screen is fetched at runtime.
- Wording follows Rule 0.1 and the honesty invariant. `Cooeee issues no
  warnings` is the allow-listed boundary claim; the statements state what the
  app does not do without ever implying that a place is all right.

## Constants

- `ACKNOWLEDGEMENT_KEY = 'cooeee.acknowledgement.v1'`
- `ACKNOWLEDGEMENT_VALUE = 'acknowledged'`

Neither is a threshold; both are named so no second call site can invent its
own key or marker.

## Security and privacy

- **Stored.** One `localStorage` entry holding the marker. No IndexedDB record
  type, field or schema version was added or changed. A browser test asserts
  that the whole of `localStorage` after continuing is exactly
  `{ 'cooeee.acknowledgement.v1': 'acknowledged' }`.
- **Leaves the device.** Nothing. A route interceptor covering the shell load
  and the interaction records zero requests off the app's own origin.
- **Queued.** No job is created or changed.
- **Permissions.** None requested. `navigator.geolocation.getCurrentPosition`
  and `watchPosition` are instrumented in the browser test and are never
  called on this screen. Notifications are never requested anywhere.
- **Integrity.** No external data is read, parsed or rendered on this screen.
- **Licence.** No third-party content is rendered, so no attribution is owed.
- **Wording.** The banned-terms scan is clean; the statements state absence of
  capability plainly and never as reassurance.

## Verification evidence

- `npm run verify`: `Test Files 19 passed (19)`, `Tests 361 passed (361)`,
  statements 100% (847/847), branches 100% (260/260), functions 97.7% (85/87),
  lines 100% (847/847), `banned-terms: clean`,
  `snapshot-age: 1 snapshot(s), oldest 1 days (limit 60)`.
- `npm run build`: passed. Production PWA bundle 122.87 kB gzip, 15 precache
  entries.
- `npx playwright test`: `100 passed (12.7s)`, including the 8 new first-open
  tests and the three real-app specs updated to open as a returning device.

## AC status

`E1-US1-AC0 — Implemented.` Every Then condition, Must-show item, Done-when
rule and test case (TC-1.1.0-A to D) is implemented and covered by an automated
test. The two accessibility checks are implemented as markup — a real
`disabled` attribute bound to the checkbox, and a `label` with `htmlFor`
associating the full statement with the box — and are asserted through their
accessible roles in the browser tests; the screen-reader read-aloud checks
themselves remain for the TEST owner on a device.

## Deferred

- No `// ponytail:` marker was added; nothing here was built to a known
  ceiling.
- Screen-reader evidence on a real device (the two accessibility checks) and
  the deployed-build phone capture with fresh site data remain for the TEST and
  DEV owners before mentor acceptance.
