import { expect, test, type Page } from '@playwright/test';
import { relativeBearing } from '../src/core/blacksky-dial';
import {
  CALL_TRIPLE_ZERO,
  LEAVE_BLACKSKY,
  MARK_AT_SAVED_PLACE,
  NO_GPS,
  NO_PACK_HERE,
  NO_PLACE_TO_POINT_AT,
  OUTSIDE_AREAS,
  SORTED_BY_DISTANCE,
  VICEMERGENCY_HOTLINE,
} from '../src/core/copy';
import { titleCase } from '../src/core/home';
import {
  AT_FERNY_CREEK,
  AT_MELBOURNE,
  drawnAngle,
  openDial,
  pushPosition,
} from './blacksky-position';

// BS_Enhancement-AC1: one place on one compass dial. One test per state the
// card names (Normal, Empty, Unavailable), plus the two other screens the dial
// replaces the arrows list on. The harness pack sits at Ferny Creek with two
// chosen places, 2.60 km north and 3.50 km south; the state-wide fixture's
// nearest site, Belgrave Recreation Reserve, is NEARER than both at 2.13 km.

const label = (page: Page) => page.locator('.blacksky-dial-head .kicker');
const name = (page: Page) => page.locator('.blacksky-dial-head h2');
const distance = (page: Page) => page.locator('.blacksky-figure-main');
const othersLine = (page: Page) => page.getByRole('button', { name: /other place/ });
const sheet = (page: Page) => page.getByRole('dialog', { name: 'Other places' });

test('Normal, inside the pack area: the nearest chosen place is the one subject, on one screen', async ({
  page,
}) => {
  await openDial(page, 'pack');
  await pushPosition(page, AT_FERNY_CREEK);

  // The chosen place at 2.60 km, not the state-wide site at 2.13 km.
  await expect(label(page)).toHaveText('YOUR CHOSEN PLACE');
  // Site name first and large, suburb second, split from the official name,
  // whose own brackets survive the split.
  await expect(name(page)).toHaveText('Village Green (car park)');
  await expect(page.locator('.blacksky-dial-head p')).toHaveText('Sassafras');
  await expect(distance(page)).toHaveText('2.60 km');
  await expect(page.locator('.blacksky-figure-point')).toHaveText('North');

  // WCAG 1.1.1: the dial's text equivalent is the same three facts.
  await expect(
    page.getByRole('img', { name: 'Village Green (car park), 2.60 km, North' }),
  ).toBeVisible();
  // One pin, in the true direction of the place: due north, drawn north up.
  await expect(page.locator('.blacksky-dial-pin')).toHaveCount(1);
  expect(await drawnAngle(page, '.blacksky-dial-pin')).toBe(relativeBearing(0, 0));
  // The one arrow, at the centre, points at the place too, never just "up".
  await expect(page.locator('.blacksky-dial-arrow path')).toHaveCount(1);
  expect(await drawnAngle(page, '.blacksky-dial-arrow')).toBe(relativeBearing(0, 0));
  // Never more than one arrow, a source line, or the old arrows list.
  await expect(page.locator('.blacksky-arrow')).toHaveCount(0);
  await expect(page.getByText(/Official place of last resort ·/)).toHaveCount(0);

  // Every other place is one line: how many, and how far.
  await expect(othersLine(page)).toHaveText(/^4 other places · 2\.13 km · 3\.50 km/);
  // No list of places is on screen yet, so the mandated phrase is not either.
  await expect(page.getByText(SORTED_BY_DISTANCE)).toBeHidden();

  // The notes are readable without a tap, and title to Leave fits 390 by 844.
  await expect(page.getByText('Gas is off at the meter.')).toBeVisible();
  await expect(page.getByRole('button', { name: LEAVE_BLACKSKY })).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(844);

  // Sizes: the distance is at least 56 px and the largest text on the screen;
  // nothing but the small labels is under 16 px; every target is at least 44 px.
  const sizes = await page.evaluate(() => {
    const px = (el: Element) => parseFloat(getComputedStyle(el).fontSize);
    const withText = [...document.querySelectorAll('main *')].filter((el) =>
      [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim()),
    );
    return {
      distance: px(document.querySelector('.blacksky-figure-main')!),
      largest: Math.max(...withText.map(px)),
      smallNotLabels: withText.filter((el) => px(el) < 16 && !el.closest('.kicker')).length,
      smallTargets: [...document.querySelectorAll('main button, main summary')]
        .map((el) => el.getBoundingClientRect())
        .filter((box) => box.width > 0 && (box.width < 44 || box.height < 44)).length,
    };
  });
  expect(sizes.distance).toBeGreaterThanOrEqual(56);
  expect(sizes.largest).toBe(sizes.distance);
  expect(sizes.smallNotLabels).toBe(0);
  expect(sizes.smallTargets).toBe(0);
});

test('Normal: Show makes another place the subject, and it stays so', async ({ page }) => {
  await openDial(page, 'pack');
  await pushPosition(page, AT_FERNY_CREEK);
  await othersLine(page).click();

  // The sheet is a list of places, so the mandated phrase heads it.
  await expect(sheet(page).getByText(SORTED_BY_DISTANCE, { exact: true })).toBeVisible();
  const rows = sheet(page).getByRole('listitem');
  await expect(rows).toHaveCount(4);
  // Nearest first, chosen and state-wide together, with no rank number.
  await expect(rows.locator('h3')).toHaveText([
    'Belgrave Recreation Reserve',
    'Community Hall',
    'Olinda Recreation Reserve',
    'Mount Dandenong Reserve',
  ]);
  for (const show of await sheet(page).getByRole('button', { name: /^Show / }).all()) {
    await expect(show).toHaveText('Show');
    const box = (await show.boundingBox())!;
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
  }

  // Show on the second chosen place: it becomes the subject, the pin moves to
  // due south, and the notes are still on screen.
  await rows.nth(1).getByRole('button', { name: 'Show Community Hall' }).click();
  await expect(sheet(page)).toBeHidden();
  await expect(label(page)).toHaveText('YOUR CHOSEN PLACE');
  await expect(name(page)).toHaveText('Community Hall');
  await expect(page.locator('.blacksky-dial-head p')).toHaveText('Belgrave South');
  await expect(distance(page)).toHaveText('3.50 km');
  expect(await drawnAngle(page, '.blacksky-dial-pin')).toBe(180);
  expect(await drawnAngle(page, '.blacksky-dial-arrow')).toBe(180); // the arrow follows the pin
  await expect(page.getByText('Gas is off at the meter.')).toBeVisible();

  // It never changes by itself: a move of a kilometre north makes the first
  // place nearer still, and the subject stays where the person put it.
  await pushPosition(page, { ...AT_FERNY_CREEK, latitude: -37.871 });
  await expect(distance(page)).toHaveText('4.50 km');
  await expect(name(page)).toHaveText('Community Hall');

  // A state-wide site that is not the nearest one is not called nearest.
  await othersLine(page).click();
  await sheet(page).getByRole('button', { name: 'Show Olinda Recreation Reserve' }).click();
  await expect(name(page)).toHaveText('Olinda Recreation Reserve');
  await expect(label(page)).toHaveText('PLACE OF LAST RESORT');
});

test('Normal, no pack: the nearest state-wide site is the subject', async ({ page }) => {
  await openDial(page, 'no-pack');
  await pushPosition(page, AT_FERNY_CREEK);

  await expect(label(page)).toHaveText('NEAREST PLACE OF LAST RESORT');
  // A name that cannot be split is shown whole, with no suburb line.
  await expect(name(page)).toHaveText('Belgrave Recreation Reserve');
  await expect(page.locator('.blacksky-dial-head p')).toHaveCount(0);
  await expect(distance(page)).toHaveText('2.13 km');
  await expect(othersLine(page)).toHaveText(/^2 other places · /);
  // E3-US2-AC2's rule is unchanged: the screen still says no pack covers this.
  await expect(page.getByText(NO_PACK_HERE)).toBeVisible();
});

test('Normal, outside the pack area: the dial points at the nearest site, and the phone links stay', async ({
  page,
}) => {
  await openDial(page, 'pack');
  await pushPosition(page, AT_MELBOURNE);

  // E3-US2-AC1's rules are unchanged: the pack is named with the distance to
  // its area, never pointed at, and the two phone links are kept.
  await expect(page.getByText(OUTSIDE_AREAS)).toBeVisible();
  await expect(page.getByText(/km to its area$/)).toBeVisible();
  await expect(page.getByRole('link', { name: CALL_TRIPLE_ZERO })).toHaveAttribute('href', 'tel:000');
  await expect(page.getByRole('link', { name: VICEMERGENCY_HOTLINE })).toHaveAttribute(
    'href',
    'tel:1800226226',
  );

  // The chosen places are out of reach here, so the label is the state-wide one.
  await expect(label(page)).toHaveText('NEAREST PLACE OF LAST RESORT');
  await expect(distance(page)).toHaveText(/^\d\d\.\d km$/);
  await expect(page.locator('.blacksky-dial-pin')).toHaveCount(1);
});

test('Empty: a position but nothing to point at keeps the notes and Leave', async ({ page }) => {
  await openDial(page, 'pack-only');
  await pushPosition(page, AT_FERNY_CREEK);

  await expect(page.getByText(NO_PLACE_TO_POINT_AT)).toBeVisible();
  await expect(page.locator('.blacksky-dial')).toHaveCount(0);
  await expect(page.getByText('Notes', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: LEAVE_BLACKSKY })).toBeVisible();

  // The same with nothing stored at all.
  await openDial(page, 'empty');
  await pushPosition(page, AT_FERNY_CREEK);
  await expect(page.getByText(NO_PLACE_TO_POINT_AT)).toBeVisible();
  await expect(page.getByRole('button', { name: LEAVE_BLACKSKY })).toBeVisible();
});

test('Unavailable: with no position the no-fix reference screen shows, unchanged', async ({ page }) => {
  await openDial(page, 'pack');

  await expect(page.getByText(NO_GPS)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sassafras (Village Green (car park))' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: MARK_AT_SAVED_PLACE(titleCase('10 OLD ROAD FERNY CREEK 3786')) }),
  ).toBeVisible();
  // No dial, no label, no bar; the notes stay folded until asked for.
  await expect(page.locator('.blacksky-dial')).toHaveCount(0);
  await expect(page.locator('.blacksky-dial-head')).toHaveCount(0);
  await expect(page.getByText('GPS signal lost')).toBeHidden();
  await expect(page.getByText('Gas is off at the meter.')).toBeHidden();
});
