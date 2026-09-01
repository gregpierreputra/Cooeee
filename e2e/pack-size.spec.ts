import { expect, test } from '@playwright/test';
import { HARNESS, readPacks as packs, storageCounts as counts } from './helpers';

const SIZE_URL = `${HARNESS}/size`;

test('AC9 states the size before any write', async ({ page }) => {
  await page.goto(SIZE_URL);

  await expect(page.locator('main').locator('h1, .pack-size, button')).toHaveText([
    'Ready to download',
    'This pack is 1 KB',
    'Save this pack',
  ]);
  const save = page.getByRole('button', { name: 'Save this pack' });
  await expect(save).not.toBeFocused();
  expect(await save.evaluate((element) => element.getBoundingClientRect().height >= 24)).toBe(true);

  // Nothing has run and nothing has been written: the size is stated first.
  expect(await page.evaluate(() => window.__downloadCount)).toBe(0);
  expect(await counts(page)).toMatchObject({ packs: 0, layers: 0, destinations: 0, tiles: 0 });
});

test('AC9 offers exactly one action', async ({ page }) => {
  await page.goto(SIZE_URL);

  // Map tiles are out of Iteration 1, so there is one kind of pack. A second
  // button would offer a choice the user does not have.
  await expect(page.locator('main').getByRole('button')).toHaveCount(1);
  await expect(page.locator('main').getByRole('button')).toHaveText('Save this pack');
  await expect(page.locator('main')).not.toContainText(/tile|map|text only|download both/i);
  expect(await page.evaluate(() => window.__downloadCount)).toBe(0);
});

test('AC9 consent stores one complete pack of exactly the stated size', async ({ page }) => {
  await page.goto(SIZE_URL);
  const sizeLine = await page.locator('.pack-size').textContent();
  await page.getByRole('button', { name: 'Save this pack' }).click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Place saved');
  await expect(page.getByTestId('saved-address')).toHaveText('6 RIDGE ROAD KALORAMA 3766');
  const openSavedPack = page.getByRole('button', { name: 'Open saved pack' });
  await expect(openSavedPack).toBeVisible();

  const stored = await packs(page);
  expect(stored).toHaveLength(1);
  expect(stored[0]).toMatchObject({
    id: 'new-pack', status: 'complete', builtWithTiles: false,
    sizeBytes: { tiles: 0 },
    manifest: { groups: { tiles: { count: 0, bytes: 0 } } },
  });
  expect(sizeLine).toContain(`${Math.ceil(stored[0].sizeBytes.text / 1024)} KB`);
  expect(await counts(page)).toMatchObject({ packs: 1, layers: 0, destinations: 0, tiles: 0 });
  await expect(page.locator('canvas, [role="img"], .map')).toHaveCount(0);

  expect(await page.evaluate(() => window.__continueCount)).toBe(0);
  await openSavedPack.click();
  expect(await page.evaluate(() => window.__continueCount)).toBe(1);
});

test('AC9 interrupted staging cleans immediately and preserves the previous pack', async ({ page }) => {
  await page.goto(`${SIZE_URL}?mode=interrupt`);
  await expect(page.getByRole('heading')).toHaveText('Ready to download');
  const before = await packs(page);
  expect(before).toHaveLength(1);
  await page.getByRole('button', { name: 'Save this pack' }).click();

  await expect(page.getByRole('heading')).toHaveText('The download stopped before it finished.');
  await expect(page.getByRole('status')).toContainText(
    'Nothing has been changed. Your previous pack is untouched.',
  );
  expect(await packs(page)).toEqual(before);
  expect(await counts(page)).toMatchObject({ packs: 1, layers: 0, destinations: 0, tiles: 0 });

  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Place saved');
  expect((await packs(page)).map(({ id }) => id)).toEqual(['new-pack']);
});
