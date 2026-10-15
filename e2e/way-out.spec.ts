import { expect, test, type Locator, type Page } from '@playwright/test';
import { ARRIVAL_GUIDE, CLOSE, GO, LEAVE_BLACKSKY, TOUR_OFFER_TITLE, WAY_OUT_BUTTON } from '../src/core/copy';
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

test('a new person holds I need a way out now: BlackSky spotlights the marker, Go clears it, and leaving offers the tour', async ({ page }) => {
  await intoBlackSky(page);
  const guide = page.getByRole('dialog', { name: ARRIVAL_GUIDE });
  await expect(guide).toBeVisible();
  // The marker and the place's name are both ringed.
  await expect(page.locator('.glass-spot-ring')).toHaveCount(2);
  await guide.getByRole('button', { name: GO }).click();
  await expect(guide).toBeHidden();

  await hold(page, page.getByRole('button', { name: LEAVE_BLACKSKY }));
  const offer = page.getByRole('dialog', { name: TOUR_OFFER_TITLE });
  await expect(offer).toBeVisible();
  // Nothing was agreed to: the disclosure shows on the next visit.
  expect(await page.evaluate((key) => localStorage.getItem(key), ACKNOWLEDGEMENT_KEY)).toBeNull();
  // The ring under the hole starts the tour, which ends the offer.
  await page.locator('.tour-ring').click();
  await expect(offer).toBeHidden();
  await expect(page.locator('.tour-panel')).toBeVisible();
});

test('the arrival spotlight closes by itself after two seconds, and the offer closes on its cross', async ({ page }) => {
  await intoBlackSky(page);
  const guide = page.getByRole('dialog', { name: ARRIVAL_GUIDE });
  await expect(guide).toBeVisible();
  await expect(guide).toBeHidden({ timeout: 3_000 });
  await hold(page, page.getByRole('button', { name: LEAVE_BLACKSKY }));
  const offer = page.getByRole('dialog', { name: TOUR_OFFER_TITLE });
  await offer.getByRole('button', { name: CLOSE }).click();
  await expect(offer).toBeHidden();
  await expect(page.locator('.tour-panel')).toHaveCount(0);
});
