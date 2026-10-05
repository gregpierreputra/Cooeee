import { expect, test } from '@playwright/test';
import * as copy from '../src/core/copy';
import { HARNESS } from './helpers';

// Print this pack: one page of the pack, read from the phone with no request,
// that prints only when the person taps Print, and leaves the button off paper.
test('the print page shows the pack, its area, its places and who to call, with no request', async ({ page }) => {
  let requests = 0;
  page.on('request', (request) => {
    if (request.resourceType() === 'fetch' || request.resourceType() === 'xhr') requests += 1;
  });
  await page.goto(`${HARNESS}/detail-print`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kalorama');
  await expect(page.getByText(copy.PRINT_AREA_TITLE)).toBeVisible();
  await expect(page.getByText('Kalorama Reserve')).toBeVisible();
  await expect(page.locator('.print-calls li')).toHaveCount(2);
  await expect(page.locator('.print-calls .emergency-line')).toContainText('000');
  await expect(page.getByText(copy.OFFICIAL_INSTRUCTIONS_FIRST)).toBeVisible();
  expect(requests).toBe(0);
});

test('Print opens the print dialog only when tapped, and the button stays off paper', async ({ page }) => {
  await page.goto(`${HARNESS}/detail-print`);
  await page.evaluate(() => {
    (window as Window & { __printed?: number }).__printed = 0;
    window.print = () => { (window as Window & { __printed?: number }).__printed! += 1; };
  });
  expect(await page.evaluate(() => (window as Window & { __printed?: number }).__printed)).toBe(0);
  await page.getByRole('button', { name: copy.PRINT_PACK }).click();
  expect(await page.evaluate(() => (window as Window & { __printed?: number }).__printed)).toBe(1);

  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('button', { name: copy.PRINT_PACK })).toBeHidden();
});

test('the pack menu offers Print this pack', async ({ page }) => {
  await page.goto(`${HARNESS}/home?days=3`);
  await page.getByRole('button', { name: copy.PACK_SETTINGS('Ferny Creek') }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: copy.PRINT_PACK })).toBeVisible();
});

test('the pack page offers Print this pack, to the same print page', async ({ page }) => {
  await page.goto(`${HARNESS}/detail`);
  await expect(page.getByRole('link', { name: copy.PRINT_PACK })).toHaveAttribute('href', '/packs/detail-pack/print');
});
