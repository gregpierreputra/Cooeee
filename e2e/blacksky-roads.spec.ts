import { expect, test, type Page } from '@playwright/test';
import { LOCALITIES_ATTRIBUTION, MAP_RETURN_BUTTON, NO_PACK_HERE, ROADS_ATTRIBUTION } from '../src/core/copy';
import { acknowledgeFirstOpen, HARNESS, waitForController } from './helpers';
import { AT_FERNY_CREEK, PHONE, pushPosition, stubPositions, turnPhone } from './blacksky-position';

// BS_Enhancement-AC5: roads inside the dial. The harness dial (see e2e/harness)
// with `roads=fixture` holds six synthetic roads round the pack at Ferny Creek;
// without it the screen's own cache-only reader finds nothing, which is the
// empty state. The chosen place is 2.60 km due north of the pack centre.

const map = (page: Page) => page.locator('.blacksky-dial-map');
const roads = (page: Page) => page.locator('.blacksky-dial-map .blacksky-road');
// Where the pin sits: on the ring, or inside the view as the drop, and how far
// from the centre, in the dial's units. The dial's circles are shares of its
// 212-unit box (see BlackSkyDial.tsx): the map disc 88 %, the ring's line
// placed so its outer edge is 97 %.
const HALF = 212 / 2;
const MAP_R = HALF * 0.88;
const RING_R = HALF * 0.97 - 1;
const pinAt = (page: Page) => page.locator('.blacksky-dial-pin').getAttribute('data-at');
const pinR = (page: Page) =>
  page.locator('.blacksky-dial-pin').evaluate((el) => Number(el.getAttribute('data-r')));

async function openRoads(page: Page, roadsMode?: 'fixture') {
  await page.setViewportSize(PHONE);
  await stubPositions(page);
  await page.goto(`${HARNESS}/blacksky?dial=pack${roadsMode ? `&roads=${roadsMode}` : ''}`);
}

test('Normal: the near view, roads inside the ring, turning with it, each at its width, with names', async ({
  page,
}) => {
  await openRoads(page, 'fixture');
  await pushPosition(page, AT_FERNY_CREEK);

  // "Near me", 1.5 km round the person, is the only view: four of the six
  // fixture roads are in it (the unnamed road 1.76 km east and the collector
  // 1.50 km south, a metre past the edge, are not), each as two strokes.
  await expect(roads(page)).toHaveCount(8);
  await expect(map(page)).toHaveAttribute('data-view', 'near');
  // A light disc under them, filling the map circle.
  await expect(page.locator('.blacksky-dial-map .blacksky-map-disc')).toHaveCount(1);
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

  // The near widths and the draw order: the arterial 6, the highway 9, the
  // freeway 11 and its ramp at the collector width, 4, in the freeway's
  // colours; every casing of a class before its fills.
  const strokes = await roads(page).evaluateAll((paths) =>
    paths.map((p) => `${p.classList[1]} ${p.classList[2]} ${Number(Number(p.getAttribute('stroke-width')).toFixed(2))}`),
  );
  expect(strokes).toEqual([
    'arterial casing 6',
    'arterial fill 4.2',
    'highway casing 9',
    'highway fill 6.3',
    'freeway casing 11',
    'freeway casing 4',
    'freeway fill 7.7',
    'freeway fill 2.8',
  ]);
  // Names along the road, freeways first, never an unnamed one.
  const names = await page.locator('.blacksky-road-label .upright').allTextContents();
  expect(names[0]).toBe('Fixture Freeway');
  expect(names).toContain('Fixture Arterial Road');
  expect(names).not.toContain('');
  // Names are drawn at 14 px, over the card's 13 px floor.
  expect(
    await page.locator('.blacksky-road-label .upright').first().evaluate((el) => getComputedStyle(el).fontSize),
  ).toBe('14px');
  // No locality names: they are for the whole way, which the screen never draws.
  await expect(page.locator('.blacksky-locality')).toHaveCount(0);

  // WCAG 1.1.1: the dial's text equivalent is exactly what it was without roads.
  await expect(page.getByRole('img', { name: 'Village Green, 2.60 km, North' })).toBeVisible();
});

test('one view: no switch, no view tag and no hint; a 500 m scale bar that stands still', async ({ page }) => {
  await openRoads(page, 'fixture');
  await pushPosition(page, AT_FERNY_CREEK);
  await expect(roads(page).first()).toBeAttached();

  // Nothing on the dial is a button any more, and nothing names a view.
  await expect(page.locator('.blacksky-dial-frame button')).toHaveCount(0);
  await expect(page.locator('.blacksky-view-tag')).toHaveCount(0);
  await expect(page.getByText(/tap the dial/i)).toHaveCount(0);

  // The scale bar: 500 m at the map's own scale, within a pixel. Read both at
  // once, from one drawing: the dial is drawn again once its frame is measured.
  const bar = page.locator('.blacksky-scale-bar');
  await expect(bar).toHaveCount(1);
  await expect(page.locator('.blacksky-scale-label')).toHaveText('500 m');
  const scaleError = () =>
    page.evaluate(() => {
      const metresPerPx = Number(document.querySelector('.blacksky-dial-map')!.getAttribute('data-metres-per-px'));
      const width = document.querySelector('.blacksky-scale-bar')!.getBoundingClientRect().width;
      return Math.abs(width - 500 / metresPerPx);
    });
  await expect.poll(scaleError).toBeLessThanOrEqual(1);
  const width = (await bar.boundingBox())!.width;
  // Inside the disc, in its lower left.
  const [disc, scale] = await Promise.all([
    page.locator('.blacksky-map-disc').boundingBox(),
    page.locator('.blacksky-scale').boundingBox(),
  ]);
  const cx = disc!.x + disc!.width / 2;
  const cy = disc!.y + disc!.height / 2;
  expect(scale!.x).toBeLessThan(cx);
  expect(scale!.y).toBeGreaterThan(cy);
  for (const [x, y] of [
    [scale!.x, scale!.y],
    [scale!.x + scale!.width, scale!.y + scale!.height],
  ]) {
    expect(Math.hypot(x - cx, y - cy)).toBeLessThan(disc!.width / 2);
  }
  // It sits outside the turning group, so it never turns.
  await expect(page.locator('.blacksky-dial-ring .blacksky-scale')).toHaveCount(0);
  await turnPhone(page, 90);
  await expect(page.getByText('North up', { exact: true })).toBeHidden();
  expect(Math.round((await bar.boundingBox())!.width)).toBe(Math.round(width));
});

test('the pin leaves the ring for its true spot when the place is inside the view', async ({ page }) => {
  await openRoads(page, 'fixture');
  await pushPosition(page, AT_FERNY_CREEK);

  // The place is 2.60 km away, outside the 1.5 km view: the marker is on the ring.
  await expect.poll(() => pinAt(page)).toBe('ring');
  expect(await pinR(page)).toBeCloseTo(RING_R, 6);
  // On the ring the pin is the same drop, amber, tip on the ring's line: 30 px
  // tall on the phone's 328 px dial (larger than the 22 px drop inside the
  // disc), and in proportion on this one.
  await expect(page.locator('.blacksky-dial-pin .blacksky-dial-drop.on-ring')).toHaveCount(1);
  const ringPin = await page.evaluate(() => {
    const pin = document.querySelector('.blacksky-dial-drop.on-ring')!.getBoundingClientRect();
    const notch = document.querySelector('.blacksky-dial-notch')!.getBoundingClientRect();
    const dial = document.querySelector('.blacksky-dial')!.getBoundingClientRect();
    return { height: pin.height, top: pin.top, notchBottom: notch.bottom, dial: dial.width };
  });
  expect(Math.abs(ringPin.height - (30 * ringPin.dial) / 328)).toBeLessThanOrEqual(1);
  // The place is due north and the dial north up, so the pin is under the
  // notch: tip meets tip on the ring's line, and the pin never rises into it.
  expect(ringPin.top).toBeGreaterThanOrEqual(ringPin.notchBottom - 0.5);

  // About a kilometre south of the place: inside 1.5 km, so the drop comes in,
  // at 1.0 / 1.5 of the map's radius.
  await pushPosition(page, { latitude: -37.8656, longitude: 145.34 });
  await expect(page.locator('.blacksky-figure-main')).toHaveText('1.00 km');
  await expect.poll(() => pinAt(page)).toBe('inside');
  await expect.poll(() => pinR(page)).toBeCloseTo(MAP_R / 1.5, 0);
  // The drop with its hole, 22 px tall on the screen, standing upright; the
  // browser's box also takes in its 2.5 px amber edge.
  const drop = page.locator('.blacksky-dial-drop');
  await expect(drop).toHaveCount(1);
  await expect(page.locator('.blacksky-dial-drop.on-ring')).toHaveCount(0);
  const dropBox = (await drop.boundingBox())!;
  expect(dropBox.height).toBeGreaterThanOrEqual(22);
  expect(dropBox.height).toBeLessThanOrEqual(25);
  expect(dropBox.height).toBeGreaterThan(dropBox.width); // a drop, taller than wide: upright
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

// Dragging the map to look around (28 Sep review). The map group carries the
// drag it was drawn with, metres north and east of the person.
const panOf = (page: Page) => map(page).getAttribute('data-pan');
async function drag(page: Page, dx: number, dy: number) {
  const disc = (await page.locator('.blacksky-dial-pan').boundingBox())!;
  const x = disc.x + disc.width / 2;
  const y = disc.y + disc.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 4 });
  await page.mouse.move(x + dx, y + dy, { steps: 4 });
  await page.mouse.up();
}
const backToMe = (page: Page) => page.getByRole('button', { name: MAP_RETURN_BUTTON });
const arrowAt = (page: Page) =>
  page.locator('.blacksky-dial-at').first().evaluate((el) => getComputedStyle(el).transform);

const dialBox = (page: Page) =>
  page.locator('.blacksky-dial').evaluate((el) => {
    const box = el.getBoundingClientRect();
    return [box.x, box.y, box.width, box.height].map((v) => Math.round(v * 10) / 10);
  });

test('a drag moves the map and the arrow with it; Back to me puts the person back', async ({ page }) => {
  await openRoads(page, 'fixture');
  await pushPosition(page, AT_FERNY_CREEK);
  await expect(roads(page).first()).toBeAttached();
  await expect.poll(() => panOf(page)).toBe('0 0');
  await expect(backToMe(page)).toHaveCount(0);
  const still = await dialBox(page);

  // A small move is a tap, and a tap does nothing.
  await drag(page, 4, 0);
  await expect.poll(() => panOf(page)).toBe('0 0');

  // 80 px to the right, north up: the map follows the finger, so its centre is
  // now west of the person, and the arrow, at the person, is right of centre.
  const before = await roads(page).first().getAttribute('d');
  await drag(page, 80, 0);
  await expect.poll(() => panOf(page)).not.toBe('0 0');
  const [north, east] = (await panOf(page))!.split(' ').map(Number);
  expect(north).toBe(0);
  expect(east).toBeLessThan(-500);
  expect(await roads(page).first().getAttribute('d')).not.toBe(before);
  expect(await arrowAt(page)).not.toBe('none');
  await expect(backToMe(page)).toBeVisible();
  // The ring's pin keeps its bearing from the person: the compass does not pan.
  expect(await page.locator('.blacksky-dial-pin').getAttribute('data-at')).toBe('ring');
  // The dial is exactly where and as large as it was: the button lies over its
  // foot, centred, its bottom on the frame's, 44 px high, and takes no room.
  expect(await dialBox(page)).toEqual(still);
  const [frame, button] = await Promise.all([
    page.locator('.blacksky-dial-frame').boundingBox(),
    backToMe(page).boundingBox(),
  ]);
  expect(Math.round(button!.height)).toBe(44);
  expect(Math.abs(button!.y + button!.height - (frame!.y + frame!.height))).toBeLessThanOrEqual(0.5);
  expect(Math.abs(button!.x + button!.width / 2 - (frame!.x + frame!.width / 2))).toBeLessThanOrEqual(0.5);
  // Reached from the keyboard too: it is an ordinary button in the tab order.
  await backToMe(page).focus();
  await expect(backToMe(page)).toBeFocused();

  await backToMe(page).click();
  await expect.poll(() => panOf(page)).toBe('0 0');
  await expect(backToMe(page)).toHaveCount(0);
  expect(await dialBox(page)).toEqual(still);
});

// On a 360 by 660 phone the button once took a row out of the dial's slot, and
// the dial shrank from 328 to 302 px as a drag began. Never again: before, during
// and after, the dial's box is the same.
test('on a 360 by 660 phone the dial keeps its size through a drag and Back to me', async ({ page }) => {
  await openRoads(page, 'fixture');
  await page.setViewportSize({ width: 360, height: 660 });
  await pushPosition(page, AT_FERNY_CREEK);
  await expect(roads(page).first()).toBeAttached();
  const before = await dialBox(page);
  expect(before[2]).toBe(328);
  const disc = (await page.locator('.blacksky-dial-pan').boundingBox())!;
  const x = disc.x + disc.width / 2;
  const y = disc.y + disc.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 40, y, { steps: 4 });
  await expect(backToMe(page)).toBeVisible();
  expect(await dialBox(page)).toEqual(before); // during the drag
  await page.mouse.up();
  expect(await dialBox(page)).toEqual(before);
  await backToMe(page).click();
  await expect(backToMe(page)).toHaveCount(0);
  expect(await dialBox(page)).toEqual(before); // after Back to me
});

test('a new position while dragged leaves the map where it was dragged', async ({ page }) => {
  await openRoads(page, 'fixture');
  await pushPosition(page, AT_FERNY_CREEK);
  await expect(roads(page).first()).toBeAttached();
  await drag(page, 0, 60);
  await expect.poll(() => panOf(page)).not.toBe('0 0');
  const dragged = await panOf(page);
  // 200 m further south: the map is drawn again from the new position, and the
  // drag is kept, metres from the person.
  await pushPosition(page, { latitude: -37.8818, longitude: 145.34 });
  await expect(page.locator('.blacksky-figure-main')).toHaveText('2.80 km');
  expect(await panOf(page)).toBe(dragged);
  await expect(backToMe(page)).toBeVisible();
});

test('left alone for 15 seconds, the dragged map comes back to the person by itself', async ({ page }) => {
  await page.clock.install();
  await openRoads(page, 'fixture');
  await pushPosition(page, AT_FERNY_CREEK);
  await expect(roads(page).first()).toBeAttached();
  await drag(page, -70, 0);
  await expect.poll(() => panOf(page)).not.toBe('0 0');
  await page.clock.fastForward(14_000);
  expect(await panOf(page)).not.toBe('0 0'); // not yet
  await page.clock.fastForward(1_500);
  await expect.poll(() => panOf(page)).toBe('0 0');
  await expect(backToMe(page)).toHaveCount(0);
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
  await expect(page.locator('.blacksky-scale')).toHaveCount(0);
  await expect(page.locator('.blacksky-dial-frame button')).toHaveCount(0);
  await expect(page.locator('.blacksky-dial-pan')).toHaveCount(0);
  expect(await pinAt(page)).toBe('ring');
  // The place's pin is the drop on the ring, as on the plain dial it always is.
  await expect(page.locator('.blacksky-dial-drop.on-ring')).toHaveCount(1);
  await expect(page.locator('.blacksky-dial-drop:not(.on-ring)')).toHaveCount(0);
});

test('About names the road data under its licence', async ({ page }) => {
  await acknowledgeFirstOpen(page);
  await page.goto('/about');
  await expect(page.getByText(ROADS_ATTRIBUTION)).toBeVisible();
  await expect(page.getByText(LOCALITIES_ATTRIBUTION)).toBeVisible();
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
  // The near view round Clayton: a handful of streets, two strokes each.
  expect(await roads(page).count()).toBeGreaterThan(10);
  expect(failed).toEqual([]);
  expect(roadRequests).toEqual([]);

  await context.setOffline(false);
});
