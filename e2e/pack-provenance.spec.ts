import { expect, test, type Page } from '@playwright/test';
import { DTP_DATASET_URL } from '../src/core/constants';
import { HARNESS, openSources } from './helpers';

const DETAIL_URL = `${HARNESS}/detail`;
const SIZE_URL = `${HARNESS}/size`;

// The bushfire area answer sits in the Area tab and the saved place in Places:
// the two stored items, wherever the open tab is.
const storedItems = (page: Page) => page.locator('#pack-panel-area .provenance, #pack-panel-places .provenance');
const storedWebPages = (page: Page) =>
  page.locator('#pack-panel-area, #pack-panel-places').getByRole('link', { name: 'Web page', includeHidden: true });
/** Opens every Source in the Area tab, then in the Places tab. */
async function openStoredSources(page: Page) {
  await openSources(page);
  await openTab(page, 'Places');
  await openSources(page);
}

/** Opens a pack tab and waits for its panel: the router draws it a moment later. */
async function openTab(page: Page, name: string) {
  await page.getByRole('tab', { name }).click();
  await expect(page.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true');
}

test('US2 AC1 lists every available stored item with grouped publisher and full saved date', async ({ page }) => {
  await page.goto(DETAIL_URL);

  await expect(page.locator('.pack-detail h1')).toBeVisible();
  await openStoredSources(page);
  // The bushfire area and the place each carry a Source.
  await expect(storedItems(page)).toHaveCount(2);
  // Each Source labels who published the item, then when it was saved.
  const saved = storedItems(page).locator('.source-rows dd', { hasText: '27 August 2026' });
  await expect(saved).toHaveCount(2);
  await expect(saved.first()).toHaveText('2 days ago · 27 August 2026');
  await expect(storedWebPages(page)).toHaveCount(2);
  await expect(storedWebPages(page).first()).toHaveAttribute('href', DTP_DATASET_URL);
  await expect(page.locator('main')).not.toContainText(
    /Unknown publisher|Unknown|Source unavailable|n\/a/i,
  );
  expect(await page.evaluate(() => window.__storageCounts())).toMatchObject({
    layers: 1, destinations: 1, packPrograms: 1,
  });
});

test('the gazetted plan an address matched is stated in the Area tab Source, not under the answer', async ({ page }) => {
  await page.goto(DETAIL_URL);
  const area = page.locator('#pack-panel-area');
  await expect(area.locator('.area-answer')).toBeVisible();
  // The answer leads straight to the map: the plan is a fact about the source.
  await expect(area.locator('.area-answer')).not.toContainText('LEGL./25-138');
  await openSources(page);
  await expect(area.locator('.source-rows dt')).toHaveText([
    'Published by', 'Saved', 'Bushfire Prone Area plan', 'Gazetted', 'Council', 'Licence',
  ]);
  const row = (label: string) => area.locator('.source-rows > div').filter({ has: page.locator('dt', { hasText: label }) }).locator('dd');
  await expect(row('Bushfire Prone Area plan')).toHaveText('LEGL./25-138');
  await expect(row('Gazetted')).toHaveText('10 July 2025');
  await expect(row('Council')).toHaveText('Yarra Ranges');
});

test('US2 AC1 provenance remains readable at 200 percent text size', async ({ page }) => {
  await page.goto(DETAIL_URL);
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });

  await expect(storedItems(page)).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await openTab(page, 'Places');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('US2 AC2 leaves missing-provenance content out of both storage and the saved result', async ({ page }) => {
  await page.goto(`${SIZE_URL}?mode=omission`);
  await page.getByRole('button', { name: 'Save this pack' }).click();

  await expect(page.getByRole('heading', { name: 'One item left out' }))
    .toBeVisible();
  await expect(page.getByText(
    'No publisher or date was given.',
    { exact: true },
  )).toBeVisible();
  await expect(page.getByText(
    'Cooeee keeps only information with a source.',
    { exact: true },
  )).toBeVisible();
  expect(await page.evaluate(() => window.__readDestinations())).toEqual([]);
  await expect(page.getByRole('button', { name: /store|keep|save anyway/i })).toHaveCount(0);
});

test('US2 AC3 opens the same provenance offline with zero requests and no loading state', async ({ context, page }) => {
  const onlinePage = await context.newPage();
  await onlinePage.goto(DETAIL_URL);
  await expect(storedItems(onlinePage)).toHaveCount(2);
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

  await expect(storedItems(page)).toHaveCount(2);
  expect(await page.locator('main').innerText()).toBe(onlineText);
  await expect(page.locator('main')).not.toContainText(/Loading|Reconnect|Refreshing|details are not available/i);
  expect(requests).toBe(0);
});

test('an item saved 31 days ago states its age, with no old-data note, and stays usable', async ({ page }) => {
  await page.goto(`${DETAIL_URL}?mode=stale`);
  await expect(page.locator('.pack-detail h1')).toBeVisible();
  await openStoredSources(page);

  await expect(storedItems(page).locator('.source-rows dd', { hasText: '31 days ago' })).toHaveCount(2);
  await expect(page.getByText(/not recently verified|refresh it when next online/i)).toHaveCount(0);
  await expect(storedWebPages(page)).toHaveCount(2);
  expect(await page.locator('.provenance').evaluateAll(
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
  await page.getByRole('link', { name: 'Web page' }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Opens on the web');
  await expect(dialog).toContainText('May use your connection and leave Cooeee.');
  await expect(dialog.locator('.source-rows')).toContainText('Department of Transport and Planning');
  // The stored citation, so the raw response behind the link is no longer the
  // only way to read what was checked.
  await expect(dialog).toContainText(
    'Bushfire Prone Area plan LEGL./25-138 · gazetted 10 July 2025 · YARRA RANGES'
    + ' · Department of Transport and Planning',
  );
  // The publisher's readable page for the dataset, not the stored WFS query URL,
  // which answers in raw JSON and is never a page.
  await expect(dialog.getByRole('link', { name: "Continue to the publisher's dataset page" }))
    .toHaveAttribute('href', DTP_DATASET_URL);
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
  await expect(page.locator('.pack-detail h1')).toBeVisible();
  expect(requests).toBe(0);

  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(storedItems(page)).toHaveCount(2);
});

test('US2 AC5 leaves the sheet as it was for an item with no citation to state', async ({ page }) => {
  await page.goto(DETAIL_URL);
  await openTab(page, 'Places');
  await page.locator('#pack-panel-places').getByRole('link', { name: 'Web page' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Opens on the web');
  await expect(dialog).not.toContainText('Bushfire Prone Area plan');
  // The second item is the saved place, whose page is the CFA list page.
  await expect(dialog.getByRole('link', { name: 'Continue to the web page' }))
    .toHaveAttribute('href', 'https://www.cfa.vic.gov.au/plan-prepare/neighbourhood-safer-places');
});
