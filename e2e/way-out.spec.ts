import { expect, test, type Locator, type Page } from '@playwright/test';
import { ARRIVAL_GUIDE, GO, LEAVE_BLACKSKY, SEE_HOW_IT_WORKS, WAY_OUT_BUTTON } from '../src/core/copy';
import { ACKNOWLEDGEMENT_KEY } from '../src/core/constants';
import { passGate } from './helpers';

async function hold(page: Page, button: Locator) {
  const box = (await button.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(2_300);
  await page.mouse.up();
}

async function intoBlackSky(page: Page) {
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({ latitude: -37.8266, longitude: 145.366, accuracy: 20 });
  await passGate(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await hold(page, page.getByRole('button', { name: new RegExp(WAY_OUT_BUTTON) }));
}

/** Back on the welcome, with nothing agreed to: the app itself stays closed. */
async function onWelcome(page: Page) {
  await expect(page.getByRole('button', { name: SEE_HOW_IT_WORKS })).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(WAY_OUT_BUTTON) })).toBeVisible();
  await expect(page.locator('.bottom-nav')).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), ACKNOWLEDGEMENT_KEY)).toBeNull();
}

test('a new person holds I need a way out now: BlackSky spotlights the marker, Go clears it, and leaving goes back to the welcome', async ({ page }) => {
  await intoBlackSky(page);
  const guide = page.getByRole('dialog', { name: ARRIVAL_GUIDE });
  await expect(guide).toBeVisible();
  // The marker and the place's name are both ringed.
  await expect(page.locator('.glass-spot-ring')).toHaveCount(2);
  await guide.getByRole('button', { name: GO }).click();
  await expect(guide).toBeHidden();

  await hold(page, page.getByRole('button', { name: LEAVE_BLACKSKY }));
  await onWelcome(page);
  // A reload stays on the welcome, and the hold there still works.
  await page.reload();
  await onWelcome(page);
  await hold(page, page.getByRole('button', { name: new RegExp(WAY_OUT_BUTTON) }));
  await expect(page.getByRole('button', { name: LEAVE_BLACKSKY })).toBeVisible();
});

test('a reload in BlackSky stays there, and leaving after it still goes back to the welcome', async ({ page }) => {
  await intoBlackSky(page);
  await expect(page.getByRole('button', { name: LEAVE_BLACKSKY })).toBeVisible();
  await page.reload();
  await hold(page, page.getByRole('button', { name: LEAVE_BLACKSKY }));
  await onWelcome(page);
});

test('the arrival spotlight stays past two seconds and closes on a tap anywhere', async ({ page }) => {
  await intoBlackSky(page);
  const guide = page.getByRole('dialog', { name: ARRIVAL_GUIDE });
  await expect(guide).toBeVisible();
  // Time to read the rings: still there well past the old two seconds.
  await page.waitForTimeout(3_000);
  await expect(guide).toBeVisible();
  // Someone done reading taps out anywhere, here on the distance.
  await page.locator('.blacksky-dial-distance').click();
  await expect(guide).toBeHidden();
  await hold(page, page.getByRole('button', { name: LEAVE_BLACKSKY }));
  await onWelcome(page);
});
