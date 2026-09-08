import { expect, test, type Page, type Route } from '@playwright/test';
import { PLACE_ALREADY_SAVED, REPLACE_SAVED_PACK, SAVED_PLACE_LABEL } from '../src/core/copy';
import { titleCase as displayAddress } from '../src/core/home';
import {
  acknowledgeFirstOpen,
  addressFeature,
  chooseLastResortPlaces,
  waitForController,
  WFS_PATTERN,
  WMS_PATTERN,
} from './helpers';

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
  // The area map from the same host's Web Map Service: the smallest PNG that
  // decodes, so the journey never depends on the live map server.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
    'base64',
  );
  await page.route(WMS_PATTERN, (route: Route) => route.fulfill({ body: png, contentType: 'image/png' }));
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
  await page.getByRole('button', { name: 'Continue' }).click();
  await chooseLastResortPlaces(page);
  await expect(page.getByRole('heading')).toHaveText('Ready to download');
}

test.beforeEach(async ({ page }) => {
  // A returning device: the first-open disclosure (E1-US1-AC0) is already
  // acknowledged, so this spec starts where the save journey starts.
  await acknowledgeFirstOpen(page);
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
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible(); // the bar follows to every page
  await expect(page.locator('.pack-detail')).toContainText(ADDRESS);
  await expect(page.getByRole('heading', { name: 'Designated Bushfire Prone Area' })).toBeVisible();
  await expect(page.getByText(/Published by Department of Transport and Planning/)).toBeVisible();
  // E2-US2: both chosen places are in the saved pack, each with its council.
  const savedPlaces = page.locator('.saved-destinations .card');
  await expect(savedPlaces).toHaveCount(2);
  // The map of the area, from the bytes stored with the pack.
  await expect(page.locator('.area-map img')).toBeVisible();
  await expect(savedPlaces.getByText(/^Responsible council: /)).toHaveCount(2);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  // AC1 TC-1.1.1-B: a full close and reopen still shows the saved place.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your pack' })).toBeVisible();
  await expect(page.locator('.pack-detail')).toContainText(ADDRESS);

  await page.goto('/');
  await expect(page.getByText(displayAddress(ADDRESS))).toBeVisible();
});

test('AC8 the same address asks, and replace atomically supersedes the previous pack', async ({ page }) => {
  await mockOfficialServices(page, {
    candidates: [addressFeature(ADDRESS, 'KALORAMA', 145.36594, -37.817939)],
    lgaName: LGA_NAME,
    bpaHits: [bpaHitFeature(LGA_NAME)],
  });
  await searchConfirmAndReachOffer(page);
  await page.getByRole('button', { name: 'Save this pack' }).click();
  await page.getByRole('button', { name: 'Open saved pack' }).click();
  const firstPackUrl = page.url();

  await page.goto('/packs/new');
  await page.getByLabel('Address').fill('RIDGE');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('button', { name: ADDRESS }).click();
  await page.getByRole('button', { name: 'Save this place' }).click();

  await expect(page.getByRole('heading', { name: PLACE_ALREADY_SAVED })).toBeVisible();
  await expect(page.getByTestId('saved-address')).toHaveText(ADDRESS);
  await page.getByRole('button', { name: REPLACE_SAVED_PACK }).click();

  await expect(page.getByRole('heading')).toHaveText(
    'This address is inside a Designated Bushfire Prone Area.',
  );
  await page.getByRole('button', { name: 'Continue' }).click();
  await chooseLastResortPlaces(page);
  await page.getByRole('button', { name: 'Save this pack' }).click();
  await page.getByRole('button', { name: 'Open saved pack' }).click();

  expect(page.url()).not.toBe(firstPackUrl);
  await page.goto('/');
  await expect(page.locator('.pack-card')).toHaveCount(1);
  await expect(page.getByText(displayAddress(ADDRESS))).toBeVisible();
});

test('a second address becomes a second pack beside the first, with no question asked', async ({ page }) => {
  await mockOfficialServices(page, {
    candidates: [addressFeature(ADDRESS, 'KALORAMA', 145.36594, -37.817939)],
    lgaName: LGA_NAME,
    bpaHits: [bpaHitFeature(LGA_NAME)],
  });
  await searchConfirmAndReachOffer(page);
  await page.getByRole('button', { name: 'Save this pack' }).click();
  await page.getByRole('button', { name: 'Open saved pack' }).click();

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

  await expect(page.getByRole('heading')).toHaveText(
    'This address is inside a Designated Bushfire Prone Area.',
  );
  await page.getByRole('button', { name: 'Continue' }).click();
  await chooseLastResortPlaces(page);
  await page.getByRole('button', { name: 'Save this pack' }).click();
  await page.getByRole('button', { name: 'Open saved pack' }).click();
  await expect(page.locator('.pack-detail')).toContainText(NEW_ADDRESS);

  await page.goto('/');
  await expect(page.locator('.pack-card')).toHaveCount(2);
  await expect(page.getByText(displayAddress(NEW_ADDRESS))).toBeVisible();
  await expect(page.getByText(displayAddress(ADDRESS), { exact: true })).toBeVisible();
});

// ── E1-US2 pack-detail return path ──────────────────────────────────────────
// The return path is the global Back bar at the top of every screen.

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

test('US2 the global Back bar works offline and the stored pack survives it', async ({ page, context }) => {
  await saveAPackAndOpenIt(page);
  const packUrl = page.url();
  await waitForController(page);

  // The home screen refreshes the feed snapshot when the browser says it is
  // online, and Chromium keeps saying so on a worker-served offline reload, so
  // that one same-origin refresh is the only request allowed to fail here. The
  // shell itself asks for nothing.
  const failed: string[] = [];
  page.on('requestfailed', (r) => {
    if (!r.url().includes('/api/')) failed.push(`${r.method()} ${r.url()}`);
  });
  await context.setOffline(true);

  await page.goto(packUrl);
  await expect(page.getByRole('heading', { name: 'Your pack' })).toBeVisible();
  // A fresh document load has history position 0, so the Back bar lands on the
  // pack list via a client-side route change — no document request offline.
  await page.getByRole('button', { name: 'Back' }).click();

  await expect(page.getByText(SAVED_PLACE_LABEL)).toBeVisible();
  await expect(page.getByText(displayAddress(ADDRESS))).toBeVisible();
  await expect(page.locator('main')).not.toContainText(/Loading|Reconnect|not available/i);
  expect(failed).toEqual([]);

  await context.setOffline(false);
});

test('US2 the pack reopens unchanged after returning to the pack list', async ({ page }) => {
  await saveAPackAndOpenIt(page);
  const before = await page.locator('.pack-detail').innerText();

  await page.goto('/');
  await expect(page.getByText(SAVED_PLACE_LABEL)).toBeVisible();

  // The pack card is the way in: its name link stretches over the whole card.
  await page.locator('.pack-card h2 a').click();
  await expect(page.getByRole('heading', { name: 'Your pack' })).toBeVisible();
  expect(await page.locator('.pack-detail').innerText()).toBe(before);

  // A full reload of the detail route is still the same stored pack.
  await page.reload();
  expect(await page.locator('.pack-detail').innerText()).toBe(before);
});