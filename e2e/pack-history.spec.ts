import { expect, test } from '@playwright/test';
import { HIDE_SECTION, NOT_YET_REHEARSED, REHEARSALS, SHOW_SECTION } from '../src/core/copy';
import { HARNESS } from './helpers';

// E5-US5 — the pack page lists its own rehearsals, newest first, closed by
// default, in the result screen's words. A count of gaps and never a score.

test('a pack never rehearsed says so behind a closed section', async ({ page }) => {
  await page.goto(`${HARNESS}/detail`);
  const toggle = page.getByRole('button', { name: SHOW_SECTION(REHEARSALS) });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByText(NOT_YET_REHEARSED)).toBeHidden();
  await toggle.click();
  await expect(page.getByText(NOT_YET_REHEARSED)).toBeVisible();
  await expect(page.getByRole('button', { name: HIDE_SECTION(REHEARSALS) })).toBeVisible();
});

test('a rehearsed pack lists the rehearsal with its date, condition, ending and gaps', async ({ page }) => {
  await page.goto(`${HARNESS}/detail?mode=rehearsed`);
  await page.getByRole('button', { name: SHOW_SECTION(REHEARSALS) }).click();
  const row = page.locator('.history-row');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('3 March 2026');
  await expect(row).toContainText('No mobile data');
  await expect(row).toContainText('You went there. It took you 14 minutes.');
  await expect(row).toContainText('No gaps found');
  const text = (await row.innerText()).toLowerCase();
  for (const word of ['score', 'grade', '%', 'out of']) expect(text).not.toContain(word);
});
