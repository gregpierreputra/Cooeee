import { expect, test } from '@playwright/test';
import { waitForController } from './helpers';
import {
  BLACKSKY_TITLE,
  HOLD_FOR_BLACKSKY,
  HOLD_TO_ENTER,
  HOLD_TO_LEAVE,
  LEAVE_BLACKSKY,
  NO_PACK_HERE,
} from '../src/core/copy';

// BlackSky's whole promise is made for the moment the radios are off. Both
// tests here run against the real production bundle, like offline-cold-start.

test('BlackSky cold-starts offline on a fresh install: the designed no-pack state, zero network', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await waitForController(page);

  const failed: string[] = [];
  page.on('requestfailed', (r) => failed.push(`${r.method()} ${r.url()}`));

  await context.setOffline(true);
  // A direct URL load, not a client-side hop: this exercises the service
  // worker's navigateFallback and the empty IndexedDB read together.
  await page.goto('/blacksky');

  await expect(page.getByRole('heading', { name: BLACKSKY_TITLE })).toBeVisible();
  await expect(page.getByText(NO_PACK_HERE)).toBeVisible();
  await expect(page.getByRole('button', { name: LEAVE_BLACKSKY })).toBeVisible();
  expect(failed).toEqual([]);

  await context.setOffline(false);
});

test('entry demands the hold: a tap earns only the hint, a full hold enters', async ({ page }) => {
  await page.goto('/');
  const hold = page.getByRole('button', { name: HOLD_FOR_BLACKSKY });
  await expect(hold).toBeVisible();

  // A stray tap: no navigation, just the hint.
  await hold.click();
  await expect(page.getByText(HOLD_TO_ENTER)).toBeVisible();
  await expect(page).toHaveURL('/');

  // A deliberate hold: press, wait past HOLD_MS, and the mode opens on its own.
  const box = (await hold.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(page).toHaveURL('/blacksky', { timeout: 5_000 });
  await page.mouse.up();

  // Leaving demands the same hold: a stray tap earns only the hint.
  const leave = page.getByRole('button', { name: LEAVE_BLACKSKY });
  await leave.click();
  await expect(page.getByText(HOLD_TO_LEAVE)).toBeVisible();
  await expect(page).toHaveURL('/blacksky');

  const leaveBox = (await leave.boundingBox())!;
  await page.mouse.move(leaveBox.x + leaveBox.width / 2, leaveBox.y + leaveBox.height / 2);
  await page.mouse.down();
  await expect(page).toHaveURL('/', { timeout: 5_000 });
  await page.mouse.up();
});
