import { expect, test, type Page } from '@playwright/test';
import { addressFeature, HARNESS, storageState, WFS_PATTERN } from './helpers';

const SEARCH_URL = `${HARNESS}/search`;

// The search now runs on typing, so filling the field IS the search. The explicit
// Search button remains and is exercised separately, below.
async function search(page: Page, query = 'RIDGE') {
  await page.goto(SEARCH_URL);
  await page.getByLabel('Address').fill(query);
}

/** Count every request that reaches the address service, and answer them all
 * with `features`. Returned so a test can assert how many left the device. */
async function countAddressRequests(page: Page, features: unknown[] = []) {
  const requests: string[] = [];
  await page.route(WFS_PATTERN, (route) => {
    requests.push(new URL(route.request().url()).searchParams.get('CQL_FILTER') ?? '');
    return route.fulfill({ json: { type: 'FeatureCollection', features } });
  });
  return requests;
}

/** The address input. Explicit, because the candidate list and its section are
 * also labelled with the word 'Address' once results are on screen. */
function addressField(page: Page) {
  return page.getByLabel('Address', { exact: true });
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
  expect(await storageState(page)).toEqual({
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
    'No matching address found — check the spelling or try the nearest cross street.',
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
  expect(await storageState(page)).toEqual({
    indexedDbNames: [], localStorageLength: 0, sessionStorageLength: 0,
  });
});

test('AC4 maps genuine browser offline mode to the same state', async ({ page, context }) => {
  await page.goto(SEARCH_URL);
  // Offline BEFORE the first keystroke: typing is what sends the request now, so
  // going offline afterwards would race the search it is meant to prevent.
  await context.setOffline(true);
  await page.getByLabel('Address').fill('RIDGE');

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
  const tryAgain = page.getByRole('button', { name: 'Try again' });
  await expect(tryAgain).toBeVisible();
  expect(requests).toBe(1);
  await tryAgain.click();
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
  expect(await storageState(page)).toEqual({
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


// ── E1-US1-AC2 live suggestions while typing ────────────────────────────────
// vicmap-address.txt USE 1: the search runs at runtime, while the user types, at
// three characters or more. The three outcome states are asserted separately —
// still typing, answered with nothing, and could not run — because conflating
// them is exactly how a live search starts telling people their address does not
// exist while it is still asking.

const NO_MATCH_SENTENCE =
  'No matching address found — check the spelling or try the nearest cross street.';

test('AC2 searches while typing, with no submit', async ({ page }) => {
  const requests = await countAddressRequests(page, [
    addressFeature('6 RIDGE ROAD KALORAMA 3766', 'KALORAMA', 145.36594, -37.817939),
  ]);

  await page.goto(SEARCH_URL);
  await page.getByLabel('Address').pressSequentially('RIDGE', { delay: 30 });

  await expect(page.getByRole('list', { name: 'Address candidates' }).getByRole('button'))
    .toHaveText(['6 RIDGE ROAD KALORAMA 3766']);
  // The field is still the field: a live list must not take the screen away from
  // the text it is answering.
  await expect(addressField(page)).toHaveValue('RIDGE');
  expect(requests).toHaveLength(1);
});

test('AC2 sends nothing below the minimum, and says what to do instead', async ({ page }) => {
  const requests = await countAddressRequests(page);

  await page.goto(SEARCH_URL);
  await expect(page.getByRole('status')).toHaveText('Enter at least 3 characters.');

  await page.getByLabel('Address').pressSequentially('RI', { delay: 30 });
  await page.waitForTimeout(600);

  await expect(page.getByRole('status')).toHaveText('Enter at least 3 characters.');
  await expect(page.getByRole('list', { name: 'Address candidates' })).toHaveCount(0);
  await expect(page.getByRole('status')).not.toContainText('Searching');
  await expect(page.getByRole('status')).not.toContainText(NO_MATCH_SENTENCE);
  expect(requests).toEqual([]);
});

test('AC2 debounce collapses a typing burst into one request', async ({ page }) => {
  const requests = await countAddressRequests(page, [
    addressFeature('6 RIDGE ROAD KALORAMA 3766', 'KALORAMA', 145.36594, -37.817939),
  ]);

  await page.goto(SEARCH_URL);
  await page.getByLabel('Address').pressSequentially('RIDGE ROAD KALORAMA', { delay: 20 });
  await expect(page.getByRole('list', { name: 'Address candidates' })).toBeVisible();
  await page.waitForTimeout(600);

  // Nineteen characters, one outbound query — the debounce is what bounds the
  // request volume, and it is the last text typed that is asked about.
  expect(requests).toHaveLength(1);
  expect(requests[0]).toContain('RIDGE ROAD KALORAMA');
});

test('AC2 state (a): while a search is pending, nothing is claimed about a result', async ({ page }) => {
  let release = () => {};
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route(WFS_PATTERN, async (route) => {
    await held;
    return route.fulfill({ json: { type: 'FeatureCollection', features: [] } });
  });

  await page.goto(SEARCH_URL);
  await page.getByLabel('Address').fill('RIDGE');

  const status = page.getByRole('status');
  await expect(status).toHaveText('Searching for addresses.');
  await expect(status).not.toContainText(NO_MATCH_SENTENCE);
  await expect(status).not.toContainText('We could not search');
  await expect(status).not.toContainText('returned');
  await expect(page.getByRole('list', { name: 'Address candidates' })).toHaveCount(0);
  // No spinner, anywhere, in any state of this screen.
  await expect(page.locator('.spinner, [role="progressbar"], svg[class*="spin"]')).toHaveCount(0);

  release();
  await expect(status).toHaveText(NO_MATCH_SENTENCE);
});

test('AC2 state (b): a search that ran and returned nothing gets the mandated sentence', async ({ page }) => {
  await countAddressRequests(page, []);
  await search(page, 'NOT A REGISTER ADDRESS');

  await expect(page.getByRole('status')).toHaveText(NO_MATCH_SENTENCE);
  await expect(page.getByLabel('Address')).toHaveValue('NOT A REGISTER ADDRESS');
});

test('AC2 state (c): a search that could not run never borrows the no-match sentence', async ({ page }) => {
  await page.route(WFS_PATTERN, (route) => route.abort('failed'));
  await search(page);

  const status = page.getByRole('status');
  await expect(status).toContainText('We could not search for this address right now.');
  await expect(status).toContainText(
    'This is not the same as saying the address is not there. Try again when you have a connection.',
  );
  await expect(status).not.toContainText(NO_MATCH_SENTENCE);
  await expect(status).not.toContainText('No matching address found');
});

test('AC2 a stale response can never overwrite a newer one', async ({ page }) => {
  const STALE = '3 RIDGEWAY STREET KALORAMA 3766';
  const FRESH = '6 RIDGE ROAD KALORAMA 3766';
  const failed: string[] = [];
  let releaseStale = () => {};
  let staleRequestStarted = () => {};
  const staleHeld = new Promise<void>((resolve) => { releaseStale = resolve; });
  const staleReached = new Promise<void>((resolve) => { staleRequestStarted = resolve; });

  await page.route(WFS_PATTERN, async (route) => {
    const filter = new URL(route.request().url()).searchParams.get('CQL_FILTER') ?? '';
    const isFirst = filter.includes("'RID%'");
    if (isFirst) {
      staleRequestStarted();
      await staleHeld;
    }
    // A reply to a request the browser has already cancelled is simply dropped.
    await route.fulfill({ json: { type: 'FeatureCollection', features: [
      addressFeature(isFirst ? STALE : FRESH, 'KALORAMA', 145.36594, -37.817939),
    ] } }).catch(() => undefined);
  });

  // The browser's own record of a cancelled request, not the app's opinion of it.
  page.on('requestfailed', (request) => {
    failed.push(`${decodeURIComponent(request.url())} ${request.failure()?.errorText ?? ''}`);
  });

  await page.goto(SEARCH_URL);
  const field = addressField(page);
  await field.fill('RID');
  // Wait until the first query is genuinely in flight — otherwise the debounce
  // alone would prevent it, and the cancellation path would go untested.
  await staleReached;
  await field.fill('RIDGE');

  await expect(page.getByRole('list', { name: 'Address candidates' }).getByRole('button'))
    .toHaveText([FRESH]);

  // Now let the superseded response go. It answers text the user has moved past
  // and must not reach the screen, whatever order the two replies arrive in.
  releaseStale();
  await page.waitForTimeout(500);
  await expect(page.getByRole('list', { name: 'Address candidates' }).getByRole('button'))
    .toHaveText([FRESH]);
  await expect(page.getByText(STALE)).toHaveCount(0);
  await expect(page.getByRole('status'))
    .toContainText('returned 1 record; 1 distinct address is listed below.');

  // And it was cancelled on the wire, not merely ignored on arrival: the browser
  // recorded the superseded request as aborted the moment the query changed.
  expect(failed.some((entry) =>
    entry.includes("'RID%'") && entry.includes('net::ERR_ABORTED'))).toBe(true);
});

test('AC2 states how many records the register returned and that ten is a cap', async ({ page }) => {
  const ten = Array.from({ length: 10 }, (_, index) =>
    addressFeature(`${index + 1} RIDGE ROAD KALORAMA 3766`, 'KALORAMA', 145.36 + index / 1000, -37.81));
  await countAddressRequests(page, ten);
  await search(page);

  const status = page.getByRole('status');
  await expect(status).toContainText(
    'The address register returned 10 records; 10 distinct addresses are listed below.',
  );
  await expect(status).toContainText(
    'Cooeee asks the register for at most 10 records, so there may be more. '
    + 'Type more of the address to shorten the list.',
  );
  // The stated number of lines is the number of lines.
  await expect(page.getByRole('list', { name: 'Address candidates' }).getByRole('listitem'))
    .toHaveCount(10);
});

test('AC2 a short result names its own size and claims no cap', async ({ page }) => {
  await countAddressRequests(page, [
    addressFeature('6 RIDGE ROAD KALORAMA 3766', 'KALORAMA', 145.36594, -37.817939),
  ]);
  await search(page);

  const status = page.getByRole('status');
  await expect(status).toContainText(
    'The address register returned 1 record; 1 distinct address is listed below.',
  );
  await expect(status).not.toContainText('at most');
});

test('AC2 the count is announced in a polite live region when the list changes', async ({ page }) => {
  await page.route(WFS_PATTERN, (route) => {
    const filter = new URL(route.request().url()).searchParams.get('CQL_FILTER') ?? '';
    const count = filter.includes("'RIDGE R%'") ? 1 : 3;
    return route.fulfill({ json: { type: 'FeatureCollection', features:
      Array.from({ length: count }, (_, index) =>
        addressFeature(`${index + 1} RIDGE ROAD KALORAMA 3766`, 'KALORAMA', 145.36 + index / 1000, -37.81)) } });
  });

  await page.goto(SEARCH_URL);
  const status = page.getByRole('status');
  await expect(status).toHaveAttribute('aria-live', 'polite');

  await page.getByLabel('Address').fill('RIDGE');
  await expect(status).toContainText('returned 3 records; 3 distinct addresses are listed below.');

  // The list changes under the user's hands; the region carries the new count so
  // a screen-reader user is told the list changed without moving focus to it.
  await addressField(page).fill('RIDGE R');
  await expect(status).toContainText('returned 1 record; 1 distinct address is listed below.');
});

test('AC2 dismissal lasts until the query changes', async ({ page }) => {
  await countAddressRequests(page, [
    addressFeature('6 RIDGE ROAD KALORAMA 3766', 'KALORAMA', 145.36594, -37.817939),
  ]);
  await search(page);

  const list = page.getByRole('list', { name: 'Address candidates' });
  await expect(list).toBeVisible();
  await page.getByRole('button', { name: 'None of these is my address' }).click();

  // Dismissed: no list, no claim about a result either way, and the typed text
  // is still there to correct.
  await expect(list).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText(
    'Check or add a unit or street number, then search again.',
  );
  await expect(page.getByLabel('Address')).toHaveValue('RIDGE');

  // One more character is a new query, so the list comes back.
  await addressField(page).pressSequentially(' R', { delay: 30 });
  await expect(list).toBeVisible();
});

test('AC2 the Search button still forces the search, without doubling requests', async ({ page }) => {
  const requests = await countAddressRequests(page, [
    addressFeature('6 RIDGE ROAD KALORAMA 3766', 'KALORAMA', 145.36594, -37.817939),
  ]);

  await page.goto(SEARCH_URL);
  await page.getByLabel('Address').fill('RIDGE');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Address candidates' })).toBeVisible();
  await page.waitForTimeout(600);
  expect(requests).toHaveLength(1);

  // Enter does the same, and re-asking the register for the same text is the
  // user's call, not something the screen does on its own.
  await addressField(page).press('Enter');
  await expect(page.getByRole('list', { name: 'Address candidates' })).toBeVisible();
  await page.waitForTimeout(600);
  expect(requests).toHaveLength(2);
});

// ── E1-US1-AC2 live search: what leaves and what stays ──────────────────────
// The typed prefix now leaves the device more often than it did under an
// explicit submit, so both halves of the privacy rule are asserted directly.

test('AC2 typing sends the query and nothing else, to nowhere else', async ({ page }) => {
  const outbound: string[] = [];
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
      outbound.push(`${request.method()} ${url.origin}${url.pathname} ${request.postData() ?? ''}`);
      return route.fulfill({ json: { type: 'FeatureCollection', features: [] } });
    }
    return route.fallback();
  });

  await page.goto(SEARCH_URL);
  await addressField(page).pressSequentially('6 RIDGE ROAD', { delay: 20 });
  await expect(page.getByRole('status')).toContainText('No matching address found');

  // One endpoint, one method, no body: the address register's own WFS.
  expect(outbound).toEqual([
    'GET https://opendata.maps.vic.gov.au/geoserver/wfs ',
  ]);
});

test('AC2 nothing typed, returned or rejected is written to the device', async ({ page }) => {
  await page.route(WFS_PATTERN, (route) => route.fulfill({ json: {
    type: 'FeatureCollection',
    features: [addressFeature('6 RIDGE ROAD KALORAMA 3766', 'KALORAMA', 145.36594, -37.817939)],
  } }));

  await page.goto(SEARCH_URL);
  const field = addressField(page);
  // A search history if one were ever kept: several queries, a rejected list and
  // a correction, all before anything is confirmed.
  for (const query of ['RID', 'RIDGE', 'RIDGE ROAD', 'KALORAMA']) {
    await field.fill(query);
    await expect(page.getByRole('list', { name: 'Address candidates' })).toBeVisible();
  }
  await page.getByRole('button', { name: 'None of these is my address' }).click();
  await field.fill('RIDGE');

  expect(await storageState(page)).toEqual({
    indexedDbNames: [], localStorageLength: 0, sessionStorageLength: 0,
  });
});