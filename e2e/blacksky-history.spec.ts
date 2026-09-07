import { expect, test } from '@playwright/test';
import { BACK_PRESSED, BLACKSKY_RESUMED, HOLD_FOR_BLACKSKY, LEAVE_BLACKSKY } from '../src/core/copy';
import { acknowledgeFirstOpen } from './helpers';

// Against the real bundle: the harness runs a memory router, and this is about
// the browser's own history. A two-second hold is simulated by pressing and
// waiting for the URL, as in blacksky-offline.spec.ts.
async function hold(page: import('@playwright/test').Page, name: string, url: string) {
  const button = page.getByRole('button', { name });
  const box = (await button.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(page).toHaveURL(url, { timeout: 5_000 });
  await page.mouse.up();
}

test('the back button and a fresh visit both keep BlackSky until the hold', async ({ page }) => {
  await acknowledgeFirstOpen(page);
  await page.goto('/');
  await hold(page, HOLD_FOR_BLACKSKY, '/blacksky');

  // The phone's back button lands on BlackSky again, and the screen says so.
  await page.goBack();
  await expect(page).toHaveURL('/blacksky');
  await expect(page.getByText(BACK_PRESSED)).toBeVisible();

  // A jump of several entries at once (the long-press back list) unmounts
  // BlackSky before its own handler runs; the app shell brings it back.
  await page.evaluate(() => window.history.go(-window.history.state.idx));
  await expect(page).toHaveURL('/blacksky');

  // A fresh visit to the app opens BlackSky again while it was the last screen.
  await page.goto('/');
  await expect(page).toHaveURL('/blacksky');
  await expect(page.getByText(BLACKSKY_RESUMED)).toBeVisible();

  // The hold is the one way out; after it the app opens where it is asked to.
  await hold(page, LEAVE_BLACKSKY, '/');
  await page.goto('/');
  await expect(page).toHaveURL('/');
});
