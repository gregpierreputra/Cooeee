import { expect, test, type Page } from '@playwright/test';
import {
  MAP_VIEW_BUTTON,
  MAP_VIEW_TAG,
  MAP_ZOOM_HINT,
  NO_PACK_HERE,
  ROADS_ATTRIBUTION,
} from '../src/core/copy';
import { acknowledgeFirstOpen, HARNESS, waitForController } from './helpers';
import { AT_FERNY_CREEK, PHONE, pushPosition, stubPositions, turnPhone } from './blacksky-position';

// BS_Enhancement-AC5: roads inside the dial. The harness dial (see e2e/harness)
// with `roads=fixture` holds six synthetic roads round the pack at Ferny Creek;
// without it the screen's own cache-only reader finds nothing, which is the
// empty state. The chosen place is 2.60 km due north of the pack centre.

const map = (page: Page) => page.locator('.blacksky-dial-map');
const roads = (page: Page) => page.locator('.blacksky-dial-map .blacksky-road');
const tag = (page: Page) => page.locator('.blacksky-view-tag');
const pinY = (page: Page) =>
  page.locator('.blacksky-dial-pin circle').first().evaluate((el) => Number(el.getAttribute('cy')));

async function openRoads(page: Page, roadsMode?: 'fixture') {
  await page.setViewportSize(PHONE);
  await stubPositions(page);
  await page.goto(`${HARNESS}/blacksky?dial=pack${roadsMode ? `&roads=${roadsMode}` : ''}`);
}

test('Normal: the roads are drawn inside the ring, turning with it, each at its width, with names', async ({
  page,
}) => {
  await openRoads(page, 'fixture');
  await pushPosition(page, AT_FERNY_CREEK);

  // All six fixture roads are in the whole-way view, one path each.
  await expect(roads(page)).toHaveCount(6);
  // The map is inside the ring's own group, so --heading turns it with the ring.
  await expect(page.locator('.blacksky-dial-ring > .blacksky-dial-map')).toHaveCount(1);
  // Everything drawn lies inside the ring.
  const [ring, drawn] = await Promise.all([
    page.locator('.blacksky-dial-ring > circle').first().boundingBox(),
    map(page).boundingBox(),
  ]);
  expect(drawn!.x).toBeGreaterThanOrEqual(ring!.x - 1);
  expect(drawn!.y).toBeGreaterThanOrEqual(ring!.y - 1);
  expect(drawn!.x + drawn!.width).toBeLessThanOrEqual(ring!.x + ring!.width + 1);
  expect(drawn!.y + drawn!.height).toBeLessThanOrEqual(ring!.y + ring!.height + 1);

  // The width rule: collector 1.25, arterial and highway 2 (and the unnamed
  // arterial), the freeway 3 and its ramp under a kilometre 1.5. Freeways last,
  // so they lie on top.
  const widths = await roads(page).evaluateAll((paths) =>
    paths.map((p) => [p.classList.contains('freeway'), Number(p.getAttribute('stroke-width'))]),
  );
  expect(widths).toEqual([
    [false, 1.25],
    [false, 2],
    [false, 2],
    [false, 2],
    [true, 3],
    [true, 1.5],
  ]);
  // Names along the road, never an unnamed one, none on the arrow.
  await expect(page.locator('.blacksky-road-label .upright')).toHaveText([
    'Fixture Freeway',
    'Fixture Arterial Road',
  ]);

  // Names are drawn at 13 px, the card's smallest.
  expect(
    await page.locator('.blacksky-road-label .upright').first().evaluate((el) => getComputedStyle(el).fontSize),
  ).toBe('13px');

  // WCAG 1.1.1: the dial's text equivalent is exactly what it was without roads.
  await expect(page.getByRole('img', { name: 'Village Green, 2.60 km, North' })).toBeVisible();
});

test('a tap on the dial switches the view, the tag says which, and the hint goes after 5 seconds', async ({
  page,
}) => {
  await openRoads(page, 'fixture');
  await pushPosition(page, AT_FERNY_CREEK);

  await expect(tag(page)).toHaveText(MAP_VIEW_TAG.whole);
  await expect(page.getByText(MAP_ZOOM_HINT)).toBeVisible();
  const toggle = page.getByRole('button', { name: MAP_VIEW_BUTTON });
  // WCAG 2.5.8: the switch is the whole dial, far larger than 24 by 24.
  const box = (await toggle.boundingBox())!;
  expect(box.width).toBeGreaterThan(200);
  expect(box.height).toBeGreaterThan(200);

  await toggle.click();
  await expect(tag(page)).toHaveText(MAP_VIEW_TAG.near);
  // Near me is 1.5 km round the person: the unnamed road 1.76 km east, and the
  // collector 1.50 km south (a metre past the edge), drop out.
  await expect(roads(page)).toHaveCount(4);
  await toggle.click();
  await expect(tag(page)).toHaveText(MAP_VIEW_TAG.whole);
  await expect(roads(page)).toHaveCount(6);

  await expect(page.getByText(MAP_ZOOM_HINT)).toBeHidden({ timeout: 7_000 });
});

test('the pin leaves the ring for its true spot when the place is inside the view', async ({ page }) => {
  await openRoads(page, 'fixture');
  await pushPosition(page, AT_FERNY_CREEK);
  const toggle = page.getByRole('button', { name: MAP_VIEW_BUTTON });

  // Whole way reaches 2.60 km and 15 % more: the pin sits at 2.60 / 2.99 of
  // the ring's radius, 78.
  await expect.poll(() => pinY(page)).toBeCloseTo(-78 / 1.15, 1);
  // Near me is 1.5 km: the place is outside it, so the pin is on the ring.
  await toggle.click();
  await expect.poll(() => pinY(page)).toBe(-78);

  // About a kilometre south of the place: inside 1.5 km, so the pin comes in.
  await pushPosition(page, { latitude: -37.8656, longitude: 145.34 });
  await expect(page.locator('.blacksky-figure-main')).toHaveText('1.00 km');
  await expect.poll(() => pinY(page)).toBeCloseTo(-78 / 1.5, 0);
  // The arrow still points at it, the same bearing as the pin.
  const bearings = await page
    .locator('.blacksky-dial-pin, .blacksky-dial-arrow')
    .evaluateAll((els) => els.map((el) => (el as SVGElement).style.getPropertyValue('--bearing')));
  expect(new Set(bearings).size).toBe(1);
});

test('a name the dial has turned upside down gives way to its twin, with no redraw', async ({ page }) => {
  await openRoads(page, 'fixture');
  await pushPosition(page, AT_FERNY_CREEK);
  const freeway = page.locator('.blacksky-road-label').filter({ hasText: 'Fixture Freeway' });
  const opacity = (which: string) =>
    freeway.locator(which).evaluate((el) => Number(getComputedStyle(el).opacity));
  const drawn = await roads(page).first().elementHandle();

  // North up, the freeway runs up to the right and reads the right way up.
  expect(await opacity('.upright')).toBe(1);
  expect(await opacity('.turned')).toBe(0);

  // Facing south, it would stand on its head: the twin shows instead.
  await turnPhone(page, 180);
  await expect.poll(() => opacity('.upright')).toBe(0);
  expect(await opacity('.turned')).toBe(1);
  // The same path element as before the turn: the map was not drawn again.
  expect(await roads(page).first().evaluate((el, before) => el === before, drawn)).toBe(true);
});

test('Empty: without the roads file the dial is the plain dial, and nothing else is drawn', async ({
  page,
}) => {
  await openRoads(page);
  await pushPosition(page, AT_FERNY_CREEK);
  await expect(page.getByRole('img', { name: 'Village Green, 2.60 km, North' })).toBeVisible();
  // Give the reader its chance to find a file, then look.
  await page.waitForTimeout(500);
  await expect(map(page)).toHaveCount(0);
  await expect(tag(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: MAP_VIEW_BUTTON })).toHaveCount(0);
  await expect(page.getByText(MAP_ZOOM_HINT)).toHaveCount(0);
  expect(await pinY(page)).toBe(-78);
});

test('About names the road data under its licence', async ({ page }) => {
  await acknowledgeFirstOpen(page);
  await page.goto('/about');
  await expect(page.getByText(ROADS_ATTRIBUTION)).toBeVisible();
});

// The real bundle: the roads file is precached with the shell, and BlackSky
// reads it from that cache with the radios off. No request of any kind fails,
// and the roads file is never asked for over the network.
test('offline, with the roads file held, the real app draws roads inside the dial', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: -37.93, longitude: 145.13, accuracy: 10 });
  await acknowledgeFirstOpen(page);
  await page.goto('/');
  await waitForController(page);
  // The precache holds the file (under a revision query) once the worker is in.
  await page.waitForFunction(async () =>
    Boolean(await caches.match('/data/roads-vic.bin', { ignoreSearch: true })),
  );

  const failed: string[] = [];
  const roadRequests: string[] = [];
  page.on('requestfailed', (r) => failed.push(`${r.method()} ${r.url()}`));
  page.on('request', (r) => {
    if (r.url().includes('roads-vic')) roadRequests.push(r.url());
  });

  await page.evaluate(() => localStorage.setItem('cooeee.blacksky.v1', 'latched'));
  await context.setOffline(true);
  await page.goto('/blacksky');

  await expect(page.getByText(NO_PACK_HERE)).toBeVisible();
  await expect(roads(page).first()).toBeAttached();
  expect(await roads(page).count()).toBeGreaterThan(100);
  expect(failed).toEqual([]);
  expect(roadRequests).toEqual([]);

  await context.setOffline(false);
});
