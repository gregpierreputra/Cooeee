import { expect, test, type Page } from '@playwright/test';

const CONFLICT_URL = 'http://127.0.0.1:4174/conflict';
const SAVED_ADDRESS = '10 OLD ROAD FERNY CREEK 3786';
const NEW_ADDRESS = '6 RIDGE ROAD KALORAMA 3766';

async function reachConflict(page: Page, suffix = '') {
  await page.goto(`${CONFLICT_URL}${suffix}`);
  await page.getByLabel('Address').fill('RIDGE');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('button', { name: NEW_ADDRESS }).click();
  await page.getByRole('button', { name: 'Save this place' }).click();
  await expect(page.getByRole('heading', { name: 'You already have a saved place.' }))
    .toBeVisible();
}

async function packs(page: Page) {
  return page.evaluate(() => window.__readPacks());
}

test('AC8 shows both unchanged addresses and equal unselected choices before network', async ({ page }) => {
  await reachConflict(page);
  await expect(page.getByTestId('saved-address')).toHaveText(SAVED_ADDRESS);
  await expect(page.getByTestId('new-address')).toHaveText(NEW_ADDRESS);
  await expect(page.locator('main').locator(
    'h1, [data-testid="saved-address"], [data-testid="new-address"], button',
  )).toHaveText([
    'You already have a saved place.',
    SAVED_ADDRESS,
    NEW_ADDRESS,
    'Keep the saved place',
    'Replace it with this one',
  ]);
  await expect(page.locator('main')).not.toContainText(
    /Updating|We have updated your place|Automatically replaced/i,
  );

  const keep = page.getByRole('button', { name: 'Keep the saved place' });
  const replace = page.getByRole('button', { name: 'Replace it with this one' });
  await expect(keep).not.toBeFocused();
  await expect(replace).not.toBeFocused();
  await expect(keep).toHaveCSS('background-color', await replace.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  ));
  expect(await keep.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width >= 24 && rect.height >= 24;
  })).toBe(true);
  expect(await replace.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width >= 24 && rect.height >= 24;
  })).toBe(true);
  expect(await page.evaluate(() => window.__areaCheckCount)).toBe(0);
});

test('AC8 keep leaves the original complete pack byte-identical', async ({ page }) => {
  await reachConflict(page);
  const before = await packs(page);
  await page.getByRole('button', { name: 'Keep the saved place' }).click();

  expect(await page.evaluate(() => window.__keptSavedPlace)).toBe(true);
  expect(await packs(page)).toEqual(before);
  expect(await page.evaluate(() => window.__areaCheckCount)).toBe(0);
});

test('AC8 leaving without a choice leaves the original complete pack byte-identical', async ({ page }) => {
  await reachConflict(page);
  const before = await packs(page);
  await page.goto('http://127.0.0.1:4174/');

  expect(await packs(page)).toEqual(before);
  expect(await page.evaluate(() => window.__areaCheckCount)).toBe(0);
});

test('AC8 replace explicitly starts the next stage while the original remains current', async ({ page }) => {
  await reachConflict(page);
  const before = await packs(page);
  await page.getByRole('button', { name: 'Replace it with this one' }).click();

  await expect(page.getByRole('heading')).toHaveText(
    'This address is inside a Designated Bushfire Prone Area.',
  );
  expect(await page.evaluate(() => window.__areaCheckCount)).toBe(1);
  expect(await packs(page)).toEqual(before);
});

test('AC8 store failure stops before network and states that nothing changed', async ({ page }) => {
  await page.goto(`${CONFLICT_URL}?mode=unavailable`);
  await page.getByLabel('Address').fill('RIDGE');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('button', { name: NEW_ADDRESS }).click();
  await page.getByRole('button', { name: 'Save this place' }).click();

  await expect(page.getByRole('heading')).toHaveText(
    'We could not check the saved place on this device.',
  );
  await expect(page.getByRole('status')).toContainText('Nothing has been changed.');
  expect(await page.evaluate(() => window.__areaCheckCount)).toBe(0);
});

test('AC8 stops rather than selecting a pack when the one-pack invariant is broken', async ({ page }) => {
  await page.goto(`${CONFLICT_URL}?mode=multiple`);
  await page.getByLabel('Address').fill('RIDGE');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('button', { name: NEW_ADDRESS }).click();
  await page.getByRole('button', { name: 'Save this place' }).click();

  await expect(page.getByRole('heading')).toHaveText(
    'More than one saved pack was found on this device.',
  );
  await expect(page.getByRole('status')).toContainText('Nothing has been changed.');
  expect(await page.evaluate(() => window.__areaCheckCount)).toBe(0);
});
