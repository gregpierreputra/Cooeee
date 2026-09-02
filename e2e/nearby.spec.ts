import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import {
  FIRST_RUN_LINE,
  FIRST_RUN_TITLE,
  HOURS_AGO,
  MAY_BE_OUTDATED,
  MINUTES_AGO,
  STATE_CACHED,
  TOO_OLD_TO_SHOW,
} from '../src/core/copy';

const ORIGIN = 'http://127.0.0.1:4174';

// Load the seeded harness online, then cut the network before doing anything.
async function openOffline(page: Page, context: BrowserContext, mode: string) {
  await page.goto(`${ORIGIN}/nearby?mode=${mode}`);
  await page.getByRole('heading', { name: 'Nearest official places' }).waitFor();
  await context.setOffline(true);
}

async function findPostcode(page: Page) {
  await page.getByLabel('Or a Victorian postcode').fill('3766');
  await page.getByRole('button', { name: 'Find' }).click();
}

const rowFor = (page: Page, title: string) =>
  page.locator('li.card', { has: page.getByRole('heading', { level: 3, name: title, exact: true }) });

test('AC4 offline, static places come from IndexedDB labelled cached with their verified date', async ({ page, context }) => {
  await openOffline(page, context, 'cached');
  await findPostcode(page);

  const nsp = rowFor(page, 'Neighbourhood Safer Place');
  await expect(nsp).toContainText('Kalorama Memorial Reserve');
  await expect(nsp).toContainText(STATE_CACHED(HOURS_AGO(2)));
  await expect(nsp).toContainText('Verified 31 August 2026');
  await expect(rowFor(page, 'Community Fire Refuge')).toContainText('Ferny Creek Community Fire Refuge');

  const relief = rowFor(page, 'Relief Centre');
  await expect(relief).toContainText('Lilydale Community Centre');
  await expect(relief).toContainText(STATE_CACHED(MINUTES_AGO(10)));
  await expect(relief).toContainText(MAY_BE_OUTDATED);
});

test('AC5 offline with a snapshot past the threshold, no relief centre is shown — only the stale line and the hotline', async ({ page, context }) => {
  await openOffline(page, context, 'stale');
  await findPostcode(page);

  const relief = rowFor(page, 'Relief Centre');
  await expect(relief).not.toContainText('Lilydale');
  await expect(relief).toContainText(TOO_OLD_TO_SHOW);
  await expect(relief).toContainText('1800 226 226');
  // The static rows are unaffected by the dynamic cut-off.
  await expect(rowFor(page, 'Neighbourhood Safer Place')).toContainText('Kalorama Memorial Reserve');
});

test('AC6 offline and never synced, the first-run state is stated rather than a blank screen', async ({ page, context }) => {
  await openOffline(page, context, 'empty');
  await expect(page.getByRole('heading', { name: FIRST_RUN_TITLE })).toBeVisible();
  await expect(page.getByText(FIRST_RUN_LINE)).toBeVisible();
  await expect(page.getByLabel('Or a Victorian postcode')).toHaveCount(0);
});
