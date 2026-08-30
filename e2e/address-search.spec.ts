import { expect, test, type Page } from '@playwright/test';

const SEARCH_URL = 'http://127.0.0.1:4174/search';
const WFS_PATTERN = 'https://opendata.maps.vic.gov.au/geoserver/wfs**';

function addressFeature(
  address: string,
  locality: string,
  lon: number,
  lat: number,
  isPrimary: 'Y' | 'N' = 'Y',
) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: {
      ezi_address: address,
      locality_name: locality,
      property_status: 'A',
      is_primary: isPrimary,
    },
  };
}

async function search(page: Page, query = 'RIDGE') {
  await page.goto(SEARCH_URL);
  await page.getByLabel('Address').fill(query);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
}

async function storageIsEmpty(page: Page) {
  return page.evaluate(async () => ({
    indexedDbNames: (await indexedDB.databases()).map(({ name }) => name),
    localStorageLength: localStorage.length,
    sessionStorageLength: sessionStorage.length,
  }));
}

test('AC2 lists every returned candidate in service order with no selection', async ({ page }) => {
  const addresses = [
    '6 RIDGE ROAD KALORAMA 3766',
    '8 RIDGE ROAD KALORAMA 3766',
    '10 RIDGE ROAD KALORAMA 3766',
  ];
  await page.route(WFS_PATTERN, (route) => route.fulfill({
    json: { type: 'FeatureCollection', features: addresses.map((address, index) =>
      addressFeature(address, 'KALORAMA', 145.36 + index / 100, -37.81)) },
  }));

  await search(page);

  await expect(page.getByRole('heading', { name: 'Choose your address from the list.' })).toBeVisible();
  const list = page.getByRole('list', { name: 'Address candidates' });
  await expect(list.getByRole('listitem')).toHaveCount(3);
  await expect(list.getByRole('button')).toHaveText(addresses);
  for (const button of await list.getByRole('button').all()) {
    await expect(button).not.toHaveAttribute('aria-pressed');
    await expect(button).not.toBeFocused();
  }
});

test('AC2 keeps a single result as an unselected one-item list', async ({ page }) => {
  await page.route(WFS_PATTERN, (route) => route.fulfill({ json: {
    type: 'FeatureCollection',
    features: [addressFeature('6 RIDGE ROAD KALORAMA 3766', 'KALORAMA', 145.36, -37.81)],
  } }));

  await search(page);
  await expect(page.getByRole('listitem')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Is this the place you want to save?' })).toHaveCount(0);
});

test('AC2 none-of-these returns to editable search and retains nothing', async ({ page }) => {
  await page.route(WFS_PATTERN, (route) => route.fulfill({ json: {
    type: 'FeatureCollection',
    features: [addressFeature('6 RIDGE ROAD KALORAMA 3766', 'KALORAMA', 145.36, -37.81)],
  } }));

  await search(page);
  await page.getByRole('button', { name: 'None of these is my address' }).click();

  await expect(page.getByLabel('Address')).toHaveValue('RIDGE');
  expect(await storageIsEmpty(page)).toEqual({
    indexedDbNames: [], localStorageLength: 0, sessionStorageLength: 0,
  });
});

test('AC3 distinguishes a valid empty response and retains the typed text', async ({ page }) => {
  let requests = 0;
  await page.route(WFS_PATTERN, (route) => {
    requests += 1;
    return route.fulfill({ json: { type: 'FeatureCollection', features: [] } });
  });

  await search(page, 'NOT A REGISTER ADDRESS');

  await expect(page.getByRole('status')).toHaveText(
    'No matching address found - check the spelling or try the nearest cross street.',
  );
  await expect(page.getByLabel('Address')).toHaveValue('NOT A REGISTER ADDRESS');
  await expect(page.getByRole('button', { name: 'Search again' })).toBeVisible();
  await expect(page.getByText(/Did you mean|locality|parent suburb/i)).toHaveCount(0);
  expect(requests).toBe(1);
});

test('AC3 remains readable at 200 percent text size', async ({ page }) => {
  await page.route(WFS_PATTERN, (route) => route.fulfill({
    json: { type: 'FeatureCollection', features: [] },
  }));
  await search(page, 'UNKNOWN ADDRESS');
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });

  const result = page.getByRole('status');
  await expect(result).toBeVisible();
  expect(await result.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
});

test('AC4 maps a service failure to both honesty sentences and no saved place', async ({ page }) => {
  await page.route(WFS_PATTERN, (route) => route.abort('failed'));
  await search(page);

  const status = page.getByRole('status');
  await expect(status).toContainText('We could not search for this address right now.');
  await expect(status).toContainText(
    'This is not the same as saying the address is not there. Try again when you have a connection.',
  );
  await expect(status).not.toContainText(/no results|none found|not found|no match/i);
  await expect(page.getByLabel('Address')).toHaveValue('RIDGE');
  expect(await storageIsEmpty(page)).toEqual({
    indexedDbNames: [], localStorageLength: 0, sessionStorageLength: 0,
  });
});

test('AC4 maps genuine browser offline mode to the same state', async ({ page, context }) => {
  await page.goto(SEARCH_URL);
  await page.getByLabel('Address').fill('RIDGE');
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Search', exact: true }).click();

  await expect(page.getByRole('status')).toContainText(
    'We could not search for this address right now.',
  );
  await context.setOffline(false);
});

test('AC4 retry is explicit and issues exactly one new request', async ({ page }) => {
  let requests = 0;
  await page.route(WFS_PATTERN, (route) => {
    requests += 1;
    return requests === 1
      ? route.abort('failed')
      : route.fulfill({ json: { type: 'FeatureCollection', features: [] } });
  });

  await search(page);
  expect(requests).toBe(1);
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('status')).toContainText('No matching address found');
  expect(requests).toBe(2);
});

// ── E1-US1-AC2 duplicate visible candidates ─────────────────────────────────
// Vicmap can return one ezi_address more than once. Identical points collapse;
// conflicting points with no single flagged record are never guessed at.

const DUP = '6 RIDGE ROAD KALORAMA 3766';
const AMBIGUITY_REASON =
  'The address register holds multiple map locations for the same written address, so Cooeee cannot choose one.';
const REFINE_HINT = 'Check or add a unit or street number, then search again.';

async function searchWith(page: Page, features: unknown[], query = 'RIDGE') {
  const officialCalls: string[] = [];
  await page.route(WFS_PATTERN, (route) => {
    officialCalls.push(new URL(route.request().url()).searchParams.get('typeNames') ?? '');
    return route.fulfill({ json: { type: 'FeatureCollection', features } });
  });
  await search(page, query);
  return officialCalls;
}

test('AC2 collapses one repeated address returned at a single point', async ({ page }) => {
  await searchWith(page, [
    addressFeature(DUP, 'KALORAMA', 145.36594, -37.817939, 'N'),
    addressFeature(DUP, 'KALORAMA', 145.36594, -37.817939, 'Y'),
    addressFeature('8 RIDGE ROAD KALORAMA 3766', 'KALORAMA', 145.366, -37.818),
  ]);

  const list = page.getByRole('list', { name: 'Address candidates' });
  await expect(list.getByRole('button')).toHaveText([DUP, '8 RIDGE ROAD KALORAMA 3766']);
  await expect(page.getByText(AMBIGUITY_REASON)).toHaveCount(0);
});

test('AC2 keeps different unit and street numbers as separate lines', async ({ page }) => {
  const distinct = [
    '1/6 RIDGE ROAD KALORAMA 3766',
    '2/6 RIDGE ROAD KALORAMA 3766',
    DUP,
    '6A RIDGE ROAD KALORAMA 3766',
    '16 RIDGE ROAD KALORAMA 3766',
  ];
  await searchWith(page, distinct.map((address) =>
    addressFeature(address, 'KALORAMA', 145.36594, -37.817939)));

  await expect(page.getByRole('list', { name: 'Address candidates' }).getByRole('button'))
    .toHaveText(distinct);
});

test('AC2 retains the one flagged record when the points conflict', async ({ page }) => {
  await searchWith(page, [
    addressFeature(DUP, 'KALORAMA', 145.36594, -37.817939, 'N'),
    addressFeature(DUP, 'KALORAMA', 145.365951, -37.817944, 'Y'),
  ]);

  await expect(page.getByRole('list', { name: 'Address candidates' }).getByRole('button'))
    .toHaveText([DUP]);
  await expect(page.getByText(AMBIGUITY_REASON)).toHaveCount(0);
});

test('AC2 never guesses a point when conflicting records carry no flag', async ({ page }) => {
  const officialCalls = await searchWith(page, [
    addressFeature(DUP, 'KALORAMA', 145.36594, -37.817939, 'N'),
    addressFeature(DUP, 'KALORAMA', 145.365951, -37.817944, 'N'),
  ]);

  // The honest ambiguity state, not an empty screen and not a silent pick.
  await expect(page.getByRole('heading', {
    name: 'One address could not be matched to a single map location.',
  })).toBeVisible();
  await expect(page.getByText(AMBIGUITY_REASON)).toBeVisible();
  await expect(page.getByText(REFINE_HINT)).toBeVisible();

  // No selectable candidate, so no confirmation and no coordinate anywhere.
  await expect(page.getByRole('list', { name: 'Address candidates' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: DUP })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Is this the place you want to save?' }))
    .toHaveCount(0);
  await expect(page.locator('main')).not.toContainText(/145\.|-37\.|pfi/i);

  // The area check never ran and nothing was written.
  expect(officialCalls).toEqual(['open-data-platform:address']);
  expect(await storageIsEmpty(page)).toEqual({
    indexedDbNames: [], localStorageLength: 0, sessionStorageLength: 0,
  });

  // A way forward that does not invent an answer.
  await page.getByRole('button', { name: 'Search again' }).click();
  await expect(page.getByLabel('Address')).toHaveValue('RIDGE');
});

test('AC2 treats more than one flagged record at conflicting points as unresolved', async ({ page }) => {
  await searchWith(page, [
    addressFeature(DUP, 'KALORAMA', 145.36594, -37.817939, 'Y'),
    addressFeature(DUP, 'KALORAMA', 145.365951, -37.817944, 'Y'),
  ]);

  await expect(page.getByText(AMBIGUITY_REASON)).toBeVisible();
  await expect(page.getByRole('button', { name: DUP })).toHaveCount(0);
});

test('AC2 withholds only the unresolved address and still lists the rest', async ({ page }) => {
  await searchWith(page, [
    addressFeature('4 RIDGE ROAD KALORAMA 3766', 'KALORAMA', 145.365, -37.817),
    addressFeature(DUP, 'KALORAMA', 145.36594, -37.817939, 'N'),
    addressFeature(DUP, 'KALORAMA', 145.365951, -37.817944, 'N'),
    addressFeature('8 RIDGE ROAD KALORAMA 3766', 'KALORAMA', 145.366, -37.818),
  ]);

  await expect(page.getByRole('heading', { name: 'Choose your address from the list.' }))
    .toBeVisible();
  await expect(page.getByRole('list', { name: 'Address candidates' }).getByRole('button'))
    .toHaveText(['4 RIDGE ROAD KALORAMA 3766', '8 RIDGE ROAD KALORAMA 3766']);
  await expect(page.getByText(AMBIGUITY_REASON)).toBeVisible();
  await expect(page.getByRole('button', { name: 'None of these is my address' })).toBeVisible();
});

test('AC2 counts more than one unresolved address without ranking them', async ({ page }) => {
  await searchWith(page, [
    addressFeature(DUP, 'KALORAMA', 145.36594, -37.817939, 'N'),
    addressFeature(DUP, 'KALORAMA', 145.365951, -37.817944, 'N'),
    addressFeature('8 RIDGE ROAD KALORAMA 3766', 'KALORAMA', 145.366, -37.818, 'N'),
    addressFeature('8 RIDGE ROAD KALORAMA 3766', 'KALORAMA', 145.3661, -37.8181, 'N'),
  ]);

  await expect(page.getByRole('heading', {
    name: '2 addresses could not be matched to a single map location.',
  })).toBeVisible();
  await expect(page.locator('main')).not.toContainText(/best|closest|likely|score/i);
});
