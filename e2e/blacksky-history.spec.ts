import { expect, test } from '@playwright/test';
import { NAV_HOLD_HINT_MS } from '../src/core/constants';
import { BACK_PRESSED, BLACKSKY_BLOCKED, HOLD_FOR_BLACKSKY, HOLD_TO_LEAVE, LEAVE_BLACKSKY } from '../src/core/copy';
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

  // The phone's back button lands on BlackSky again, and the pill over the
  // hold to leave says why and what to do, then goes as the hold's hint does.
  await page.goBack();
  await expect(page).toHaveURL('/blacksky');
  const pill = page.locator('.blacksky-leave .blacksky-hold-hint');
  await expect(pill).toHaveText(BACK_PRESSED);
  await expect(pill).toBeHidden({ timeout: NAV_HOLD_HINT_MS + 2_000 });

  // A jump of several entries at once (the long-press back list) unmounts
  // BlackSky before its own handler runs; the app shell brings it back.
  await page.evaluate(() => window.history.go(-window.history.state.idx));
  await expect(page).toHaveURL('/blacksky');

  // A fresh visit to the app opens BlackSky again while it was the last screen.
  await page.goto('/');
  await expect(page).toHaveURL('/blacksky');
  // Reopened in silence: no line says so.
  await expect(page.locator('.blacksky-hold-hint')).toHaveCount(0);

  // The hold is the one way out; after it the app opens where it is asked to.
  await hold(page, LEAVE_BLACKSKY, '/');

  // The entry the relaunch left behind is the first in history. Back onto it
  // must not open BlackSky again: the app stays out and says so in one line.
  await page.goBack();
  await expect(page).toHaveURL('/');
  await expect(page.getByText(BLACKSKY_BLOCKED)).toBeVisible();

  // A typed address is not a hold either.
  await page.goto('/blacksky');
  await expect(page).toHaveURL('/');
  await expect(page.getByText(BLACKSKY_BLOCKED)).toBeVisible();

  await page.goto('/');
  await expect(page).toHaveURL('/');
});

// Each short tap starts the hint's time over: a second tap just before it would
// have gone keeps it up for the full time again.
test('a second short tap on the hold to leave keeps its hint up for the full time', async ({ page }) => {
  await acknowledgeFirstOpen(page);
  await page.goto('/');
  await hold(page, HOLD_FOR_BLACKSKY, '/blacksky');
  const leave = page.getByRole('button', { name: LEAVE_BLACKSKY });
  const pill = page.locator('.blacksky-leave .blacksky-hold-hint');
  await leave.click();
  await expect(pill).toHaveText(HOLD_TO_LEAVE);
  await page.waitForTimeout(NAV_HOLD_HINT_MS - 1_000);
  await leave.click();
  // Past when the first tap's hint would have gone.
  await page.waitForTimeout(2_000);
  await expect(pill).toBeVisible();
  await expect(pill).toBeHidden({ timeout: 3_000 });
});
