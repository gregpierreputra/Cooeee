import { expect, test } from '@playwright/test';
import {
  BLACKSKY_TITLE,
  COPIED,
  COPY,
  FIRST_RUN_TITLE,
  PRINT_PACK,
  TOUR_HINT,
  WHO_TO_CALL,
} from '../src/core/copy';
import {
  acknowledgeFirstOpen,
  addressFeature,
  bpaHitFeature,
  chooseLastResortPlaces,
  mockOfficialServices,
  openSources,
  waitForController,
} from './helpers';

// Airplane mode with a saved pack, against the real production bundle. The
// pack is saved online once; then the radios go off and every feature the app
// says works with no signal is walked, each from a cold load. Not one request
// may fail and not one script error may occur. The online-only screens are
// visited last and must say plainly that they need a connection.

const ADDRESS = '6 RIDGE ROAD KALORAMA 3766';
const KALORAMA = { latitude: -37.817939, longitude: 145.36594 };

test.use({ geolocation: KALORAMA, permissions: ['geolocation'] });

test('every offline feature works in airplane mode, and the online ones say they need a connection', async ({
  page,
  context,
}) => {
  test.setTimeout(90_000);
  await acknowledgeFirstOpen(page);
  await mockOfficialServices(page, {
    candidates: [addressFeature(ADDRESS, 'KALORAMA', KALORAMA.longitude, KALORAMA.latitude)],
    lgaName: 'YARRA RANGES',
    bpaHits: [bpaHitFeature('YARRA RANGES')],
  });
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('cooeee.kept.v1', '["services-australia-crisis-payment"]'));
  await page.goto('/packs/new');
  await page.getByLabel('Street address').fill('RIDGE');
  await page.getByRole('button', { name: ADDRESS }).click();
  await page.getByLabel('Place name').fill('Kalorama');
  await page.getByRole('button', { name: 'Save this place' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await chooseLastResortPlaces(page);
  await page.getByRole('button', { name: 'Save this pack' }).click();
  await page.getByRole('button', { name: 'Open saved pack' }).click();
  await expect(page.locator('.pack-detail h1')).toBeVisible();
  const packPath = new URL(page.url()).pathname;
  await waitForController(page);

  const failed: string[] = [];
  const errors: string[] = [];
  page.on('requestfailed', (r) => failed.push(`${r.method()} ${r.url()}`));
  page.on('pageerror', (error) => errors.push(error.message));
  await context.setOffline(true);

  // Home, from the icon.
  await page.goto('/');
  await expect(page.locator('.pack-card')).toBeVisible();

  // The pack page: its sources, its area map and its saved program page.
  await page.goto(packPath);
  await expect(page.locator('.pack-detail h1')).toHaveText('Kalorama');
  await openSources(page);
  await expect(page.locator('.area-map img')).toBeVisible();
  await page.getByRole('tab', { name: 'Support' }).click();
  const programs = page.locator('.pack-section', { hasText: 'Saved programs' });
  await expect(programs.getByRole('link', { name: 'Saved PDF' })).toBeVisible();

  // Print this pack.
  await page.goto(`${packPath}/print`);
  await expect(page.getByRole('button', { name: PRINT_PACK })).toBeVisible();

  // Recover, with Call and Copy.
  await page.goto('/recover');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => undefined } });
  });
  await page.getByRole('button', { name: WHO_TO_CALL }).click();
  await expect(page.locator('.call-card.emergency-line a').first()).toHaveAttribute('href', 'tel:000');
  await page.getByRole('button', { name: `${COPY} Lifeline` }).click();
  await expect(page.getByRole('button', { name: `${COPIED} Lifeline` })).toBeVisible();

  // Rehearse: the pack's rehearsal, then the drill with its pictures.
  await page.goto('/rehearse');
  await page.locator('.pack-choice-list .pack-name a').first().click();
  await expect(page.getByRole('heading', { name: 'Rehearse without…' })).toBeVisible();
  await page.goto('/rehearse');
  await page.getByRole('button', { name: /Play the drill/ }).click();
  await page.getByRole('button', { name: 'Start the drill' }).click();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  // The bag's size follows the day's twist.
  await expect(page.locator('main')).toContainText(/Bag 0 of \d+/);

  // The two daily games, with their pictures and their word list, from the cache.
  await page.goto('/rehearse');
  await page.getByRole('button', { name: /Cooee Word/ }).click();
  await expect(page.getByRole('heading', { name: /^Word \d+$/ })).toBeVisible();
  await page.goto('/rehearse/block');
  await page.getByRole('button', { name: 'Start looking' }).click();
  await expect(page.getByRole('img', { name: /yard seen from above/ })).toBeVisible();
  await expect(page.locator('.block-stage canvas')).toHaveAttribute('data-camera', /\d/);

  // The tour.
  await page.goto('/');
  await page.getByRole('button', { name: TOUR_HINT }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');

  // BlackSky: the dial points at a saved place with a distance.
  await page.evaluate(() => localStorage.setItem('cooeee.blacksky.v1', 'latched'));
  await page.goto('/blacksky');
  await expect(page.getByRole('heading', { name: BLACKSKY_TITLE })).toBeVisible();
  await expect(page.locator('.blacksky-figure-main')).toContainText(/\d/);

  expect(failed).toEqual([]);

  // Online only: building a pack and Nearby say so, calmly. The fixtures stop
  // answering, so the official services are as unreachable as they would be.
  await page.unrouteAll();
  await page.evaluate(() => localStorage.removeItem('cooeee.blacksky.v1'));
  await page.goto('/packs/new');
  await page.getByLabel('Street address').fill('RIDGE');
  await expect(page.locator('#address-result')).toContainText('Search is unavailable right now.');
  await page.goto('/nearby');
  await expect(page.getByRole('heading', { name: FIRST_RUN_TITLE })).toBeVisible();

  expect(errors).toEqual([]);
  await context.setOffline(false);
});

// The first visit after install is taken over at once, so a phone that loses
// signal before the app is ever opened again still has the drill's pictures.
test('the first visit is served offline without a reload', async ({ page, context }) => {
  await acknowledgeFirstOpen(page);
  await page.goto('/');
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  const gameFiles = ['/drill/house.png', '/drill/sprites.png', '/block/yard.png', '/block/sprites.png', '/word/words-4.json', '/word/words-5.json', '/word/words-6.json', '/word/words-7.json'];
  const cached = await page.evaluate((paths) => Promise.all(paths.map((path) => fetch(path).then((r) => r.ok))), gameFiles);
  expect(cached).toEqual(gameFiles.map(() => true));
  await context.setOffline(false);
});
