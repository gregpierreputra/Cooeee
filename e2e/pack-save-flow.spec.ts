import { expect, test, type Page, type Route } from '@playwright/test';

// The real production journey, against the real built app (baseURL), not the
// disconnected test harness. Only the official WFS endpoint is intercepted —
// everything else (routing, IndexedDB, the service worker shell) is real.

const WFS_PATTERN = 'https://opendata.maps.vic.gov.au/geoserver/wfs**';
const ADDRESS = '6 RIDGE ROAD KALORAMA 3766';
const LGA_NAME = 'YARRA RANGES';

function addressFeature(address: string, locality: string, lon: number, lat: number) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: {
      ezi_address: address,
      locality_name: locality,
      property_status: 'A',
      is_primary: 'Y',
    },
  };
}

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
  await expect(page.locator('.pack-size')).toContainText('Map tiles 0 KB');
  await expect(page.getByRole('button', { name: 'Download both' })).toBeDisabled();

  await page.getByRole('button', { name: 'Text only' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Place saved');
  await expect(page.getByTestId('saved-address')).toHaveText(ADDRESS);
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('Saved without map tiles');
  await expect(page.getByText(
    'Maps were not downloaded. Everything else in this pack works offline.',
  )).toBeVisible();

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
  await expect(page.getByText(ADDRESS)).toBeVisible();
});

test('AC8 replace atomically supersedes the previous pack', async ({ page }) => {
  await mockOfficialServices(page, {
    candidates: [addressFeature(ADDRESS, 'KALORAMA', 145.36594, -37.817939)],
    lgaName: LGA_NAME,
    bpaHits: [bpaHitFeature(LGA_NAME)],
  });
  await searchConfirmAndReachOffer(page);
  await page.getByRole('button', { name: 'Text only' }).click();
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
  await page.getByRole('button', { name: 'Text only' }).click();
  await page.getByRole('button', { name: 'Open saved pack' }).click();

  expect(page.url()).not.toBe(firstPackUrl);
  await expect(page.locator('.pack-detail')).toContainText(NEW_ADDRESS);

  await page.goto('/');
  await expect(page.getByText(NEW_ADDRESS)).toBeVisible();
  await expect(page.getByText(ADDRESS, { exact: true })).toHaveCount(0);
});