import { expect, test } from '@playwright/test';
import { DTP_DATASET_URL } from '../src/core/constants';
import { HARNESS } from './helpers';

const DETAIL_URL = `${HARNESS}/detail`;
const SIZE_URL = `${HARNESS}/size`;

test('US2 AC1 lists every available stored item with grouped publisher and full saved date', async ({ page }) => {
  await page.goto(DETAIL_URL);

  await expect(page.getByRole('heading', { name: 'Your pack' })).toBeVisible();
  const items = page.locator('.provenance-item');
  await expect(items).toHaveCount(3);
  await expect(items.locator('.provenance').getByText(
    /Published by .+ · Saved 27 August 2026/,
  )).toHaveCount(3);
  await expect(items.getByText('2 days ago', { exact: true })).toHaveCount(3);
  await expect(page.getByRole('link', { name: 'Open original source (web)' })).toHaveCount(3);
  await expect(page.getByRole('link', { name: 'Open original source (web)' }).first())
    .toHaveAttribute('href', DTP_DATASET_URL);
  await expect(page.locator('main')).not.toContainText(
    /Unknown publisher|Unknown|Source unavailable|n\/a/i,
  );
  expect(await page.evaluate(() => window.__storageCounts())).toMatchObject({
    layers: 1, destinations: 1, programs: 1,
  });
});

test('US2 AC1 provenance remains readable at 200 percent text size', async ({ page }) => {
  await page.goto(DETAIL_URL);
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });

  await expect(page.locator('.provenance-item')).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('US2 AC2 leaves missing-provenance content out of both storage and the saved result', async ({ page }) => {
  await page.goto(`${SIZE_URL}?mode=omission`);
  await page.getByRole('button', { name: 'Save this pack' }).click();

  await expect(page.getByRole('heading', { name: 'One item was left out of your pack.' }))
    .toBeVisible();
  await expect(page.getByText(
    'It did not name who published it or when it was published, so it was not saved.',
    { exact: true },
  )).toBeVisible();
  await expect(page.getByText(
    'Cooeee only stores information it can show you the source for.',
    { exact: true },
  )).toBeVisible();
  expect(await page.evaluate(() => window.__readDestinations())).toEqual([]);
  await expect(page.getByRole('button', { name: /store|keep|save anyway/i })).toHaveCount(0);
});

test('US2 AC3 opens the same provenance offline with zero requests and no loading state', async ({ context, page }) => {
  const onlinePage = await context.newPage();
  await onlinePage.goto(DETAIL_URL);
  await expect(onlinePage.locator('.provenance-item')).toHaveCount(3);
  const onlineText = await onlinePage.locator('main').innerText();
  await onlinePage.close();

  await page.goto(`${HARNESS}/detail-launch`);
  let requests = 0;
  await page.route('**', async (route) => {
    requests += 1;
    await route.continue();
  });
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Open test pack' }).click();

  await expect(page.locator('.provenance-item')).toHaveCount(3);
  expect(await page.locator('main').innerText()).toBe(onlineText);
  await expect(page.locator('main')).not.toContainText(/Loading|Reconnect|Refreshing|details are not available/i);
  expect(requests).toBe(0);
});

test('US2 AC4 labels day 31 without disabling or hiding pack functions', async ({ page }) => {
  await page.goto(`${DETAIL_URL}?mode=stale`);

  await expect(page.getByText('31 days ago', { exact: true })).toHaveCount(3);
  await expect(page.getByText('Not recently verified', { exact: true })).toHaveCount(3);
  await expect(page.getByText(
    'This pack still works. Refresh it when you are next online.',
    { exact: true },
  )).toHaveCount(3);
  await expect(page.getByRole('link', { name: 'Open original source (web)' })).toHaveCount(3);
  expect(await page.locator('.provenance-item').evaluateAll(
    (items) => items.every((item) => !item.classList.contains('disabled')),
  )).toBe(true);
});

test('US2 AC5 always explains before an original source can leave Cooeee', async ({ page }) => {
  await page.goto(DETAIL_URL);
  let requests = 0;
  await page.route('**', async (route) => {
    requests += 1;
    await route.continue();
  });
  await page.getByRole('link', { name: 'Open original source (web)' }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('This source is on the web.');
  await expect(dialog).toContainText(
    'The publisher and the saved date below are stored on this device and stay readable.',
  );
  await expect(dialog).toContainText('Opening it may use your connection and leave Cooeee.');
  await expect(dialog).toContainText('Published by Department of Transport and Planning');
  // The stored citation, so the raw response behind the link is no longer the
  // only way to read what was checked.
  await expect(dialog).toContainText(
    'Bushfire Prone Area plan LEGL./25-138 · gazetted 10 July 2025 · YARRA RANGES'
    + ' — Department of Transport and Planning',
  );
  // The publisher's readable page for the dataset, not the stored WFS query URL,
  // which answers in raw JSON and is never a page.
  await expect(dialog.getByRole('link', { name: "Continue to the publisher's dataset page (web)" }))
    .toHaveAttribute('href', DTP_DATASET_URL);
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Your pack' })).toBeVisible();
  expect(requests).toBe(0);

  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.provenance-item')).toHaveCount(3);
});

test('US2 AC5 leaves the sheet as it was for an item with no citation to state', async ({ page }) => {
  await page.goto(DETAIL_URL);
  await page.getByRole('link', { name: 'Open original source (web)' }).nth(1).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('This source is on the web.');
  await expect(dialog).not.toContainText('Bushfire Prone Area plan');
  await expect(dialog.getByRole('link', { name: 'Continue to original source (web)' }))
    .toHaveAttribute('href', DTP_DATASET_URL);
});
