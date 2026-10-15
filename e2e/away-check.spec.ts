import { expect, test, type Page } from '@playwright/test';
import { CLOSE, AWAY_CHECK_TITLE } from '../src/core/copy';
import { LAST_VISIT_KEY } from '../src/core/constants';
import { acknowledgeFirstOpen } from './helpers';

/** A person who last opened the app `days` ago. */
async function lastVisited(page: Page, days: number) {
  await acknowledgeFirstOpen(page);
  await page.addInitScript(
    ([key, day]) => {
      // Only before the first load: the app writes today once it opens.
      if (!sessionStorage.getItem('seeded')) {
        sessionStorage.setItem('seeded', '1');
        localStorage.setItem(key, String(day));
      }
    },
    [LAST_VISIT_KEY, Math.floor(Date.now() / 86_400_000) - days] as const,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
}

test('back after a week, Home asks about a way out over the BlackSky compass, which still takes the hold', async ({ page }) => {
  await lastVisited(page, 8);
  const check = page.getByRole('dialog', { name: AWAY_CHECK_TITLE });
  await expect(check).toBeVisible();
  // Nothing is greyed or blocked: the compass under its ring is what a finger reaches.
  const compass = page.locator('.nav-blacksky');
  const box = (await compass.boundingBox())!;
  const reached = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x, y)?.closest('.nav-blacksky') !== null,
    [box.x + box.width / 2, box.y + box.height / 2],
  );
  expect(reached).toBe(true);
  await check.getByRole('button', { name: CLOSE }).click();
  await expect(check).toBeHidden();
  // Today is now recorded, so a reload does not ask again.
  await page.reload();
  await expect(page.locator('main')).toBeVisible();
  await expect(check).toHaveCount(0);
});

test('back within the week, Home asks nothing', async ({ page }) => {
  await lastVisited(page, 6);
  await expect(page.locator('main')).toBeVisible();
  await expect(page.getByRole('dialog', { name: AWAY_CHECK_TITLE })).toHaveCount(0);
});
