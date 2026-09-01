import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { deviceStorage, HARNESS } from './helpers';

const AREA_URL = `${HARNESS}/area`;
const ADDRESS = '6 RIDGE ROAD KALORAMA 3766';

async function reachAreaCheck(page: Page, mode: string, context?: BrowserContext) {
  await page.goto(`${AREA_URL}?mode=${mode}`);
  await page.getByLabel('Address').fill('RIDGE');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('button', { name: ADDRESS }).click();
  if (context) await context.setOffline(true);
  await page.getByRole('button', { name: 'Save this place' }).click();
}

test('AC5 shows designation, publisher/date and instruction priority in order', async ({ page }) => {
  await reachAreaCheck(page, 'present');
  const state = page.getByRole('status');
  await expect(state.locator('h1')).toHaveText(
    'This address is inside a Designated Bushfire Prone Area.',
  );
  await expect(state.locator('p').nth(0)).toHaveText(
    'Published by the Department of Transport and Planning, saved 28 August 2026.',
  );
  await expect(state.locator('p').nth(1)).toHaveText(
    'Follow Country Fire Authority and emergency service instructions first.',
  );
  await expect(state).not.toContainText(/safe|protected|low risk|no risk|high risk|danger level/i);
});

test('AC6 shows the published-but-nothing-mapped state exactly', async ({ page }) => {
  await reachAreaCheck(page, 'none');
  const state = page.getByRole('status');
  await expect(state.locator('h1')).toHaveText(
    'No Designated Bushfire Prone Area is mapped at this address in the current planning scheme.',
  );
  await expect(state).toContainText('Published by the Department of Transport and Planning, saved');
  await expect(state).not.toContainText(/not designated|none found|no results|all clear|safe|no risk|low risk/i);
});

test('AC6 shows the not-published state separately and reflows at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await reachAreaCheck(page, 'unpublished');
  await expect(page.getByRole('heading')).toHaveText(
    'The Designated Bushfire Prone Area is not published for this area — Department of Transport and Planning.',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= 320)).toBe(true);
});

test('AC7 keeps the address in memory, writes nothing and retries without retyping', async ({ page }) => {
  await reachAreaCheck(page, 'retry');
  const state = page.getByRole('status');
  await expect(state.locator('h1')).toHaveText(
    'We could not check the bushfire area for this address right now.',
  );
  await expect(state).toContainText(
    'Nothing has been saved. Your address is still here — try again when you have a connection.',
  );
  await expect(page.getByTestId('pending-address')).toHaveText(ADDRESS);
  expect(await deviceStorage(page)).toEqual({
    recordCounts: {
      actions: 0,
      destinations: 0,
      kv: 0,
      layers: 0,
      packs: 0,
      pending: 0,
      programs: 0,
      queue: 0,
      tiles: 0,
    },
    localStorageLength: 0,
    sessionStorageLength: 0,
  });

  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading')).toHaveText(
    'This address is inside a Designated Bushfire Prone Area.',
  );
});

test('AC7 maps genuine browser offline mode to the same state', async ({ page, context }) => {
  await reachAreaCheck(page, 'offline', context);
  await expect(page.getByRole('heading')).toHaveText(
    'We could not check the bushfire area for this address right now.',
  );
  await expect(page.getByTestId('pending-address')).toHaveText(ADDRESS);
  await context.setOffline(false);
});

test('AC9 an offer that could not be prepared offers Try again and Search again, and Search again writes nothing', async ({ page }) => {
  await page.goto(`${AREA_URL}?mode=present&offer=fail`);
  await page.getByLabel('Address').fill('RIDGE');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('button', { name: ADDRESS }).click();
  await page.getByRole('button', { name: 'Save this place' }).click();
  await page.getByRole('button', { name: 'See pack size' }).click();

  await expect(page.getByText('We could not prepare this pack right now.')).toBeVisible();
  const tryAgain = page.getByRole('button', { name: 'Try again' });
  const searchAgain = page.getByRole('button', { name: 'Search again' });
  await expect(tryAgain).toBeVisible();
  await expect(searchAgain).toBeVisible();

  // Try again re-attempts and fails again the same way — still no write.
  await tryAgain.click();
  await expect(page.getByText('We could not prepare this pack right now.')).toBeVisible();
  expect(await deviceStorage(page)).toMatchObject({
    recordCounts: { packs: 0, layers: 0, destinations: 0, tiles: 0 },
  });

  await searchAgain.click();
  await expect(page.getByRole('heading', { name: 'Search for your address' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Search', exact: true })).toBeVisible();
  expect(await deviceStorage(page)).toMatchObject({
    recordCounts: { packs: 0, layers: 0, destinations: 0, tiles: 0 },
  });
});