import { expect, test, type Page, type Route } from '@playwright/test';
import { PACK_NAME_TAKEN, PLACE_ALREADY_SAVED, REPLACE_SAVED_PACK } from '../src/core/copy';
import { titleCase as displayAddress } from '../src/core/home';
import {
  acknowledgeFirstOpen,
  addressFeature,
  chooseLastResortPlaces,
  openSources,
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
  await page.getByLabel('Street address').fill('RIDGE');
  await page.getByLabel('Street address').press('Enter');
  await page.getByRole('button', { name: ADDRESS }).click();
  await page.getByLabel('Place name').fill(name);
  await page.getByRole('button', { name: 'Save this place' }).click();
  await expect(page.getByRole('heading')).toHaveText(
    'This address is inside a Bushfire Prone Area.',
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

// A program saved in Recover goes into every new pack with its page copy, with
// no step of its own in the wizard.
test('the wizard carries a saved program into the saved pack', async ({ page }) => {
  await mockOfficialServices(page, {
    candidates: [addressFeature(ADDRESS, 'KALORAMA', 145.36594, -37.817939)],
    lgaName: LGA_NAME,
    bpaHits: [bpaHitFeature(LGA_NAME)],
  });
  await page.evaluate(() => localStorage.setItem('cooeee.kept.v1', '["services-australia-crisis-payment"]'));
  await page.goto('/packs/new');
  await page.getByLabel('Street address').fill('RIDGE');
  await page.getByLabel('Street address').press('Enter');
  await page.getByRole('button', { name: ADDRESS }).click();
  await page.getByLabel('Place name').fill('Kalorama');
  await page.getByRole('button', { name: 'Save this place' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  const boxes = page.getByRole('checkbox');
  await expect(boxes.first()).toBeVisible();
  await boxes.nth(0).check();
  await boxes.nth(1).check();
  await page.getByRole('button', { name: 'Save last-resort places' }).click();
  await page.getByRole('button', { name: 'Keep this note' }).click();

  await expect(page.getByRole('heading')).toHaveText('Ready to download');
  await page.getByRole('button', { name: 'Save this pack' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Place saved');
  await expect(page.getByRole('link', { name: 'Choose programs in Recover' })).toHaveCount(0);
  expect(await page.evaluate(() => window.localStorage.getItem('cooeee.kept.v1'))).toBe('["services-australia-crisis-payment"]');
  await page.getByRole('button', { name: 'Open saved pack' }).click();
  const section = page.locator('.pack-section', { hasText: 'Saved programs' });
  await expect(section.locator('.section-count')).toHaveText('1');
  await section.getByRole('button', { name: 'Show Saved programs' }).click();
  await expect(section.getByRole('link', { name: 'Saved PDF' })).toHaveAttribute('download', /crisis-payment/);
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
  await expect(page.locator('.pack-detail h1')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible(); // the bar follows to every page
  await expect(page.locator('.pack-detail')).toContainText(ADDRESS);
  await expect(page.getByRole('heading', { name: 'Designated Bushfire Prone Area' })).toBeVisible();
  await openSources(page);
  await expect(page.locator('.source-rows', { hasText: 'Department of Transport and Planning' }).first()).toBeVisible();
  // E2-US2: both chosen places are in the saved pack, each with its council.
  const savedPlaces = page.locator('.saved-destinations .card');
  await expect(savedPlaces).toHaveCount(2);
  // The map of the area, from the bytes stored with the pack.
  await expect(page.locator('.area-map img')).toBeVisible();
  // Both chosen places are marked on it, and the buttons zoom and turn it.
  await expect(page.locator('.area-map-mark')).toHaveCount(2);
  const layer = page.locator('.area-map-layer');
  const transform = () => layer.evaluate((el) => (el as HTMLElement).style.transform);
  const home = await transform();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.getByRole('button', { name: 'Turn the map' }).click();
  expect(await transform()).toMatch(/rotate\(45deg\) scale\(1\.6\)/);
  await page.getByRole('button', { name: 'North up, whole map' }).click();
  // Two real fingers, through the browser's touch input: spreading them zooms
  // in, and turning them turns the map.
  await page.locator('.area-map-frame').scrollIntoViewIfNeeded();
  const box = (await page.locator('.area-map-frame').boundingBox())!;
  const [cx, cy] = [box.x + box.width / 2, box.y + box.height / 2];
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', points: [number, number][]) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y], id) => ({ x, y, id })) });
  await touch('touchStart', [[cx - 40, cy], [cx + 40, cy]]);
  await touch('touchMove', [[cx - 70, cy - 30], [cx + 70, cy + 30]]);
  await touch('touchEnd', []);
  expect(await transform()).toMatch(/rotate\((?!0deg)[-\d.]+deg\) scale\((?!1\))[\d.]+\)/);
  await page.getByRole('button', { name: 'North up, whole map' }).click();
  expect(await transform()).toBe(home);
  await expect(savedPlaces.locator('.place-meta')).toHaveCount(2);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  // AC1 TC-1.1.1-B: a full close and reopen still shows the saved place.
  await page.reload();
  await expect(page.locator('.pack-detail h1')).toBeVisible();
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
  // Sampled only once the pack's own address is showing, never the wizard's.
  const PACK_URL = /\/packs\/(?!new$)[^/]+$/;
  await expect(page).toHaveURL(PACK_URL);
  const firstPackUrl = page.url();

  await page.goto('/packs/new');
  await page.getByLabel('Street address').fill('RIDGE');
  await page.getByLabel('Street address').press('Enter');
  await page.getByRole('button', { name: ADDRESS }).click();
  await page.getByRole('button', { name: 'Save this place' }).click();

  await expect(page.getByRole('heading', { name: PLACE_ALREADY_SAVED })).toBeVisible();
  await expect(page.getByTestId('saved-address')).toHaveText(ADDRESS);
  await page.getByRole('button', { name: REPLACE_SAVED_PACK }).click();

  await expect(page.getByRole('heading')).toHaveText(
    'This address is inside a Bushfire Prone Area.',
  );
  await page.getByRole('button', { name: 'Continue' }).click();
  await chooseLastResortPlaces(page);
  await page.getByRole('button', { name: 'Save this pack' }).click();
  await page.getByRole('button', { name: 'Open saved pack' }).click();

  await expect(page).toHaveURL(PACK_URL);
  await expect(page).not.toHaveURL(firstPackUrl);
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
  await page.getByLabel('Street address').fill('RIDGE');
  await page.getByLabel('Street address').press('Enter');
  await page.getByRole('button', { name: NEW_ADDRESS }).click();
  // One name per pack: the suburb is already the first pack's name, so the
  // name step starts on the street instead, in normal case. A name typed over
  // it that another pack has is said, and a different one goes on.
  await expect(page.getByLabel('Place name')).toHaveValue('8 Ridge Road');
  await page.getByLabel('Place name').fill('kalorama');
  await page.getByRole('button', { name: 'Save this place' }).click();
  await expect(page.locator('.field-message')).toHaveText(PACK_NAME_TAKEN);
  await page.getByLabel('Place name').fill('8 Ridge Road');
  await expect(page.locator('.field-message')).toHaveCount(0);
  await page.getByRole('button', { name: 'Save this place' }).click();

  await expect(page.getByRole('heading')).toHaveText(
    'This address is inside a Bushfire Prone Area.',
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

  // With two packs, Back from a pack's rehearsal goes up to the chooser.
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Rehearse', exact: true }).click();
  await page.locator('.condition-list button').first().click();
  await expect(page).toHaveURL(/\/rehearse\/.+/);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page).toHaveURL(/\/rehearse$/);
  await expect(page.locator('.condition-list button')).toHaveCount(2);
});

// An age in words moves on while the screen stays open: a pack saved just now
// reads one minute old a minute later, in the header and on its card.
test('the header and the pack card move from just now to 1 minute ago', async ({ page }) => {
  await page.clock.install();
  await mockOfficialServices(page, {
    candidates: [addressFeature(ADDRESS, 'KALORAMA', 145.36594, -37.817939)],
    lgaName: LGA_NAME,
    bpaHits: [bpaHitFeature(LGA_NAME)],
  });
  await searchConfirmAndReachOffer(page);
  await page.getByRole('button', { name: 'Save this pack' }).click();
  await page.getByRole('button', { name: 'Open saved pack' }).click();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Home', exact: true }).click();

  await expect(page.locator('.app-header-age')).toHaveText('Checked just now');
  await expect(page.locator('.saved-place-footer')).toHaveText('Saved just now');
  await page.clock.fastForward(61_000);
  await expect(page.locator('.app-header-age')).toHaveText('Checked 1 minute ago');
  await expect(page.locator('.saved-place-footer')).toHaveText('Saved 1 minute ago');
});

// Print this pack, from the pack's menu on Home, opens that pack's print page
// in the real app, and Back returns Home.
test('the pack menu opens the pack\'s print page', async ({ page }) => {
  await mockOfficialServices(page, {
    candidates: [addressFeature(ADDRESS, 'KALORAMA', 145.36594, -37.817939)],
    lgaName: LGA_NAME,
    bpaHits: [bpaHitFeature(LGA_NAME)],
  });
  await searchConfirmAndReachOffer(page);
  await page.getByRole('button', { name: 'Save this pack' }).click();
  await page.getByRole('button', { name: 'Open saved pack' }).click();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Settings for Kalorama' }).click();
  await page.getByRole('button', { name: 'Print this pack' }).click();

  await expect(page).toHaveURL(/\/packs\/[^/]+\/print$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kalorama');
  await expect(page.locator('.print-section').first()).toContainText('Bushfire area');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
});

// UR-US36: Back steps back through the builder one step at a time, keeping
// every answer, and the phone's Back button does the same.
test('Back steps back through the pack builder and keeps every answer', async ({ page }) => {
  await mockOfficialServices(page, {
    candidates: [addressFeature(ADDRESS, 'KALORAMA', 145.36594, -37.817939)],
    lgaName: LGA_NAME,
    bpaHits: [bpaHitFeature(LGA_NAME)],
  });
  const back = page.getByRole('button', { name: 'Back', exact: true });
  await page.goto('/');
  await page.getByRole('link', { name: 'New offline pack' }).first().click();
  await page.getByLabel('Street address').fill('RIDGE');
  await page.getByLabel('Street address').press('Enter');
  await page.getByRole('button', { name: ADDRESS }).click();
  await page.getByLabel('Place name').fill('Our house');
  await page.getByRole('button', { name: 'Save this place' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  const boxes = page.getByRole('checkbox');
  await boxes.nth(0).check();
  await boxes.nth(1).check();
  await page.getByRole('button', { name: 'Save last-resort places' }).click();
  await page.getByLabel('Your note').fill('Meet at the oval gate.');
  await page.getByRole('button', { name: 'Keep this note' }).click();
  await expect(page.getByRole('heading')).toHaveText('Ready to download');

  // The Back bar: the size, then the note as written.
  await back.click();
  await expect(page.getByLabel('Your note')).toHaveValue('Meet at the oval gate.');
  // The phone's Back button: the places, with the same two ticked.
  await page.goBack();
  await expect(boxes.nth(0)).toBeChecked();
  await expect(boxes.nth(1)).toBeChecked();
  // The area result, held on the phone, so nothing is asked again.
  await back.click();
  await expect(page.getByRole('heading')).toHaveText('This address is inside a Bushfire Prone Area.');
  // The address, with the name as given.
  await back.click();
  await expect(page.getByLabel('Place name')).toHaveValue('Our house');
  await back.click();
  await expect(page.getByLabel('Street address')).toBeVisible();
  await expect(page).toHaveURL(/\/packs\/new$/);
  // From the search, Back leaves the builder.
  await back.click();
  await expect(page).toHaveURL(/\/$/);
});

test('once the pack is saved, Back to Home is the one way out', async ({ page }) => {
  await mockOfficialServices(page, {
    candidates: [addressFeature(ADDRESS, 'KALORAMA', 145.36594, -37.817939)],
    lgaName: LGA_NAME,
    bpaHits: [bpaHitFeature(LGA_NAME)],
  });
  await searchConfirmAndReachOffer(page);
  await page.getByRole('button', { name: 'Save this pack' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Place saved');
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Back to Home' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('.pack-card')).toHaveCount(1);
});

test('a reload part way through starts again at the address search', async ({ page }) => {
  await page.goto('/packs/new?step=note');
  await expect(page.getByLabel('Street address')).toBeVisible();
  await expect(page).toHaveURL(/\/packs\/new$/);
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
  await expect(page.locator('.pack-detail h1')).toBeVisible();
}

test('US2 the global Back bar works offline and the stored pack survives it', async ({ page, context }) => {
  await saveAPackAndOpenIt(page);
  const packUrl = page.url();
  await waitForController(page);

  const failed: string[] = [];
  page.on('requestfailed', (r) => failed.push(`${r.method()} ${r.url()}`));
  await context.setOffline(true);

  await page.goto(packUrl);
  await expect(page.locator('.pack-detail h1')).toBeVisible();
  // A fresh document load has history position 0, so the Back bar lands on the
  // pack list via a client-side route change — no document request offline.
  await page.getByRole('button', { name: 'Back' }).click();

  await expect(page.locator('.pack-card')).toBeVisible();
  await expect(page.getByText(displayAddress(ADDRESS))).toBeVisible();
  await expect(page.locator('main')).not.toContainText(/Loading|Reconnect|not available/i);
  expect(failed).toEqual([]);

  await context.setOffline(false);
});

test('Back from a pack goes Home with another tab behind it, and a lone pack\'s rehearsal has no Back', async ({ page }) => {
  await saveAPackAndOpenIt(page);
  const nav = page.getByRole('navigation', { name: 'Main' });
  await nav.getByRole('link', { name: 'About', exact: true }).click();
  await page.goBack();
  await expect(page.locator('.pack-detail h1')).toBeVisible();

  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('.pack-card')).toBeVisible();

  // One pack: Rehearse opens its rehearsal straight away, so Back there would loop.
  await nav.getByRole('link', { name: 'Rehearse', exact: true }).click();
  await expect(page).toHaveURL(/\/rehearse\/.+/);
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toHaveCount(0);
});

test('US2 the pack reopens unchanged after returning to the pack list', async ({ page }) => {
  await saveAPackAndOpenIt(page);
  const before = await page.locator('.pack-detail').innerText();

  await page.goto('/');
  await expect(page.locator('.pack-card')).toBeVisible();

  // The pack card is the way in: its name link stretches over the whole card.
  await page.locator('.pack-card h2 a').click();
  await expect(page.locator('.pack-detail h1')).toBeVisible();
  expect(await page.locator('.pack-detail').innerText()).toBe(before);

  // A full reload of the detail route is still the same stored pack.
  await page.reload();
  expect(await page.locator('.pack-detail').innerText()).toBe(before);
});