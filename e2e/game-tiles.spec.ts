import { expect, test } from '@playwright/test';
import { HARNESS } from './helpers';

// The games on the Rehearse screens, the drill first. Cooee Word is kept in
// the code but has no card.
test.describe('the game cards on the Rehearse screen', () => {
  test('stand in order, each saying where it is today', async ({ page }) => {
    await page.goto(`${HARNESS}/games`);
    const cards = page.locator('.game-tile');
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toContainText('Pack a bag with your kids');
    // A family activity, not one to beat: no top score on its card.
    await expect(cards.nth(0).locator('.game-tile-stat')).toHaveCount(0);
    await expect(cards.nth(1)).toContainText('Spot the fire risks');
    await expect(cards.nth(1)).toContainText('Practise finding fire risks round a home, then check your own.');
    // A check for adults, not a game: no score or daily pill on its card.
    await expect(cards.nth(1).locator('.game-tile-stat, .game-tile-pill')).toHaveCount(0);
    // The drill is for doing with children, the check is about your own home.
    await expect(page.locator('.game-tiles > .section-label')).toHaveText(['With your kids', 'Around your home']);
    await expect(page.getByText('Cooee Word')).toHaveCount(0);
  });

  test('show the drill’s twist when one is on', async ({ page }) => {
    await page.goto(`${HARNESS}/games?twist=small-bag`);
    await expect(page.locator('.drill-tile')).toContainText('For families. Two minutes to pack seven things together and reach the front door.');
    await expect(page.locator('.drill-tile .game-tile-tag')).toHaveText('Challenge Small bag');
    await expect(page.locator('.drill-tile .game-tile-tag-detail')).toHaveText(/Changes (tomorrow|in \w+ days)/);
  });

  test('open their games, and each is large enough to tap', async ({ page }) => {
    await page.goto(`${HARNESS}/games`);
    for (const card of await page.locator('.game-tile').all()) {
      const box = (await card.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole('button', { name: /Spot the fire risks/ }).click();
    await expect(page.locator('[data-harness]')).toContainText('/rehearse/block');
  });
});
