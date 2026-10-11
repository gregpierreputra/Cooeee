import { expect, test } from '@playwright/test';
import { HARNESS } from './helpers';

// The three games on the Rehearse screens, the drill first.
test.describe('the game cards on the Rehearse screen', () => {
  test('stand in order, each saying where it is today', async ({ page }) => {
    await page.goto(`${HARNESS}/games`);
    const cards = page.locator('.game-tile');
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(0)).toContainText('Play the drill');
    await expect(cards.nth(1)).toContainText('Cooee Word');
    await expect(cards.nth(1)).toContainText('No streak yet · 0 days played');
    await expect(cards.nth(1)).toContainText('Today’s word is ready.');
    await expect(cards.nth(2)).toContainText('Ready the Block');
    await expect(cards.nth(2)).toContainText('Not played yet today');
  });

  test('carry the streak and the days played', async ({ page }) => {
    await page.goto(`${HARNESS}/games?history=lost,won,won`);
    await expect(page.locator('.word-tile')).toContainText('2 day streak · 3 days played');
  });

  test('show the drill’s twist when one is on', async ({ page }) => {
    await page.goto(`${HARNESS}/games?twist=small-bag`);
    await expect(page.locator('.drill-tile')).toContainText('Two minutes to pack seven things and reach the front door.');
    await expect(page.locator('.drill-tile')).toContainText(/Small bag twist\. Changes (tomorrow|in \w+ days)\./);
  });

  test('open their games, and each is large enough to tap', async ({ page }) => {
    await page.goto(`${HARNESS}/games`);
    for (const card of await page.locator('.game-tile').all()) {
      const box = (await card.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole('button', { name: /Cooee Word/ }).click();
    await expect(page.locator('[data-harness]')).toContainText('/rehearse/word');
  });
});
