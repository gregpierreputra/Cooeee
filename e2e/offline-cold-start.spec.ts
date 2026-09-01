import { expect, test } from '@playwright/test';
import {
  HEADER_HOME_LABEL,
  HOME_TITLE,
  NO_PACK_SAVED,
  NO_PACKS_HINT,
} from '../src/core/copy';
import { waitForController } from './helpers';

// The offline claim is the product. It is asserted against the real production
// bundle with the network genuinely off, not simulated and not inspected.

test('the shell cold-starts with the radios off, and nothing reaches for the network', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: HOME_TITLE })).toBeVisible();
  await waitForController(page);

  const failed: string[] = [];
  page.on('requestfailed', (r) => failed.push(`${r.method()} ${r.url()}`));

  await context.setOffline(true);
  await page.reload();

  // The designed empty state, not a blank, not an error page, not a spinner.
  await expect(page.getByRole('heading', { name: HOME_TITLE })).toBeVisible();
  await expect(page.getByText(NO_PACK_SAVED)).toBeVisible();
  await expect(page.getByText(NO_PACKS_HINT)).toBeVisible();

  // E1-US2-AC6: the fixed header renders with the radios off, reporting no age
  // because nothing is saved, and the dot reports what the browser reports.
  await expect(page.getByRole('link', { name: HEADER_HOME_LABEL })).toBeVisible();
  await expect(page.locator('.connection-dot')).toBeVisible();
  await expect(page.locator('.app-header-age')).toHaveCount(0);

  // Every byte the offline page needed was already on the device.
  expect(failed).toEqual([]);

  await context.setOffline(false);
});

test('the empty state states absence and never reassures', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: HOME_TITLE })).toBeVisible();
  await expect(page.getByText(NO_PACK_SAVED)).toBeVisible();
  const body = (await page.locator('body').textContent()) ?? '';

  expect(body).toContain(NO_PACK_SAVED);
  expect(body).not.toMatch(/\bsafe\b|\ball clear\b|\bno risk\b/i);
  await expect(page.locator('[role="progressbar"]')).toHaveCount(0);
});

test('ping.txt is served from the network, never from the precache', async ({ page, context }) => {
  await page.goto('/');
  await waitForController(page);

  expect(await page.evaluate(() => fetch('/ping.txt').then((r) => r.text()))).toBe('ok');

  // Excluded from the precache on purpose: a cached probe would report "online"
  // with the radios off, and every connectivity state downstream would be wrong.
  await context.setOffline(true);
  const offlineProbe = await page.evaluate(() =>
    fetch('/ping.txt')
      .then(() => 'reachable')
      .catch(() => 'unreachable'),
  );
  expect(offlineProbe).toBe('unreachable');

  await context.setOffline(false);
});
