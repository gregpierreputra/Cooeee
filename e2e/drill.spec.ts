import { expect, test, type Page } from '@playwright/test';
import { rulesFor } from '../src/core/drill-twists';
import { HARNESS } from './helpers';

/** Past the film and the guide, the clock running. */
async function playing(page: Page, query: string) {
  await page.goto(`${HARNESS}/drill?${query}`);
  await page.getByRole('button', { name: 'Start the drill' }).click();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await page.getByRole('dialog').click();
  await expect(page.locator('.drill-stage canvas')).toHaveAttribute('data-camera', /\d/);
}

/** Where a place in the house, in tiles, is on the page, from the canvas's camera. */
async function tileOnScreen(page: Page, x: number, y: number) {
  const canvas = page.locator('.drill-stage canvas');
  const [left, top, perCss] = (await canvas.getAttribute('data-camera'))!.split(',').map(Number);
  const frame = (await canvas.boundingBox())!;
  return { x: frame.x + (x * 16 - left) / perCss, y: frame.y + (y * 16 - top) / perCss };
}

/** The middle of one slot of the bag strip on the page, laid out as the game lays it out. */
async function slotOnScreen(page: Page, slot: number, bagLimit: number) {
  const canvas = page.locator('.drill-stage canvas');
  const perCss = Number((await canvas.getAttribute('data-camera'))!.split(',')[2]);
  const frame = (await canvas.boundingBox())!;
  const width = frame.width * perCss;
  const size = Math.min(16, Math.floor((width - 8) / bagLimit));
  const startX = Math.round((width - bagLimit * size) / 2);
  return { x: frame.x + (startX + slot * size + size / 2) / perCss, y: frame.y + (frame.height * perCss - 20 + 8) / perCss };
}

/** How many pixels of the house, above the bag strip whose full slots are
 *  outlined in the same green, are the door arrow's green. */
const arrowGreen = (page: Page) =>
  page.locator('.drill-stage canvas').evaluate((canvas: HTMLCanvasElement) => {
    const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, Math.round(canvas.height * 0.8));
    let count = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] === 91 && data[i + 1] === 227 && data[i + 2] === 138) count++;
    return count;
  });

// E9. The drill, one of the quick games on Rehearse. Asserted here: its first
// screen, one short clock played to its debrief, and the record.
test.describe('E9 the drill', () => {
  test('opens on one quiet screen with Start alone, and a rehearsal no longer opens on it', async ({ page }) => {
    await page.goto(`${HARNESS}/drill`);
    await expect(page.getByRole('heading', { name: 'Two minutes to leave' })).toBeVisible();
    await expect(page.locator('main .actions button')).toHaveText(['Start the drill']);
    await page.goto(`${HARNESS}/rehearse?mode=rehearsable`);
    await expect(page.getByRole('heading', { name: 'Rehearse with…' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Two minutes to leave' })).toHaveCount(0);
  });

  // The house from above, as the game draws it, with rings round the door and
  // a few things to pack: a picture only, with Start still in view on a phone.
  test('shows the house as the game draws it, ringed, over the facts', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${HARNESS}/drill`);
    const snapshot = page.locator('.drill-house-snapshot');
    await expect(snapshot).toBeVisible();
    await expect(snapshot).toHaveAttribute('aria-hidden', 'true');
    await expect(snapshot.locator('.drill-snapshot-ring')).toHaveCount(4);
    // Drawn: the canvas holds the house, not a blank.
    await expect
      .poll(() => snapshot.locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.getContext('2d')!.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data[3]))
      .toBe(255);
    await expect(page.getByRole('button', { name: 'Start the drill' })).toBeInViewport({ ratio: 1 });
  });

  // Silent mode mutes the games on an iPhone or iPad however loud it is, and
  // the page cannot see it, so the Sound button says so there, and only there.
  test('says silent mode mutes the sound beside the Sound button, on an iPhone only', async ({ page, browser }) => {
    await page.goto(`${HARNESS}/drill`);
    await expect(page.getByRole('button', { name: 'Sound' })).toBeVisible();
    await expect(page.locator('.drill-silent-note')).toHaveCount(0);
    const iphone = await browser.newContext({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      viewport: { width: 390, height: 844 },
    });
    const phone = await iphone.newPage();
    for (const game of ['drill', 'block']) {
      await phone.goto(`${HARNESS}/${game}`);
      await expect(phone.locator('.drill-head')).toContainText('On iPhone and iPad, sound needs silent mode off.');
    }
    await iphone.close();
  });

  test('the film shows each fact with its publisher over the fire', async ({ page }) => {
    await page.goto(`${HARNESS}/drill`);
    await page.getByRole('button', { name: 'Start the drill' }).click();
    await expect(page.getByRole('img', { name: /bushfire arrives/ })).toBeVisible();
    await expect(page.locator('.drill-fact')).toContainText('Grassfires can travel 25 kilometres an hour.');
    await expect(page.locator('.drill-fact')).toContainText('Country Fire Authority');
    await page.getByRole('button', { name: 'Leave the drill' }).click();
    await expect(page).toHaveTitle('drill done');
  });

  test('time running out away from the door ends with no score, and can be tried again', async ({ page }) => {
    await page.goto(`${HARNESS}/drill?seconds=2`);
    await page.getByRole('button', { name: 'Start the drill' }).click();
    await expect(page.getByRole('img', { name: /bushfire arrives/ })).toBeVisible();
    await page.getByRole('button', { name: 'Skip', exact: true }).click();
    await expect(page.locator('main')).toContainText('Bag 0 of 10');
    // The guide holds the clock until a tap anywhere starts it.
    const guide = page.getByRole('dialog', { name: 'Pack ten things, then be at the front door when the time ends.' });
    await expect(guide).toBeVisible();
    await page.waitForTimeout(1200);
    await expect(page.locator('.drill-timer')).toHaveText('0:02');
    await guide.click();
    // The end of the clock goes straight to the report.
    await expect(page.getByRole('heading', { name: 'Time ran out away from the door' })).toBeVisible();
    await expect(page.locator('main')).not.toContainText('out of 100');
    await expect(page.getByRole('heading', { name: 'Left behind' })).toBeVisible();
    await page.getByRole('button', { name: 'torch' }).click();
    await expect(page.locator('.drill-why')).toContainText('Smoke makes midday dark.');
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.locator('main')).toContainText('Bag 0 of 10');
    // Playing again goes straight to the clock, with no guide.
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('the grab button names the thing in reach, and is dim with nothing near', async ({ page }) => {
    await page.goto(`${HARNESS}/drill?seconds=60`);
    await page.getByRole('button', { name: 'Start the drill' }).click();
    await page.getByRole('button', { name: 'Skip', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeFocused();
    await page.keyboard.press('Enter');
    // The figure starts beside the floor lamp.
    await expect(page.getByRole('button', { name: 'Grab the floor lamp' })).toBeEnabled();
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(700);
    await page.keyboard.up('ArrowLeft');
    await page.keyboard.down('ArrowDown');
    await page.waitForTimeout(500);
    await page.keyboard.up('ArrowDown');
    await expect(page.getByRole('button', { name: 'Nothing in reach' })).toBeDisabled();
  });

  test('Space starts the drill from the guide, then grabs the thing in reach', async ({ page }) => {
    await page.goto(`${HARNESS}/drill?seconds=60`);
    await page.getByRole('button', { name: 'Start the drill' }).click();
    await page.getByRole('button', { name: 'Skip', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeFocused();
    await page.keyboard.press(' ');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Grab the floor lamp' })).toBeEnabled();
    await page.keyboard.press(' ');
    await expect(page.locator('main')).toContainText('Bag 1 of 10');
  });

  // A thing packed by mistake can go back to its place: Backspace puts back
  // the last, a tap on the bag strip the one tapped. Each is said under the clock.
  test('a thing in the bag can be put back, by Backspace or a tap on its slot', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await playing(page, 'seconds=60');
    const count = page.locator('.drill-bag');
    await expect(page.getByRole('button', { name: 'Grab the floor lamp' })).toBeEnabled();
    await page.keyboard.press(' ');
    await expect(count).toContainText('1/10');
    // The figure bends to pack: the next grab waits for it.
    await page.waitForTimeout(450);
    await expect(page.getByRole('button', { name: 'Grab the family photos' })).toBeEnabled();
    await page.keyboard.press(' ');
    await expect(count).toContainText('2/10');

    await page.keyboard.press('Backspace');
    await expect(count).toContainText('1/10');
    await expect(page.locator('.drill-goal')).toHaveText('Put back the family photos.');
    // Back in its place, so it can be grabbed again.
    await expect(page.getByRole('button', { name: 'Grab the family photos' })).toBeEnabled();

    const slot = await slotOnScreen(page, 0, 10);
    await page.mouse.click(slot.x, slot.y);
    await expect(count).toContainText('0/10');
    await expect(page.locator('.drill-goal')).toHaveText('Put back the floor lamp.');
  });

  // A full bag turns the count green, sends the player to the door with the
  // arrow, and a grab tried then shakes the count red.
  test('a full bag shows the way out and refuses one more', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await playing(page, 'seconds=100&twist=day-pack');
    const count = page.locator('.drill-bag');
    expect(await arrowGreen(page)).toBe(0);
    // The two beside the start, then three more round the living room, off
    // the door mat, whose hold ring is the arrow's green too.
    let packed = 0;
    for (const [x, y] of [[24.5, 7.5], [21.5, 6.3], [21, 4.4], [26.5, 3.6]]) {
      const at = await tileOnScreen(page, x, y);
      await page.mouse.click(at.x, at.y);
      for (let tries = 0; tries < 2 && packed < 5; tries++) {
        const grab = page.getByRole('button', { name: /^Grab the/ });
        if (!(await grab.isEnabled({ timeout: 6000 }).catch(() => false))) break;
        await page.keyboard.press(' ');
        packed++;
        await expect(count).toContainText(`${packed}/5`);
        await page.waitForTimeout(450);
      }
      if (packed === 5) break;
    }
    expect(packed).toBe(5);
    await expect(count).toHaveClass(/full/);
    await expect(page.locator('.drill-goal')).toHaveText('Bag full. Head to the front door.');
    await expect.poll(() => arrowGreen(page)).toBeGreaterThan(30);

    // Something still in reach, but no room: the count shakes red.
    const plant = rulesFor('day-pack').items.find((item) => item.id === 'plant')!;
    const near = await tileOnScreen(page, plant.x, plant.y + 0.4);
    await page.mouse.click(near.x, near.y);
    await expect(page.getByRole('button', { name: 'Bag full' })).toHaveAttribute('aria-disabled', 'true', { timeout: 8000 });
    await page.keyboard.press(' ');
    await expect(count).toHaveClass(/refused/);
    await expect(count).toContainText('5/5');
  });

  test('the clock says the rule, turns red near the end and sends the player to the door', async ({ page }) => {
    await page.goto(`${HARNESS}/drill?seconds=60`);
    await page.getByRole('button', { name: 'Start the drill' }).click();
    await page.getByRole('button', { name: 'Skip', exact: true }).click();
    await page.getByRole('dialog').click();
    const top = page.locator('.drill-top');
    await expect(page.locator('.drill-goal')).toHaveText('Be at the front door when the time ends.');
    await expect(top).not.toHaveClass(/warn|late/);
    await page.goto(`${HARNESS}/drill?seconds=15`);
    await page.getByRole('button', { name: 'Start the drill' }).click();
    await page.getByRole('button', { name: 'Skip', exact: true }).click();
    await page.getByRole('dialog').click();
    await expect(top).toHaveClass(/warn/);
    await expect(page.locator('.drill-goal')).toHaveText('Head to the front door.');
    await expect(top).toHaveClass(/late/, { timeout: 8000 });
  });

  test('the sound control says its state, and the drill lists no past drill yet', async ({ page }) => {
    await page.goto(`${HARNESS}/drill`);
    const sound = page.getByRole('button', { name: 'Sound', exact: true });
    await expect(sound).toHaveAttribute('aria-pressed', 'true');
    await sound.click();
    await expect(sound).toHaveAttribute('aria-pressed', 'false');
    await expect(sound).toHaveClass(/off/);
    await expect(page.locator('main')).toContainText('Not yet drilled.');
    await expect(page.getByRole('button', { name: 'Clear drill results' })).toHaveCount(0);
  });

  // Past drills belong to no pack: they are listed under Start on the drill's
  // own screen, not on the pack page, and can all be cleared after one question.
  test('a finished drill is listed under Start, and Clear drill results asks first', async ({ page }) => {
    await page.goto(`${HARNESS}/drill?seconds=2`);
    // Framed for families: who it is for, before Start.
    await expect(page.locator('.hero')).toContainText('Made for children about 6 to 12. Do it together, then talk about what you packed.');
    await page.getByRole('button', { name: 'Start the drill' }).click();
    await page.getByRole('button', { name: 'Skip', exact: true }).click();
    await page.getByRole('dialog').click();
    await expect(page.getByRole('heading', { name: 'Time ran out away from the door' })).toBeVisible();
    // The report ends with things to talk over together, the last about an
    // essential this drill left behind (here all of them, medicines first).
    const talk = page.locator('section', { has: page.getByRole('heading', { name: 'Talk it over' }) });
    await expect(talk.getByRole('listitem')).toHaveText([
      'Where is your real emergency kit kept?',
      'Who would carry what if you had to leave?',
      'You left the medicines behind. Who in your home needs medicines every day?',
    ]);

    await page.reload();
    const past = page.locator('.pack-section', { hasText: 'Past drills' });
    await expect(past.locator('.history-row')).toHaveCount(1);
    await expect(past.locator('.history-row .place-kind')).toHaveText('Classic');
    await expect(past.locator('.history-row .debrief-empty')).toHaveCount(10);
    await expect(past).toContainText('Away from the door when time ran out');

    await page.getByRole('button', { name: 'Clear drill results' }).click();
    await expect(page.getByText('Clear every drill result on this phone?')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Keep them' })).toBeFocused();
    await page.getByRole('button', { name: 'Keep them' }).click();
    await expect(past.locator('.history-row')).toHaveCount(1);

    await page.getByRole('button', { name: 'Clear drill results' }).click();
    await page.getByRole('button', { name: 'Clear them' }).click();
    await expect(past).toContainText('Not yet drilled.');
    await page.reload();
    await expect(page.locator('.pack-section', { hasText: 'Past drills' })).toContainText('Not yet drilled.');
  });

  test('plays under a twist: its bag, its rule, and its own highest score', async ({ page }) => {
    await page.goto(`${HARNESS}/drill?seconds=2&twist=small-bag`);
    await expect(page.locator('.drill-twist')).toContainText('Small bag');
    await expect(page.locator('.drill-twist')).toContainText('Only seven things fit in the bag.');
    await page.getByRole('button', { name: 'Start the drill' }).click();
    await page.getByRole('button', { name: 'Skip', exact: true }).click();
    await expect(page.locator('main')).toContainText('Bag 0 of 7');

    // Listed under Start with the twist's own seven empty slots, as on the debrief.
    await page.getByRole('dialog').click();
    await expect(page.getByRole('heading', { name: 'Time ran out away from the door' })).toBeVisible();
    await page.reload();
    const row = page.locator('.pack-section', { hasText: 'Past drills' }).locator('.history-row');
    await expect(row.locator('.place-kind')).toHaveText('Small bag');
    await expect(row.locator('.debrief-empty')).toHaveCount(7);
  });
});

