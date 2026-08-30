import { expect, test, type Page } from '@playwright/test';

const SIZE_URL = 'http://127.0.0.1:4174/size';

async function counts(page: Page) {
  return page.evaluate(() => window.__storageCounts());
}

async function packs(page: Page) {
  return page.evaluate(() => window.__readPacks());
}

test('AC9 presents exact sizes and two equal, unselected choices before any write', async ({ page }) => {
  await page.goto(SIZE_URL);

  await expect(page.locator('main').locator('h1, .pack-size, button')).toHaveText([
    'Ready to download',
    'Text 1 KB · Map tiles 12.4 MB for about 10 km around this place',
    'Download both',
    'Text only',
  ]);
  const both = page.getByRole('button', { name: 'Download both' });
  const text = page.getByRole('button', { name: 'Text only' });
  await expect(both).not.toBeFocused();
  await expect(text).not.toBeFocused();
  await expect(both).toHaveCSS('background-color', await text.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  ));
  expect(await both.evaluate((element) => element.getBoundingClientRect().height >= 24)).toBe(true);
  expect(await text.evaluate((element) => element.getBoundingClientRect().height >= 24)).toBe(true);
  expect(await page.evaluate(() => window.__downloadCount)).toBe(0);
  expect(await counts(page)).toMatchObject({ packs: 0, layers: 0, destinations: 0, tiles: 0 });
});

test('AC9 text-only consent stores one exact complete zero-tile pack', async ({ page }) => {
  await page.goto(SIZE_URL);
  const sizeLine = await page.locator('.pack-size').textContent();
  await page.getByRole('button', { name: 'Text only' }).click();

  // One screen carries every approved piece of information: AC1's "Place saved"
  // and the confirmed address, together with AC9's text-only outcome.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Place saved');
  await expect(page.getByTestId('saved-address')).toHaveText('6 RIDGE ROAD KALORAMA 3766');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('Saved without map tiles');
  await expect(page.getByRole('status')).toContainText(
    'Maps were not downloaded. Everything else in this pack works offline.',
  );
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
  await page.getByRole('button', { name: 'Text only' }).click();

  await expect(page.getByRole('heading')).toHaveText('The download stopped before it finished.');
  await expect(page.getByRole('status')).toContainText(
    'Nothing has been changed. Your previous pack is untouched.',
  );
  expect(await packs(page)).toEqual(before);
  expect(await counts(page)).toMatchObject({ packs: 1, layers: 0, destinations: 0, tiles: 0 });

  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Place saved');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('Saved without map tiles');
  expect((await packs(page)).map(({ id }) => id)).toEqual(['new-pack']);
});

test('AC9 makes unavailable maps explicit while keeping text-only available', async ({ page }) => {
  await page.goto(`${SIZE_URL}?mode=unavailable`);

  await expect(page.getByRole('status')).toHaveText(
    'Map download is not available yet. Text only is still available.',
  );
  await expect(page.getByRole('button', { name: 'Download both' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Text only' })).toBeEnabled();
  expect(await page.evaluate(() => window.__downloadCount)).toBe(0);
});
