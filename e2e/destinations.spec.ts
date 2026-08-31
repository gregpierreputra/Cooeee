import { expect, test, type Page } from '@playwright/test';

const URL = 'http://127.0.0.1:4174/destinations';
const ORIGIN = 'http://127.0.0.1:4174';

// Declared out of distance order in the fixture; this is the by-distance order.
const BY_DISTANCE = [
  'Kalorama Memorial Reserve',
  'Mount Dandenong Reserve',
  'Olinda Recreation Reserve',
  'Silvan Recreation Reserve',
];
const OUT_OF_RANGE = 'Belgrave Recreation Reserve';
const UNLOCATED_SAME_LGA = 'Wandin North Reserve';
const UNLOCATED_OTHER_LGA = 'Alexandra Showgrounds';
const CAVEAT = 'sorted by distance, not a safety ranking';
const DISTANCE = /^\d+(\.\d+)?\s(m|km)$/;
const ANY_ORDINAL = /^(nearest|second nearest|third nearest)$/;

function offOriginRequests(page: Page): string[] {
  const seen: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(ORIGIN)) seen.push(`${request.method()} ${request.url()}`);
  });
  return seen;
}

test('AC1 lists only the official in-range places, each with its council and the list date', async ({
  page,
}) => {
  await page.goto(URL);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Official places of last resort');

  for (const name of BY_DISTANCE) {
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  }

  const cards = page.locator('.destination-item');
  await expect(cards).toHaveCount(BY_DISTANCE.length + 1); // + the un-located Wandin North row

  for (const text of [
    'Bushfire place of last resort',
    'Responsible council: Yarra Ranges Shire',
    'CFA state-wide list as at 18 Aug 2026',
  ]) {
    await expect(page.getByText(text).first()).toBeVisible();
    expect(await page.getByText(text).count()).toBe(BY_DISTANCE.length + 1);
  }
  expect(await page.getByText(/Published by Country Fire Authority/).count()).toBe(
    BY_DISTANCE.length + 1,
  );
});

test('AC1 never mixes in a place beyond the radius or from a neighbouring council', async ({
  page,
}) => {
  await page.goto(URL);
  await expect(page.getByText(OUT_OF_RANGE)).toHaveCount(0);
  await expect(page.getByText(UNLOCATED_OTHER_LGA)).toHaveCount(0);
});

test('AC1 keeps an un-located published place, under its own heading', async ({ page }) => {
  await page.goto(URL);

  const section = page.locator('.destination-unlocated');
  await expect(
    section.getByRole('heading', { name: 'On the CFA list but not located to a point on the map' }),
  ).toBeVisible();
  await expect(section.getByRole('heading', { name: UNLOCATED_SAME_LGA, exact: true })).toBeVisible();
});

test('AC2 orders the located places by straight-line distance, not by document order', async ({
  page,
}) => {
  await page.goto(URL);
  const names = await page
    .locator('[data-testid=ordered-destinations] .destination-item h2')
    .allTextContents();
  expect(names).toEqual(BY_DISTANCE);
});

test('AC2 labels the first three by position and stops', async ({ page }) => {
  await page.goto(URL);
  const rows = page.locator('[data-testid=ordered-destinations] .destination-item');

  await expect(rows.nth(0).getByText('nearest', { exact: true })).toBeVisible();
  await expect(rows.nth(1).getByText('second nearest', { exact: true })).toBeVisible();
  await expect(rows.nth(2).getByText('third nearest', { exact: true })).toBeVisible();

  // The fourth place has a distance but no ordinal — there is no fourth label.
  await expect(rows.nth(3).getByText(ANY_ORDINAL)).toHaveCount(0);
  await expect(rows.nth(3).getByText(DISTANCE)).toBeVisible();

  expect(await page.getByText('nearest', { exact: true }).count()).toBe(1);
});

test('AC2 shows a straight-line distance on every ordered row', async ({ page }) => {
  await page.goto(URL);
  const rows = page.locator('[data-testid=ordered-destinations] .destination-item');
  await expect(rows).toHaveCount(BY_DISTANCE.length);
  for (let i = 0; i < BY_DISTANCE.length; i += 1) {
    await expect(rows.nth(i).getByText(DISTANCE)).toBeVisible();
  }
});

test('AC2 shows the mandated caveat line once, above the list and not inside it', async ({
  page,
}) => {
  await page.goto(URL);
  await expect(page.locator('p.caveat')).toHaveText(CAVEAT);
  expect(await page.getByText(CAVEAT).count()).toBe(1);
  await expect(page.locator('[data-testid=ordered-destinations]')).not.toContainText(CAVEAT);
});

test('AC2 keeps the un-located group free of distance and ordinals', async ({ page }) => {
  await page.goto(URL);
  const section = page.locator('[data-testid=unlocated-destinations]');
  await expect(section).not.toContainText('km');
  await expect(section).not.toContainText('nearest');
});

test('AC1 states plainly when nothing is published, without a blank screen', async ({ page }) => {
  await page.goto(`${URL}?mode=empty`);

  await expect(
    page.getByText('No official place of last resort is published for this area — Yarra Ranges.'),
  ).toBeVisible();
  await expect(page.locator('.destination-item')).toHaveCount(0);
  await expect(page.getByText(CAVEAT)).toHaveCount(0);
  await expect(page.locator('main')).not.toBeEmpty();
});

test('AC1 states plainly when the cached list could not be read', async ({ page }) => {
  await page.goto(`${URL}?mode=malformed`);

  await expect(
    page.getByText('The official list could not be included for this area.'),
  ).toBeVisible();
  await expect(page.locator('.destination-item')).toHaveCount(0);
});

test('AC1 makes no off-origin request to render the list', async ({ page }) => {
  const offOrigin = offOriginRequests(page);
  await page.goto(URL);
  await expect(page.getByRole('heading', { name: BY_DISTANCE[0], exact: true })).toBeVisible();

  expect(offOrigin).toEqual([]);
});
