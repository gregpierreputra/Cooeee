import { expect, test, type Page } from '@playwright/test';
import { relativeBearing } from '../src/core/blacksky-dial';
import {
  CALL_TRIPLE_ZERO,
  HOLD_TO_LEAVE,
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
  // Site name first and large, split from the official name; its trailing
  // qualifier goes down to the suburb line, so the name stays short.
  await expect(name(page)).toHaveText('Village Green');
  await expect(page.locator('.blacksky-dial-head p')).toHaveText('Sassafras · car park');
  await expect(distance(page)).toHaveText('2.60 km');
  // The compass point as its letters on the row; the word travels with them.
  await expect(page.locator('.blacksky-figure-point')).toHaveText('N');
  await expect(page.locator('.blacksky-figure-point')).toHaveAttribute('title', 'North');

  // WCAG 1.1.1: the dial's text equivalent is the same three facts, the
  // compass point in full.
  await expect(page.getByRole('img', { name: 'Village Green, 2.60 km, North' })).toBeVisible();
  // One pin, in the true direction of the place: due north, drawn north up.
  await expect(page.locator('.blacksky-dial-pin')).toHaveCount(1);
  expect(await drawnAngle(page, '.blacksky-dial-pin')).toBe(relativeBearing(0, 0));
  // The one arrow, at the centre, points at the place too, never just "up".
  await expect(page.locator('.blacksky-dial-arrow path')).toHaveCount(1);
  expect(await drawnAngle(page, '.blacksky-dial-arrow')).toBe(relativeBearing(0, 0));
  // Never more than one arrow, a source line, or the old arrows list.
  await expect(page.locator('.blacksky-arrow')).toHaveCount(0);
  await expect(page.getByText(/Official place of last resort ·/)).toHaveCount(0);

  // Every other place is one line: how many, and the range they lie in.
  await expect(othersLine(page)).toHaveText('4 other places · 2.13 km – 5.07 km');
  // No list of places is on screen yet, so the mandated phrase is not either.
  await expect(page.getByText(SORTED_BY_DISTANCE)).toBeHidden();

  // The notes are readable without a tap. Now that the dial takes the width
  // they may start below the fold, which the team accepted; the glance, label
  // to dial, and Leave in its top bar are all on the first screen.
  await expect(page.getByText('Gas is off at the meter.')).toBeVisible();
  await expect(page.getByRole('button', { name: LEAVE_BLACKSKY })).toBeInViewport({ ratio: 1 });
  await expect(page.locator('.blacksky-dial')).toBeInViewport({ ratio: 1 });
  // Order down the screen: name block, distance row, dial, other places, notes.
  const tops = await page.evaluate(() =>
    ['.blacksky-topbar', '.blacksky-dial-head', '.blacksky-dial-figures', '.blacksky-dial', '.blacksky-others', '.blacksky-notes'].map(
      (selector) => document.querySelector(selector)!.getBoundingClientRect().top,
    ),
  );
  expect(tops).toEqual([...tops].sort((a, b) => a - b));

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

// The Leave control is a compact pill in the top bar, not a bar at the foot of
// the screen: the foot goes to the places and the notes. What guards a pocket
// press is the two-second hold, which is unchanged (blacksky-offline,
// blacksky-history and rehearsal-journey hold it to leave; here, its place).
test('Leave sits in the top bar, clear of the top edge, and its hint never moves it', async ({ page }) => {
  await openDial(page, 'pack');
  await pushPosition(page, AT_FERNY_CREEK);

  const leave = page.getByRole('button', { name: 'Hold to leave', exact: true });
  await expect(leave).toHaveCount(1); // the one way out, and no second one at the foot
  await expect(leave).toHaveText(LEAVE_BLACKSKY);
  const before = (await leave.boundingBox())!;
  const title = (await page.getByRole('heading', { name: 'BlackSky', level: 1 }).boundingBox())!;
  const dial = (await page.locator('.blacksky-dial').boundingBox())!;
  const main = await page.locator('main').evaluate((el) => {
    const box = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return { right: box.right - parseFloat(style.paddingRight) };
  });

  // Beside the title, at the right-hand end of the bar, above everything else.
  expect(before.y + before.height / 2).toBeGreaterThan(title.y);
  expect(before.y + before.height / 2).toBeLessThan(title.y + title.height);
  expect(before.x).toBeGreaterThan(title.x + 60);
  expect(Math.abs(before.x + before.width - main.right)).toBeLessThanOrEqual(1);
  expect(before.y + before.height).toBeLessThan(dial.y);
  // A compact pill, still a full-size target, with a gap from the top edge of
  // the phone, where the system's pull-down lives.
  expect(before.height).toBeGreaterThanOrEqual(44);
  expect(before.width).toBeLessThan(200);
  expect(before.y).toBeGreaterThanOrEqual(24);

  // A tap is not a hold: it earns the hint, under the bar, and the button has
  // not moved by a pixel, so a finger that then holds is still on it.
  await leave.click();
  const hint = page.getByText(HOLD_TO_LEAVE);
  await expect(hint).toBeVisible();
  expect(await leave.boundingBox()).toEqual(before);
  expect((await hint.boundingBox())!.y).toBeGreaterThanOrEqual(before.y + before.height);
  expect(await hint.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
});

// A Samsung in Chrome is about 360 px wide: the narrowest phone the layout is
// held to. 12.3 km to the north-east is the widest the distance row gets (a
// three-digit figure, a two-letter point) short of a hundred kilometres.
test.describe('at 360 px wide', () => {
  const FAR_SOUTH_WEST = { latitude: -37.95024, longitude: 145.26284 };

  test.beforeEach(async ({ page }) => {
    await openDial(page, 'no-pack');
    await page.setViewportSize({ width: 360, height: 800 });
    await pushPosition(page, FAR_SOUTH_WEST);
    await expect(distance(page)).toHaveText('12.3 km');
    await expect(page.locator('.blacksky-figure-point')).toHaveText('NE');
  });

  test('the other-places summary is one line and not clipped', async ({ page }) => {
    const line = othersLine(page);
    await expect(line).toHaveText(/^2 other places · \d+\.\d km – \d+\.\d km$/);
    const fit = await line.evaluate((button) => {
      const range = document.createRange();
      range.selectNodeContents(button);
      const style = getComputedStyle(button);
      return {
        clipped: button.scrollWidth > button.clientWidth,
        ellipsis: style.textOverflow === 'ellipsis',
        lines: new Set([...range.getClientRects()].map((box) => Math.round(box.top))).size,
        textInside: range.getBoundingClientRect().right <= button.getBoundingClientRect().right - parseFloat(style.paddingRight) + 0.5,
        height: button.getBoundingClientRect().height,
      };
    });
    expect(fit).toEqual({ clipped: false, ellipsis: false, lines: 1, textInside: true, height: fit.height });
    expect(fit.height).toBeGreaterThanOrEqual(44);
    // The full list is still one tap away, under the mandated phrase.
    await line.click();
    await expect(sheet(page).getByText(SORTED_BY_DISTANCE, { exact: true })).toBeVisible();
    await expect(sheet(page).getByRole('listitem')).toHaveCount(2);
  });

  test('the dial takes the width: at least 300 px, square, with nothing beside it', async ({ page }) => {
    const dial = (await page.locator('.blacksky-dial').boundingBox())!;
    const content = await page.locator('.blacksky-dial-body').evaluate((el) => el.getBoundingClientRect().width);
    expect(dial.width).toBeGreaterThanOrEqual(300);
    expect(dial.width).toBeCloseTo(content, 0);
    expect(Math.abs(dial.width - dial.height)).toBeLessThanOrEqual(1);
    // The North up tag stays inside the dial's own corner.
    const tag = (await page.getByText('North up', { exact: true }).boundingBox())!;
    expect(tag.x).toBeGreaterThanOrEqual(dial.x - 1);
    expect(tag.y).toBeGreaterThanOrEqual(dial.y - 1);
    expect(tag.y + tag.height).toBeLessThan(dial.y + dial.height / 2);
  });

  test('the distance row keeps 48 px free at its end, and nothing on it overlaps or wraps', async ({ page }) => {
    const row = await page.locator('.blacksky-dial-figures').evaluate((el) => {
      const box = (selector: string) => el.querySelector(selector)!.getBoundingClientRect();
      const [figure, beside, readout] = [box('.blacksky-figure-main'), box('.blacksky-dial-beside'), box('.blacksky-dial-readout')];
      const words = document.createRange();
      words.selectNodeContents(el.querySelector('.blacksky-dial-readout')!);
      return {
        rowRight: el.getBoundingClientRect().right,
        figureRight: figure.right,
        besideLeft: beside.left,
        besideRight: Math.max(beside.right, words.getBoundingClientRect().right),
        readoutLines: new Set([...words.getClientRects()].map((r) => Math.round(r.top))).size,
        readoutBottom: readout.bottom,
        rowBottom: el.getBoundingClientRect().bottom,
        overflow: el.scrollWidth > el.clientWidth,
      };
    });
    expect(row.besideLeft).toBeGreaterThanOrEqual(row.figureRight); // the point never sits on the figure
    expect(row.besideRight).toBeLessThanOrEqual(row.rowRight - 48); // the speaker button's place
    expect(row.readoutLines).toBe(1); // "± 10 m" on one line under the point
    expect(row.readoutBottom).toBeLessThanOrEqual(row.rowBottom + 0.5);
    expect(row.overflow).toBe(false);
  });
});

test('Normal, no pack: the nearest state-wide site is the subject', async ({ page }) => {
  await openDial(page, 'no-pack');
  await pushPosition(page, AT_FERNY_CREEK);

  await expect(label(page)).toHaveText('NEAREST PLACE OF LAST RESORT');
  // A name that cannot be split is shown whole, with no suburb line.
  await expect(name(page)).toHaveText('Belgrave Recreation Reserve');
  await expect(page.locator('.blacksky-dial-head p')).toHaveCount(0);
  await expect(distance(page)).toHaveText('2.13 km');
  await expect(othersLine(page)).toHaveText('2 other places · 4.09 km – 5.07 km');
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
