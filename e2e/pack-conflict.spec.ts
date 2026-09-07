import { expect, test, type Page } from '@playwright/test';
import {
  KEEP_SAVED_PACK,
  NOTHING_CHANGED,
  PLACE_ALREADY_SAVED,
  REPLACE_SAVED_PACK,
  SAVED_PLACE_CHECK_FAILED,
} from '../src/core/copy';
import { HARNESS, readPacks as packs } from './helpers';

const CONFLICT_URL = `${HARNESS}/conflict`;
// The harness saves a pack at the one candidate address: confirming that same
// address is what reaches the keep-or-replace step. Any other address goes
// straight to the area check (pack-save-flow.spec.ts).
const ADDRESS = '6 RIDGE ROAD KALORAMA 3766';

async function reachConflict(page: Page, suffix = '') {
  await page.goto(`${CONFLICT_URL}${suffix}`);
  await page.getByLabel('Address').fill('RIDGE');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('button', { name: ADDRESS }).click();
  await page.getByRole('button', { name: 'Save this place' }).click();
  await expect(page.getByRole('heading', { name: PLACE_ALREADY_SAVED })).toBeVisible();
}

test('AC8 shows the saved address and equal unselected choices before network', async ({ page }) => {
  await reachConflict(page);
  await expect(page.getByTestId('saved-address')).toHaveText(ADDRESS);
  await expect(page.locator('main').locator(
    'h1, [data-testid="saved-address"], button',
  )).toHaveText([PLACE_ALREADY_SAVED, ADDRESS, KEEP_SAVED_PACK, REPLACE_SAVED_PACK]);
  await expect(page.locator('main')).not.toContainText(
    /Updating|We have updated your place|Automatically replaced/i,
  );

  const keep = page.getByRole('button', { name: KEEP_SAVED_PACK });
  const replace = page.getByRole('button', { name: REPLACE_SAVED_PACK });
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
  await page.getByRole('button', { name: KEEP_SAVED_PACK }).click();

  expect(await page.evaluate(() => window.__keptSavedPlace)).toBe(true);
  expect(await packs(page)).toEqual(before);
  expect(await page.evaluate(() => window.__areaCheckCount)).toBe(0);
});

test('AC8 leaving without a choice leaves the original complete pack byte-identical', async ({ page }) => {
  await reachConflict(page);
  const before = await packs(page);
  await page.goto(`${HARNESS}/`);

  expect(await packs(page)).toEqual(before);
  expect(await page.evaluate(() => window.__areaCheckCount)).toBe(0);
});

test('AC8 replace explicitly starts the next stage while the original remains current', async ({ page }) => {
  await reachConflict(page);
  const before = await packs(page);
  await page.getByRole('button', { name: REPLACE_SAVED_PACK }).click();

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
  await page.getByRole('button', { name: ADDRESS }).click();
  await page.getByRole('button', { name: 'Save this place' }).click();

  await expect(page.getByRole('heading')).toHaveText(SAVED_PLACE_CHECK_FAILED);
  await expect(page.getByRole('status')).toContainText(NOTHING_CHANGED);
  expect(await page.evaluate(() => window.__areaCheckCount)).toBe(0);
});
