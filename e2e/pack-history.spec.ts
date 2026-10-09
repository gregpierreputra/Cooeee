import { expect, test } from '@playwright/test';
import { ABOUT_GAPS, GAP_ABOUT, GAPS_CHECKED, NOT_YET_REHEARSED, PACK_TAB_PRACTICE } from '../src/core/copy';
import { HARNESS } from './helpers';

// E5-US5 — the pack page lists its own rehearsals, newest first, in its
// Practice tab, in the result screen's words. A count of gaps and never a score.

test('a pack never rehearsed says so in its Practice tab', async ({ page }) => {
  await page.goto(`${HARNESS}/detail`);
  const tab = page.getByRole('tab', { name: PACK_TAB_PRACTICE });
  await expect(tab).toHaveAttribute('aria-selected', 'false');
  await expect(page.getByText(NOT_YET_REHEARSED)).toBeHidden();
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText(NOT_YET_REHEARSED)).toBeVisible();
});

test('a rehearsed pack lists the rehearsal with its date, condition, ending and gaps', async ({ page }) => {
  await page.goto(`${HARNESS}/detail?mode=rehearsed`);
  await page.getByRole('tab', { name: PACK_TAB_PRACTICE }).click();
  const row = page.locator('.history-row');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('3 March 2026');
  await expect(row).toContainText('No mobile data');
  await expect(row).toContainText('You went there. It took you 14 minutes.');
  await expect(row).toContainText('No gaps found');
  // With nothing found, the four checks by short name; what a gap is sits behind About gaps.
  await expect(row).toContainText(GAPS_CHECKED);
  await row.getByRole('button', { name: ABOUT_GAPS }).click();
  await expect(row).toContainText(GAP_ABOUT);
  const text = (await row.innerText()).toLowerCase();
  for (const word of ['score', 'grade', '%', 'out of']) expect(text).not.toContain(word);
});
