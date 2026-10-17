import { expect, test, type Page } from '@playwright/test';
import * as copy from '../src/core/copy';
import { acknowledgeFirstOpen, addressFeature, mockOfficialServices } from './helpers';

// Against the real bundle, as this is about the browser's own history. Back
// goes up to the screen above, never to whichever tab was open before, and it
// hides on the tabs' own screens.

const back = (page: Page) => page.getByRole('button', { name: copy.BACK, exact: true });
const tab = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name, exact: true });

test.beforeEach(async ({ page }) => {
  await acknowledgeFirstOpen(page);
  await page.goto('/');
});

test('no Back on any tab screen', async ({ page }) => {
  await expect(back(page)).toHaveCount(0);
  for (const name of ['Nearby', 'Rehearse', 'Recover', 'Home']) {
    await tab(page, name).click();
    await expect(page.locator('main').first(), name).toBeVisible();
    await expect(back(page), name).toHaveCount(0);
  }
});

test('Back from a need goes to the list of needs, even with another tab behind it', async ({ page }) => {
  await tab(page, 'Recover').click();
  await page.getByRole('button', { name: copy.NEED_PHRASE.money }).click();
  await tab(page, 'Nearby').click();
  // The phone's back button returns to the need, with Nearby behind it.
  await page.goBack();
  await expect(page).toHaveURL(/\/recover\?need=money$/);

  await back(page).click();
  await expect(page).toHaveURL(/\/recover$/);
  await expect(page.getByRole('heading', { name: copy.RECOVER_QUESTION })).toBeVisible();
  await expect(back(page)).toHaveCount(0);
});

test('Back from building a pack goes Home, even with another tab behind it', async ({ page }) => {
  await page.getByRole('link', { name: copy.BUILD_A_PACK }).first().click();
  await tab(page, 'Nearby').click();
  await page.goBack();
  await expect(page).toHaveURL(/\/packs\/new$/);

  await back(page).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(back(page)).toHaveCount(0);
});

test('Back from building a pack goes to the empty Rehearse tab that opened it', async ({ page }) => {
  await tab(page, 'Rehearse').click();
  await page.getByRole('main').getByRole('link', { name: copy.BUILD_A_PACK }).click();
  await back(page).click();
  await expect(page).toHaveURL(/\/rehearse$/);
  await expect(back(page)).toHaveCount(0);
});

test('a step into the builder keeps the tab it came from for Back', async ({ page }) => {
  await mockOfficialServices(page, {
    candidates: [addressFeature('1 RIDGE ROAD KALORAMA', 'KALORAMA', 145.36594, -37.817939)],
    lgaName: 'YARRA RANGES',
    bpaHits: [],
  });
  await tab(page, 'Rehearse').click();
  await page.getByRole('main').getByRole('link', { name: copy.BUILD_A_PACK }).click();
  await page.getByLabel('Street address').fill('RIDGE');
  await page.getByLabel('Street address').press('Enter');
  await page.getByRole('button', { name: '1 RIDGE ROAD KALORAMA' }).click();
  await expect(page).toHaveURL(/from=rehearse&step=/);

  await back(page).click();
  await expect(page).toHaveURL(/\/packs\/new\?from=rehearse$/);
  await back(page).click();
  await expect(page).toHaveURL(/\/rehearse$/);
});

test('Back from an address the app does not know goes Home', async ({ page }) => {
  await page.goto('/packs/no-such-pack');
  await back(page).click();
  await expect(page).toHaveURL(/\/$/);
});

test('Back on a pack\'s rehearsal goes up to Rehearse, which always lists the packs', async ({ page }) => {
  await page.goto('/rehearse/no-such-pack');
  await back(page).click();
  await expect(page).toHaveURL(/\/rehearse$/);
});

// Back returns a screen to where it was left, from the bar or the phone, and a
// new screen still opens at its top.
test('Back from a roadmap link returns to the roadmap where it was left', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await tab(page, 'Recover').click();
  await page.locator('.roadmap-button').click();
  const link = page.locator('a.roadmap-link[href^="/recover"]').nth(2);
  await link.scrollIntoViewIfNeeded();
  const left = await page.evaluate(() => window.scrollY);
  expect(left).toBeGreaterThan(0);

  await link.click();
  await expect(page).toHaveURL(/from=roadmap/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await back(page).click();
  await expect(page).toHaveURL(/\/recover\?need=roadmap$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(left);

  await link.click();
  await page.goBack();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(left);
});

test('Back from Spot the fire risks returns Rehearse to where it was left', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 });
  await tab(page, 'Rehearse').click();
  const tile = page.getByRole('button', { name: new RegExp(copy.BLOCK_TILE_TITLE) });
  await tile.scrollIntoViewIfNeeded();
  const left = await page.evaluate(() => window.scrollY);
  expect(left).toBeGreaterThan(0);
  await tile.click();
  await expect(page).toHaveURL(/\/rehearse\/block$/);
  await back(page).click();
  await expect(page).toHaveURL(/\/rehearse$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(left);
});
