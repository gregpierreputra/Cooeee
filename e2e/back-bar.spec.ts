import { expect, test, type Page } from '@playwright/test';
import * as copy from '../src/core/copy';
import { acknowledgeFirstOpen } from './helpers';

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
  for (const name of ['Nearby', 'Rehearse', 'Recover', 'About', 'Home']) {
    await tab(page, name).click();
    await expect(page.locator('main').first(), name).toBeVisible();
    await expect(back(page), name).toHaveCount(0);
  }
});

test('Back from a need goes to the list of needs, even with another tab behind it', async ({ page }) => {
  await tab(page, 'Recover').click();
  await page.getByRole('button', { name: copy.NEED_PHRASE.money }).click();
  await tab(page, 'About').click();
  // The phone's back button returns to the need, with About behind it.
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

test('Back from an address the app does not know goes Home', async ({ page }) => {
  await page.goto('/packs/no-such-pack');
  await back(page).click();
  await expect(page).toHaveURL(/\/$/);
});

test('no Back on a rehearsal the Rehearse tab would open again', async ({ page }) => {
  // No pack saved: Rehearse shows this same screen's words, so Back would loop.
  await page.goto('/rehearse/no-such-pack');
  await expect(page.locator('main').first()).toBeVisible();
  await expect(back(page)).toHaveCount(0);
});
