import { expect, test } from '@playwright/test';
import { ACKNOWLEDGE_CHECKBOX, CONTINUE, SKIP_TOUR, TOUR_BACK, TOUR_HINT, TOUR_NEXT, TOUR_STEPS } from '../src/core/copy';
import { acknowledgeFirstOpen } from './helpers';

// The guided tour on the real bundle: it starts once, right after the
// first-open acknowledgement, walks across screens, and can be skipped; a
// returning user starts it from the ring and can leave it with Escape.
const N = TOUR_STEPS.length;
const count = (n: number) => `${n}/${N}`;

test('starts after the acknowledgement, steps across screens, and skips', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('checkbox', { name: ACKNOWLEDGE_CHECKBOX }).check();
  await page.getByRole('button', { name: CONTINUE }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText(count(1));
  await expect(dialog.getByRole('button', { name: TOUR_BACK })).toBeDisabled();
  await expect(page.locator('.tour-spot')).toBeVisible();

  await dialog.getByRole('button', { name: TOUR_NEXT }).click();
  await expect(dialog).toContainText(count(2));
  await dialog.getByRole('button', { name: TOUR_BACK }).click();
  await expect(dialog).toContainText(count(1));

  // Stop seven lives on the address search: the tour moves there itself.
  for (let i = 1; i < 7; i += 1) await dialog.getByRole('button', { name: TOUR_NEXT }).click();
  await expect(dialog).toContainText(count(7));
  await expect(page).toHaveURL(/\/packs\/new$/);
  await expect(page.locator('.tour-spot')).toBeVisible();

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
