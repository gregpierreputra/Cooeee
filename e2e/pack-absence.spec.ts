import { expect, test } from '@playwright/test';

const URL = 'http://127.0.0.1:4174/detail?mode=absence';
const ORIGIN = 'http://127.0.0.1:4174';
const ABSENCE_LINE = 'No official place of last resort is published for this area — Yarra Ranges.';

test('AC3 a saved pack with no published places states so plainly', async ({ page }) => {
  await page.goto(URL);
  await expect(page.getByRole('heading', { name: 'Your pack' })).toBeVisible();
  await expect(page.getByText(ABSENCE_LINE)).toBeVisible();
});

test('AC3 the absence is a plain card — no pseudo-item, no source to open', async ({ page }) => {
  await page.goto(URL);

  await expect(
    page.getByRole('heading', { name: 'Official place of last resort information' }),
  ).toHaveCount(0);

  const card = page.locator('.card', { hasText: ABSENCE_LINE });
  await expect(card).toHaveCount(1);
  await expect(card.getByRole('link')).toHaveCount(0);
});

test('AC3 shows nothing from a neighbouring council', async ({ page }) => {
  await page.goto(URL);
  await expect(page.locator('main')).not.toContainText('Murrindindi');
  await expect(page.locator('main')).not.toContainText('Alexandra');
});

test('AC3 renders the saved pack with no off-origin request', async ({ page }) => {
  const offOrigin: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(ORIGIN)) offOrigin.push(`${request.method()} ${request.url()}`);
  });

  await page.goto(URL);
  await expect(page.getByText(ABSENCE_LINE)).toBeVisible();

  expect(offOrigin).toEqual([]);
});
