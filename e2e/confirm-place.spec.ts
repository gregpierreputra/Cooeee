import { expect, test } from '@playwright/test';
import { HARNESS, storageState } from './helpers';

const HARNESS_URL = `${HARNESS}/`;

test('AC1 renders the confirmation order and immutable address', async ({ page }) => {
  await page.goto(HARNESS_URL);

  const heading = page.getByRole('heading', { name: 'Is this the place you want to save?' });
  const address = page.getByTestId('returned-address');
  const name = page.getByLabel('Place name');
  const save = page.getByRole('button', { name: 'Save this place' });
  const searchAgain = page.getByRole('button', { name: 'Search again' });

  await expect(heading).toBeVisible();
  await expect(address).toHaveText('6 RIDGE ROAD KALORAMA 3766');
  await expect(name).toHaveValue('KALORAMA');

  const order = await Promise.all([heading, address, name, save, searchAgain].map(async (locator) =>
    locator.evaluate((element) => {
      const all = [...document.querySelectorAll('h1, p, input, button')];
      return all.indexOf(element);
    })));
  expect(order).toEqual([...order].sort((left, right) => left - right));

  await name.fill('  Home base  ');
  await expect(address).toHaveText('6 RIDGE ROAD KALORAMA 3766');
});

test('AC1 preserves whitespace names in memory only', async ({ page }) => {
  await page.goto(HARNESS_URL);
  await page.getByLabel('Place name').fill('   ');
  await page.getByRole('button', { name: 'Save this place' }).click();

  await expect.poll(() => page.evaluate(() => window.__confirmedPlace)).toEqual({
    name: '   ',
    address: '6 RIDGE ROAD KALORAMA 3766',
    lat: -37.817939,
    lon: 145.36594,
  });
  expect(await storageState(page)).toEqual({
    indexedDbNames: [],
    localStorageLength: 0,
    sessionStorageLength: 0,
  });
});

test('AC1 search again retains nothing and makes no request', async ({ page }) => {
  await page.goto(HARNESS_URL);
  let requests = 0;
  page.on('request', () => requests += 1);

  await page.getByRole('button', { name: 'Search again' }).click();

  expect(await page.evaluate(() => window.__searchAgainCount)).toBe(1);
  expect(await page.evaluate(() => window.__confirmedPlace)).toBeUndefined();
  expect(await storageState(page)).toEqual({
    indexedDbNames: [],
    localStorageLength: 0,
    sessionStorageLength: 0,
  });
  expect(requests).toBe(0);
});

test('AC1 abandonment retains no edited or pending value', async ({ page }) => {
  await page.goto(HARNESS_URL);
  await page.getByLabel('Place name').fill('Not retained');
  await page.reload();

  await expect(page.getByLabel('Place name')).toHaveValue('KALORAMA');
  expect(await page.evaluate(() => window.__confirmedPlace)).toBeUndefined();
  expect(await storageState(page)).toEqual({
    indexedDbNames: [],
    localStorageLength: 0,
    sessionStorageLength: 0,
  });
});

test('AC1 keyboard order, focus and targets are accessible', async ({ page }) => {
  await page.goto(HARNESS_URL);

  for (const target of [
    page.getByLabel('Place name'),
    page.getByRole('button', { name: 'Save this place' }),
    page.getByRole('button', { name: 'Search again' }),
  ]) {
    await page.keyboard.press('Tab');
    await expect(target).toBeFocused();
    expect(await target.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe('none');
  }

  for (const button of [
    page.getByRole('button', { name: 'Save this place' }),
    page.getByRole('button', { name: 'Search again' }),
  ]) {
    const box = await button.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
});

test('AC1 text and controls meet WCAG AA contrast', async ({ page }) => {
  await page.goto(HARNESS_URL);

  const ratios = await page.locator('[data-testid="returned-address"], label, button').evaluateAll(
    (elements) => {
      function channel(value: number) {
        const normalised = value / 255;
        return normalised <= 0.04045
          ? normalised / 12.92
          : ((normalised + 0.055) / 1.055) ** 2.4;
      }

      function luminance(value: string) {
        const channels = value.match(/[\d.]+/g)?.slice(0, 3).map(Number);
        if (!channels || channels.length !== 3) throw new Error('Expected an RGB colour');
        return 0.2126 * channel(channels[0])
          + 0.7152 * channel(channels[1])
          + 0.0722 * channel(channels[2]);
      }

      return elements.map((element) => {
        const foreground = luminance(getComputedStyle(element).color);
        let backgroundElement: Element | null = element;
        let background = luminance(getComputedStyle(element).backgroundColor);

        while (background === 0 && backgroundElement.parentElement) {
          backgroundElement = backgroundElement.parentElement;
          background = luminance(getComputedStyle(backgroundElement).backgroundColor);
        }

        return (Math.max(foreground, background) + 0.05)
          / (Math.min(foreground, background) + 0.05);
      });
    },
  );

  for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5);
});
