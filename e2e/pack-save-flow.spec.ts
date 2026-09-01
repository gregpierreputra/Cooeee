import { expect, test, type Page, type Route } from '@playwright/test';
import { OPEN_PACK, SAVED_PLACE_LABEL } from '../src/core/copy';
import { displayAddress } from '../src/core/home';
import { addressFeature, waitForController, WFS_PATTERN } from './helpers';

// The real production journey, against the real built app (baseURL), not the
// disconnected test harness. Only the official WFS endpoint is intercepted —
// everything else (routing, IndexedDB, the service worker shell) is real.

const ADDRESS = '6 RIDGE ROAD KALORAMA 3766';
const LGA_NAME = 'YARRA RANGES';

async function mockOfficialServices(page: Page, opts: {
  candidates: unknown[];
  lgaName: string;
  bpaHits: unknown[];
}) {
  await page.route(WFS_PATTERN, (route: Route) => {
    const typeNames = new URL(route.request().url()).searchParams.get('typeNames');
    if (typeNames === 'open-data-platform:address') {
      return route.fulfill({ json: { type: 'FeatureCollection', features: opts.candidates } });
    }
    if (typeNames === 'open-data-platform:lga_polygon') {
      return route.fulfill({
        json: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { lga_name: opts.lgaName } }] },
      });
    }
    if (typeNames === 'open-data-platform:bushfire_prone_area') {
      return route.fulfill({ json: { type: 'FeatureCollection', features: opts.bpaHits } });
    }
    return route.continue();
  });
}

function bpaHitFeature(lgaName: string) {
  return {
    type: 'Feature',
    properties: { lga_name: lgaName, plan_number: 'LEGL./25-138', gazettal_date: '10/07/2025' },
  };
}

async function searchConfirmAndReachOffer(page: Page, name = 'Kalorama') {
  await page.goto('/packs/new');
  await page.getByLabel('Address').fill('RIDGE');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('button', { name: ADDRESS }).click();
  await page.getByLabel('Place name').fill(name);
  await page.getByRole('button', { name: 'Save this place' }).click();
  await expect(page.getByRole('heading')).toHaveText(
    'This address is inside a Designated Bushfire Prone Area.',
  );
  await page.getByRole('button', { name: 'See pack size' }).click();
  await expect(page.getByRole('heading')).toHaveText('Ready to download');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => indexedDB.deleteDatabase('cooeee'));
});

test('AC1/AC9 production journey: search to a saved, reopenable pack', async ({ page }) => {
  await mockOfficialServices(page, {
    candidates: [addressFeature(ADDRESS, 'KALORAMA', 145.36594, -37.817939)],
    lgaName: LGA_NAME,
    bpaHits: [bpaHitFeature(LGA_NAME)],
  });

  await searchConfirmAndReachOffer(page);
  await expect(page.locator('.pack-size')).toContainText('This pack is');
  await page.getByRole('button', { name: 'Save this pack' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Place saved');
  await expect(page.getByTestId('saved-address')).toHaveText(ADDRESS);
  await page.getByRole('button', { name: 'Open saved pack' }).click();
  await expect(page.getByRole('heading', { name: 'Your pack' })).toBeVisible();
  await expect(page.locator('.pack-detail')).toContainText(ADDRESS);
  await expect(page.getByRole('heading', { name: 'Designated Bushfire Prone Area' })).toBeVisible();
  await expect(page.getByText(/Published by Department of Transport and Planning/)).toBeVisible();

  // AC1 TC-1.1.1-B: a full close and reopen still shows the saved place.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your pack' })).toBeVisible();
  await expect(page.locator('.pack-detail')).toContainText(ADDRESS);

  await page.goto('/');
  await expect(page.getByText(displayAddress(ADDRESS))).toBeVisible();
});

test('AC8 replace atomically supersedes the previous pack', async ({ page }) => {
  await mockOfficialServices(page, {
    candidates: [addressFeature(ADDRESS, 'KALORAMA', 145.36594, -37.817939)],
    lgaName: LGA_NAME,
    bpaHits: [bpaHitFeature(LGA_NAME)],
  });
  await searchConfirmAndReachOffer(page);
  await page.getByRole('button', { name: 'Save this pack' }).click();
  await page.getByRole('button', { name: 'Open saved pack' }).click();
  const firstPackUrl = page.url();

  const NEW_ADDRESS = '8 RIDGE ROAD KALORAMA 3766';
  await mockOfficialServices(page, {
    candidates: [addressFeature(NEW_ADDRESS, 'KALORAMA', 145.366, -37.818)],
    lgaName: LGA_NAME,
    bpaHits: [bpaHitFeature(LGA_NAME)],
  });
  await page.goto('/packs/new');
  await page.getByLabel('Address').fill('RIDGE');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('button', { name: NEW_ADDRESS }).click();
  await page.getByRole('button', { name: 'Save this place' }).click();

  await expect(page.getByRole('heading', { name: 'You already have a saved place.' })).toBeVisible();
  await expect(page.getByTestId('saved-address')).toHaveText(ADDRESS);
  await expect(page.getByTestId('new-address')).toHaveText(NEW_ADDRESS);
  await page.getByRole('button', { name: 'Replace it with this one' }).click();

  await expect(page.getByRole('heading')).toHaveText(
    'This address is inside a Designated Bushfire Prone Area.',
  );
  await page.getByRole('button', { name: 'See pack size' }).click();
  await page.getByRole('button', { name: 'Save this pack' }).click();
  await page.getByRole('button', { name: 'Open saved pack' }).click();

  expect(page.url()).not.toBe(firstPackUrl);
  await expect(page.locator('.pack-detail')).toContainText(NEW_ADDRESS);

  await page.goto('/');
  await expect(page.getByText(displayAddress(NEW_ADDRESS))).toBeVisible();
  await expect(page.getByText(displayAddress(ADDRESS), { exact: true })).toHaveCount(0);
});

// ── E1-US2 pack-detail return path ──────────────────────────────────────────

const BACK = 'Back to Your packs';

async function saveAPackAndOpenIt(page: Page) {
  await mockOfficialServices(page, {
    candidates: [addressFeature(ADDRESS, 'KALORAMA', 145.36594, -37.817939)],
    lgaName: LGA_NAME,
    bpaHits: [bpaHitFeature(LGA_NAME)],
  });
  await searchConfirmAndReachOffer(page);
  await page.getByRole('button', { name: 'Save this pack' }).click();
  await page.getByRole('button', { name: 'Open saved pack' }).click();
  await expect(page.getByRole('heading', { name: 'Your pack' })).toBeVisible();
}

test('US2 the pack detail offers an explicit return to the pack list', async ({ page }) => {
  await saveAPackAndOpenIt(page);

  const back = page.getByRole('link', { name: BACK });
  await expect(back).toBeVisible();
  await expect(back).toHaveAttribute('href', '/');

  await back.click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(SAVED_PLACE_LABEL)).toBeVisible();
  await expect(page.getByText(displayAddress(ADDRESS))).toBeVisible();
});

test('US2 the return action is keyboard operable and meets the touch target', async ({ page }) => {
  await saveAPackAndOpenIt(page);
  const back = page.getByRole('link', { name: BACK });

  await back.focus();
  await expect(back).toBeFocused();

  const box = await back.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

  // It precedes the pack heading, so it is the first thing reached on the screen.
  expect(await back.evaluate((el) => {
    const h1 = document.querySelector('.pack-detail h1');
    return h1 ? el.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING : 0;
  })).toBeTruthy();

  await back.press('Enter');
  await expect(page.getByText(SAVED_PLACE_LABEL)).toBeVisible();
});

test('US2 the return action works offline and the stored pack survives it', async ({ page, context }) => {
  await saveAPackAndOpenIt(page);
  const packUrl = page.url();
  await waitForController(page);

  const failed: string[] = [];
  page.on('requestfailed', (r) => failed.push(`${r.method()} ${r.url()}`));
  await context.setOffline(true);

  await page.goto(packUrl);
  await expect(page.getByRole('heading', { name: 'Your pack' })).toBeVisible();
  await page.getByRole('link', { name: BACK }).click();

  await expect(page.getByText(SAVED_PLACE_LABEL)).toBeVisible();
  await expect(page.getByText(displayAddress(ADDRESS))).toBeVisible();
  await expect(page.locator('main')).not.toContainText(/Loading|Reconnect|not available/i);
  expect(failed).toEqual([]);

  await context.setOffline(false);
});

test('US2 the pack reopens unchanged after returning to the pack list', async ({ page }) => {
  await saveAPackAndOpenIt(page);
  const before = await page.locator('.pack-detail').innerText();

  await page.getByRole('link', { name: BACK }).click();
  await expect(page.getByText(SAVED_PLACE_LABEL)).toBeVisible();

  // E1-US2-AC6 replaced the pack list with the one-pack Open-or-Build home:
  // the saved place carries one way in, named 'Open'.
  await page.getByRole('link', { name: OPEN_PACK, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your pack' })).toBeVisible();
  expect(await page.locator('.pack-detail').innerText()).toBe(before);

  // A full reload of the detail route is still the same stored pack.
  await page.reload();
  expect(await page.locator('.pack-detail').innerText()).toBe(before);
});