import { expect, test, type Page } from '@playwright/test';

const URL = 'http://127.0.0.1:4174/destinations';
const ORIGIN = 'http://127.0.0.1:4174';

const IN_RANGE = [
  'Kalorama Memorial Reserve',
  'Mount Dandenong Reserve',
  'Olinda Recreation Reserve',
  'Silvan Recreation Reserve',
];
const OUT_OF_RANGE = 'Belgrave Recreation Reserve';
const UNLOCATED_SAME_LGA = 'Wandin North Reserve';
const UNLOCATED_OTHER_LGA = 'Alexandra Showgrounds';

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

  for (const name of IN_RANGE) {
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  }

  const cards = page.locator('.destination-item');
  await expect(cards).toHaveCount(IN_RANGE.length + 1); // + the un-located Wandin North row

  // Every rendered row carries the kind, the responsible council, the list's own
  // recorded date, and its publisher.
  for (const text of [
    'Bushfire place of last resort',
    'Responsible council: Yarra Ranges Shire',
    'CFA state-wide list as at 18 Aug 2026',
  ]) {
    await expect(page.getByText(text).first()).toBeVisible();
    expect(await page.getByText(text).count()).toBe(IN_RANGE.length + 1);
  }
  expect(await page.getByText(/Published by Country Fire Authority/).count()).toBe(
    IN_RANGE.length + 1,
  );
});

test('AC1 never mixes in a place beyond the radius or from a neighbouring council', async ({
  page,
}) => {
  await page.goto(URL);
  await expect(page.getByText(OUT_OF_RANGE)).toHaveCount(0);
  await expect(page.getByText(UNLOCATED_OTHER_LGA)).toHaveCount(0);
});

test('AC1 keeps an un-located published place, under its own heading and with no distance', async ({
  page,
}) => {
  await page.goto(URL);

  const section = page.locator('.destination-unlocated');
  await expect(section.getByRole('heading', { name: 'On the CFA list but not located to a point on the map' })).toBeVisible();
  await expect(section.getByRole('heading', { name: UNLOCATED_SAME_LGA, exact: true })).toBeVisible();

  // Distance and ordinals are E2-US1-AC2; nothing on this screen implies either.
  await expect(page.locator('.destinations-page')).not.toContainText('km');
  await expect(page.locator('.destinations-page')).not.toContainText('nearest');
  await expect(page.locator('.destinations-page')).not.toContainText('sorted by distance');
});

test('AC1 states plainly when nothing is published, without a blank screen', async ({ page }) => {
  await page.goto(`${URL}?mode=empty`);

  await expect(
    page.getByText('No official place of last resort is published for this area — Yarra Ranges.'),
  ).toBeVisible();
  await expect(page.locator('.destination-item')).toHaveCount(0);
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
  await expect(page.getByRole('heading', { name: IN_RANGE[0], exact: true })).toBeVisible();

  expect(offOrigin).toEqual([]);
});
