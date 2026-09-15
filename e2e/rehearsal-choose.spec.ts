import { expect, test } from '@playwright/test';
import { HARNESS } from './helpers';

// E5-US3-AC2. The bar's Rehearse: one pack needs no question, several are
// asked about with nothing chosen for the user, none reaches the gate's own
// "no pack" screen.
test.describe('AC2 which pack to rehearse', () => {
  test('several packs are offered, newest first, and a tap goes to that pack', async ({ page }) => {
    await page.goto(`${HARNESS}/rehearse-choose?packs=2`);
    await expect(page.getByRole('heading', { name: 'Which pack are we rehearsing?' })).toBeVisible();
    const rows = page.locator('.condition-list button');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('Kalorama');
    await expect(rows.nth(1)).toContainText('Ferny Creek');
    await expect(page.locator('[aria-pressed], [aria-selected], .main-action')).toHaveCount(0);
    await rows.nth(1).click();
    await expect(page.getByTestId('location')).toHaveText('/rehearse/saved-pack');
  });

  test('one pack goes straight to its gate', async ({ page }) => {
    await page.goto(`${HARNESS}/rehearse-choose?packs=1`);
    await expect(page.getByTestId('location')).toHaveText('/rehearse/saved-pack');
    await expect(page.getByRole('heading', { name: 'Which pack are we rehearsing?' })).toHaveCount(0);
  });

  test('no pack shows the gate\'s own words', async ({ page }) => {
    await page.goto(`${HARNESS}/rehearse-choose?packs=0`);
    await expect(page.getByRole('heading', { name: 'No pack is stored on this device' })).toBeVisible();
  });
});
