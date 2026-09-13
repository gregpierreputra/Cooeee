import { expect, test } from '@playwright/test';
import { ABOUT_COOEEE, COOEEE_INFO_LINES, NAV_ABOUT, NAV_LABEL } from '../src/core/copy';
import { acknowledgeFirstOpen } from './helpers';

// The About page, reached from the bottom bar of the real bundle, with the bar
// still there beneath it.
test('the bottom bar opens the About page', async ({ page }) => {
  await acknowledgeFirstOpen(page);
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: NAV_LABEL });
  await nav.getByRole('link', { name: NAV_ABOUT }).click();

  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByText(ABOUT_COOEEE)).toBeVisible();
  await expect(page.locator('.info-lines li')).toHaveCount(COOEEE_INFO_LINES.length);
  await expect(page.locator('.info-lines .glyph')).toHaveCount(COOEEE_INFO_LINES.length);
  await expect(page.getByText(COOEEE_INFO_LINES[0].text)).toBeVisible();
  await expect(nav).toBeVisible();
});
