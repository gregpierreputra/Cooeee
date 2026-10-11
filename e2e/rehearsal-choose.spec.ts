import { expect, test } from '@playwright/test';
import { HARNESS } from './helpers';

// E5-US3-AC2. The bar's Rehearse: one pack needs no question, several are
// asked about with nothing chosen for the user, none reaches the gate's own
// "no pack" screen.
test.describe('AC2 which pack to rehearse', () => {
  test('several packs are offered, newest first, and a tap goes to that pack', async ({ page }) => {
    await page.goto(`${HARNESS}/rehearse-choose?packs=2`);
    await expect(page.getByRole('heading', { name: /Your packs/ })).toBeVisible();
    const rows = page.locator('.pack-choice-list .pack-card');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('Kalorama');
    await expect(rows.nth(1)).toContainText('Ferny Creek');
    // Each row carries the pack's age in the home screen's own words.
    await expect(rows.nth(1)).toContainText(/Saved .* ago/);
    await expect(rows.nth(1)).toContainText('Not yet rehearsed');
    await expect(page.locator('[aria-pressed], [aria-selected], .main-action')).toHaveCount(0);
    await rows.nth(1).click();
    await expect(page.getByTestId('location')).toHaveText('/rehearse/saved-pack');
  });

  test('one pack is listed too, so Rehearse looks the same whatever is saved', async ({ page }) => {
    await page.goto(`${HARNESS}/rehearse-choose?packs=1`);
    await expect(page.getByRole('heading', { name: /Your packs/ })).toBeVisible();
    await expect(page.locator('.pack-choice-list .pack-card')).toHaveCount(1);
    await expect(page.getByRole('button', { name: /Play the drill/ })).toBeVisible();
  });

  test('the drill opens on its own page, like the other games', async ({ page }) => {
    await page.goto(`${HARNESS}/rehearse-choose?packs=2`);
    await page.getByRole('button', { name: /Play the drill/ }).click();
    await expect(page.getByTestId('location')).toHaveText('/rehearse/drill');
  });

  test('no pack shows the gate\'s own words', async ({ page }) => {
    await page.goto(`${HARNESS}/rehearse-choose?packs=0`);
    await expect(page.getByRole('heading', { name: 'No pack saved yet' })).toBeVisible();
  });
});
