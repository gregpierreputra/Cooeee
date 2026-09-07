import { expect, test } from '@playwright/test';
import { ACKNOWLEDGE_CHECKBOX, CONTINUE, SKIP_TOUR, TOUR_BACK, TOUR_HINT, TOUR_NEXT, TOUR_STEPS } from '../src/core/copy';
import { acknowledgeFirstOpen } from './helpers';

// The guided tour on the real bundle: it starts once, right after the
// first-open acknowledgement, walks across screens, and can be skipped; a
// returning user starts it from the ring and can leave it with Escape.
const N = TOUR_STEPS.length;
const count = (n: number) => `${n}/${N}`;
// The grey never lifts: at every moment the layer either dims the screen
// itself or holds the spotlight whose shadow dims it.
const dimmed = (page: import('@playwright/test').Page) =>
  expect(page.locator('.tour.tour-dim, .tour:has(.tour-spot)')).toHaveCount(1);

test('starts after the acknowledgement, steps across screens, and skips', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('checkbox', { name: ACKNOWLEDGE_CHECKBOX }).check();
  await page.getByRole('button', { name: CONTINUE }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText(count(1));
  await expect(dialog.getByRole('button', { name: TOUR_BACK })).toBeDisabled();
  await expect(page.locator('.tour-spot')).toBeVisible();

  await dialog.getByRole('button', { name: TOUR_NEXT }).click();
  await dimmed(page);
  await expect(dialog).toContainText(count(2));
  await dialog.getByRole('button', { name: TOUR_BACK }).click();
  await dimmed(page);
  await expect(dialog).toContainText(count(1));

  // Stop seven lives on the address search: the tour moves there itself.
  for (let i = 1; i < 7; i += 1) {
    await dialog.getByRole('button', { name: TOUR_NEXT }).click();
    await dimmed(page);
  }
  await expect(dialog).toContainText(count(7));
  await expect(page).toHaveURL(/\/packs\/new$/);
  await expect(page.locator('.tour-spot')).toBeVisible();

  // The page still scrolls beneath the tour, and the spotlight follows it.
  const before = (await page.locator('.tour-spot').boundingBox())!;
  await page.mouse.wheel(0, 200);
  await expect
    .poll(async () => (await page.locator('.tour-spot').boundingBox())!.y)
    .toBeLessThan(before.y);

  await dialog.getByRole('button', { name: SKIP_TOUR }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
});

test('never starts on a later open; the ring starts it and Escape ends it', async ({ page }) => {
  await acknowledgeFirstOpen(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: TOUR_HINT })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: TOUR_HINT }).click();
  await expect(page.getByRole('dialog')).toContainText(count(1));
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
