import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { AREA_MAP_IS_NOT_FIRE_REACH } from '../src/core/copy';
import { chooseLastResortPlaces, deviceStorage, HARNESS, openSources } from './helpers';

const AREA_URL = `${HARNESS}/area`;
const ADDRESS = '6 RIDGE ROAD KALORAMA 3766';

async function reachAreaCheck(page: Page, mode: string, context?: BrowserContext) {
  await page.goto(`${AREA_URL}?mode=${mode}`);
  await page.getByLabel('Street address').fill('RIDGE');
  await page.getByLabel('Street address').press('Enter');
  await page.getByRole('button', { name: ADDRESS }).click();
  if (context) await context.setOffline(true);
  await page.getByRole('button', { name: 'Save this place' }).click();
}

test('AC5 shows designation, publisher/date and instruction priority in order', async ({ page }) => {
  await reachAreaCheck(page, 'present');
  const state = page.getByRole('status');
  await expect(state.locator('h1')).toHaveText(
    'This address is inside a Bushfire Prone Area.',
  );
  // Inside, only the words that say so are in amber, beside the amber flame.
  await expect(state.locator('.key-term')).toHaveText(['inside a Bushfire Prone Area']);
  await openSources(page);
  await expect(state.locator('.source-rows dd')).toHaveText([
    'Department of Transport and Planning',
    '28 August 2026',
  ]);
  await expect(state.locator('p').nth(0)).toHaveText(
    'Follow Country Fire Authority and emergency service instructions first.',
  );
  await expect(state).not.toContainText(/safe|protected|low risk|no risk|high risk|danger level/i);
});

test('AC6 shows the published-but-nothing-mapped state exactly', async ({ page }) => {
  await reachAreaCheck(page, 'none');
  const state = page.getByRole('status');
  await expect(state.locator('h1')).toHaveText(
    'No Bushfire Prone Area is mapped here.',
  );
  await openSources(page);
  await expect(state.locator('p').nth(0)).toHaveText(AREA_MAP_IS_NOT_FIRE_REACH);
  // Outside, nothing is in amber: no coloured words and no flame.
  await expect(state.locator('.key-term, .tone-amber')).toHaveCount(0);
  await expect(state.locator('.source-rows')).toContainText('Department of Transport and Planning');
  await expect(state).not.toContainText(/not designated|none found|no results|all clear|safe|no risk|low risk/i);
});

test('AC6 shows the not-published state separately and reflows at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await reachAreaCheck(page, 'unpublished');
  await expect(page.getByRole('heading')).toHaveText(
    'No Bushfire Prone Area map is published here.',
  );
  await expect(page.getByRole('status')).toContainText('Fire can still reach you.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= 320)).toBe(true);
});

test('AC7 keeps the address in memory, writes nothing and retries without retyping', async ({ page }) => {
  await reachAreaCheck(page, 'retry');
  const state = page.getByRole('status');
  await expect(state.locator('h1')).toHaveText(
    'The bushfire area check is unavailable right now.',
  );
  await expect(state).toContainText(
    'Nothing saved. Your address is still here. Try again with a connection.',
  );
  await expect(page.getByTestId('pending-address')).toHaveText(ADDRESS);
  expect(await deviceStorage(page)).toEqual({
    recordCounts: {
      actionCompletions: 0,
      destinations: 0,
      drills: 0,
      dynamicSnapshot: 0,
      files: 0,
      layers: 0,
      notes: 0,
      packPrograms: 0,
      packs: 0,
      postcodes: 0,
      programs: 0,
      rehearsals: 0,
      snapshots: 0,
      staticFacilities: 0,
      syncMeta: 0,
      tiles: 0,
    },
    localStorageLength: 0,
    sessionStorageLength: 0,
  });

  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading')).toHaveText(
    'This address is inside a Bushfire Prone Area.',
  );
});

test('AC7 maps genuine browser offline mode to the same state', async ({ page, context }) => {
  await reachAreaCheck(page, 'offline', context);
  await expect(page.getByRole('heading')).toHaveText(
    'The bushfire area check is unavailable right now.',
  );
  await expect(page.getByTestId('pending-address')).toHaveText(ADDRESS);
  await context.setOffline(false);
});

test('AC9 an offer that could not be prepared offers Try again and Search again, and Search again writes nothing', async ({ page }) => {
  await page.goto(`${AREA_URL}?mode=present&offer=fail`);
  await page.getByLabel('Street address').fill('RIDGE');
  await page.getByLabel('Street address').press('Enter');
  await page.getByRole('button', { name: ADDRESS }).click();
  await page.getByRole('button', { name: 'Save this place' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await chooseLastResortPlaces(page);

  await expect(page.getByText('This pack could not be prepared right now.')).toBeVisible();
  const tryAgain = page.getByRole('button', { name: 'Try again' });
  const searchAgain = page.getByRole('button', { name: 'Search again' });
  await expect(tryAgain).toBeVisible();
  await expect(searchAgain).toBeVisible();

  // Try again re-attempts and fails again the same way — still no write.
  await tryAgain.click();
  await expect(page.getByText('This pack could not be prepared right now.')).toBeVisible();
  expect(await deviceStorage(page)).toMatchObject({
    recordCounts: { packs: 0, layers: 0, destinations: 0, tiles: 0 },
  });

  await searchAgain.click();
  await expect(page.getByRole('heading', { name: 'Your address', exact: true })).toBeVisible();
  await expect(page.getByLabel('Street address')).toBeVisible();
  expect(await deviceStorage(page)).toMatchObject({
    recordCounts: { packs: 0, layers: 0, destinations: 0, tiles: 0 },
  });
});