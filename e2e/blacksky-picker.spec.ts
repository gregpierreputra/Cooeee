import { expect, test } from '@playwright/test';
import { BLACKSKY_PACK_KEY } from '../src/core/constants';
import { CHOOSE_PACK, MARK_AT_SAVED_PLACE, NO_GPS_YET, PACK_COVERS_HERE } from '../src/core/copy';
import { HARNESS } from './helpers';

// Two saved packs: BlackSky asks which to load at the top of the screen, loads
// nothing of either until one is chosen, remembers the choice across a reload,
// and swaps when the other is chosen. Headless Chromium denies geolocation, so
// a loaded pack shows as reference text with its mark control.
const FERNY = '10 OLD ROAD FERNY CREEK 3786';
const KALORAMA = '6 RIDGE ROAD KALORAMA 3766';

test('the picker loads only the chosen pack and remembers it', async ({ page }) => {
  await page.goto(`${HARNESS}/blacksky`);
  await expect(page.getByText(CHOOSE_PACK)).toBeVisible();
  const choices = page.locator('.blacksky-pack');
  const ferny = choices.filter({ hasText: 'Ferny Creek' });
  const kalorama = choices.filter({ hasText: 'Kalorama' });
  const markFerny = page.getByRole('button', { name: MARK_AT_SAVED_PLACE(FERNY) });
  const markKalorama = page.getByRole('button', { name: MARK_AT_SAVED_PLACE(KALORAMA) });
  await expect(choices).toHaveCount(2);
  await expect(page.locator('.blacksky-pack[aria-pressed="true"]')).toHaveCount(0);
  await expect(markFerny).toHaveCount(0);
  await expect(markKalorama).toHaveCount(0);
  await expect(page.getByText(NO_GPS_YET)).toBeVisible();

  await ferny.click();
  await expect(ferny).toHaveAttribute('aria-pressed', 'true');
  await expect(markFerny).toBeVisible();
  await expect(markKalorama).toHaveCount(0);

  await page.reload();
  await expect(ferny).toHaveAttribute('aria-pressed', 'true');
  await expect(markFerny).toBeVisible();

  await kalorama.click();
  await expect(kalorama).toHaveAttribute('aria-pressed', 'true');
  await expect(markKalorama).toBeVisible();
  await expect(markFerny).toHaveCount(0);
});

// A remembered id that matches no saved pack (a deleted pack, or a foreign
// value in storage) loads nothing and asks again.
test('a remembered id for a pack that no longer exists loads nothing', async ({ page }) => {
  await page.addInitScript(([key]) => localStorage.setItem(key, 'gone'), [BLACKSKY_PACK_KEY]);
  await page.goto(`${HARNESS}/blacksky`);
  await expect(page.locator('.blacksky-pack')).toHaveCount(2);
  await expect(page.locator('.blacksky-pack[aria-pressed="true"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^I'm standing at/ })).toHaveCount(0);
});

// With a fix, the picker says which pack's area contains it, chosen or not.
test('the picker says which pack covers the position the arrows are drawn from', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: -37.88, longitude: 145.34, accuracy: 20 }); // at Ferny Creek
  await page.goto(`${HARNESS}/blacksky`);
  const tagged = page.locator('.blacksky-pack', { hasText: PACK_COVERS_HERE });
  await expect(tagged).toHaveCount(1);
  await expect(tagged).toContainText('Ferny Creek');
});
