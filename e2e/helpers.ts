import { expect, type Page } from '@playwright/test';
import { ACKNOWLEDGEMENT_KEY, ACKNOWLEDGEMENT_VALUE, GATE_KEY, GATE_VALUE, HOLD_MS } from '../src/core/constants';

/** The isolated component harness (e2e/harness), served on its own port. */
export const HARNESS = 'http://127.0.0.1:4174';

/** The one official endpoint the app may call; specs intercept it here. */
export const WFS_PATTERN = 'https://opendata.maps.vic.gov.au/geoserver/wfs**';
export const WMS_PATTERN = 'https://opendata.maps.vic.gov.au/geoserver/wms**';

/** A Vicmap address feature shaped exactly as the register returns it. */
export function addressFeature(
  address: string,
  locality: string,
  lon: number,
  lat: number,
  isPrimary: 'Y' | 'N' = 'Y',
) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: {
      ezi_address: address,
      locality_name: locality,
      property_status: 'A',
      is_primary: isPrimary,
    },
  };
}

/** Hand service-worker control to the page before going offline.
 *  A registration exposes `active` while its worker may still be activating;
 *  `ready` resolves only when an active worker can control the origin. Then,
 *  because registerType 'prompt' does not claim clients, one more load hands
 *  control over. */
export async function waitForController(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
}

/** Everything the browser reports as stored — for zero-write assertions. */
export async function storageState(page: Page) {
  return page.evaluate(async () => ({
    indexedDbNames: (await indexedDB.databases()).map(({ name }) => name),
    localStorageLength: localStorage.length,
    sessionStorageLength: sessionStorage.length,
  }));
}

/** Per-table record counts plus web storage — for exact-write assertions.
 *  Harness pages only: window.__storageCounts is installed by e2e/harness. */
export async function deviceStorage(page: Page) {
  return page.evaluate(async () => ({
    recordCounts: await window.__storageCounts(),
    localStorageLength: localStorage.length,
    sessionStorageLength: sessionStorage.length,
  }));
}

/** Per-table record counts. Harness pages only. */
export async function storageCounts(page: Page) {
  return page.evaluate(() => window.__storageCounts());
}

/** Raw pack rows. Harness pages only. */
export async function readPacks(page: Page) {
  return page.evaluate(() => window.__readPacks());
}

/** E2-US2: the places step of the wizard. Ticks as many places as the area
 *  lets the user save (two, or fewer when fewer are located) and moves on. */
export async function chooseLastResortPlaces(page: Page) {
  const boxes = page.getByRole('checkbox');
  await expect(boxes.first()).toBeVisible(); // the list has been read from the snapshot
  const count = Math.min(2, await boxes.count());
  for (let i = 0; i < count; i += 1) await boxes.nth(i).check();
  await page.getByRole('button', { name: 'Save last-resort places' }).click();
  // The note step follows the places: keep the pre-filled example. Then the
  // programs step: carry none for now.
  await page.getByRole('button', { name: 'Keep this note' }).click();
  await page.getByRole('button', { name: 'Not now, choose in Recover later' }).click();
}

/** Seeds browser flags before any script on the page runs, so they are there
 *  when the app reads them on the first paint. */
async function seedFlags(page: Page, flags: [key: string, value: string][]) {
  await page.addInitScript((entries) => {
    try {
      for (const [key, value] of entries) localStorage.setItem(key, value);
    } catch {
      // A blocked storage shows the gate or disclosure screen; the spec will say so.
    }
  }, flags);
}

/** Feature 1. The development gate stands in front of the disclosure. */
export async function passGate(page: Page) {
  await seedFlags(page, [[GATE_KEY, GATE_VALUE]]);
}

/** E1-US1-AC0. The first-open disclosure stands in front of every screen, so a
 *  spec about anything else opens with the gate passed and the acknowledgement
 *  already recorded — exactly as a returning device would. */
export async function acknowledgeFirstOpen(page: Page) {
  await seedFlags(page, [
    [GATE_KEY, GATE_VALUE],
    [ACKNOWLEDGEMENT_KEY, ACKNOWLEDGEMENT_VALUE],
  ]);
}

/** E5-US1-AC5. A rehearsal as a reader takes it: the choice of condition, both
 *  steps of the walk, then the result. This is the one place the journey to a
 *  finished rehearsal is written down, so the next change to the flow is made
 *  here and in no spec. Harness pages only.
 *
 *  Pass `url` to open the choice first. Leave it out when the choice is already
 *  on screen, after a reload or after leaving a run. The walk's own behaviour is
 *  proven in rehearsal-walk.spec.ts; this only walks it. */
export async function rehearseToResult(page: Page, condition: string, url?: string) {
  if (url) await page.goto(url);
  await expect(page.getByRole('heading', { name: 'What are we rehearsing without?' })).toBeVisible();
  await page.getByRole('button', { name: new RegExp(condition) }).click();
  await expect(page.locator('.rehearsal-bar')).toBeVisible();

  const main = page.getByRole('main');
  await expect(main.getByText('Step 1 of 2', { exact: true })).toBeVisible();
  // The real control's two-second hold, held from the keyboard past two seconds.
  await main.getByRole('button', { name: /Hold for BlackSky/ }).focus();
  await page.keyboard.down('Enter');
  await page.waitForTimeout(HOLD_MS + 500);
  await page.keyboard.up('Enter');

  await expect(main.getByText('Step 2 of 2', { exact: true })).toBeVisible();
  await main.getByRole('button', { name: 'See what it found' }).click();
  await expect(
    main.getByRole('heading', {
      level: 2,
      name: /^(What this rehearsal found|Nothing was missing in this rehearsal)$/,
    }),
  ).toBeVisible();
}
