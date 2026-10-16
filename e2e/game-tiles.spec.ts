import { expect, test } from '@playwright/test';
import { HARNESS } from './helpers';

// The games on the Rehearse screens, the drill first. Cooee Word is kept in
// the code but has no card.
test.describe('the game cards on the Rehearse screen', () => {
  test('stand in order, each saying where it is today', async ({ page }) => {
    await page.goto(`${HARNESS}/games`);
    const cards = page.locator('.game-tile');
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toContainText('Play the drill');
    await expect(cards.nth(1)).toContainText('Ready the Block');
    await expect(cards.nth(1)).toContainText('Not played today');
    await expect(page.getByText('Cooee Word')).toHaveCount(0);
  });

  test('show the drill’s twist when one is on', async ({ page }) => {
    await page.goto(`${HARNESS}/games?twist=small-bag`);
    await expect(page.locator('.drill-tile')).toContainText('Two minutes to pack seven things and reach the front door.');
    await expect(page.locator('.drill-tile .game-tile-tag')).toHaveText('Twist Small bag');
    await expect(page.locator('.drill-tile .game-tile-tag-detail')).toHaveText(/Changes (tomorrow|in \w+ days)/);
  });

  test('open their games, and each is large enough to tap', async ({ page }) => {
    await page.goto(`${HARNESS}/games`);
    for (const card of await page.locator('.game-tile').all()) {
      const box = (await card.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole('button', { name: /Ready the Block/ }).click();
    await expect(page.locator('[data-harness]')).toContainText('/rehearse/block');
  });
});
