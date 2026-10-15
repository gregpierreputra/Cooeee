import { expect, test, type Page } from '@playwright/test';
import { boxOf, hazardsForDay } from '../src/core/block';
import { BLOCK_DECOYS, BLOCK_HAZARDS } from '../src/core/block-hazards';
import { BLOCK_SCENERY } from '../src/core/block-layout';
import { HARNESS } from './helpers';

// Ready the Block, on the harness's fixed day.
const hazards = hazardsForDay(20_736);

/** Where on the page a thing in the yard is drawn, from the canvas's camera. */
async function onScreen(page: Page, sprite: string, x: number, y: number) {
  const canvas = page.locator('.block-stage canvas');
  const [left, top, scale, ratio] = (await canvas.getAttribute('data-camera'))!.split(',').map(Number);
  const frame = (await canvas.boundingBox())!;
  const box = boxOf(sprite, x, y);
  const middleX = (box.x0 + box.x1) / 2;
  const middleY = (box.y0 + box.y1) / 2;
  return { x: frame.x + ((middleX - left) * scale) / ratio, y: frame.y + ((middleY - top) * scale) / ratio };
}

async function wholeYard(page: Page) {
  const zoomOut = page.getByRole('button', { name: 'Zoom out' });
  for (let i = 0; i < 12; i++) await zoomOut.click();
  await expect(page.locator('.block-stage canvas')).toHaveAttribute('data-camera', /,1,1$/);
}

test.describe('Ready the Block', () => {
  test('opens on what it asks, then the yard', async ({ page }) => {
    await page.goto(`${HARNESS}/block`);
    await expect(page.getByRole('heading', { name: 'Find the fire risks' })).toBeVisible();
    // The yard as a picture, with its harmless things and none of the risks.
    await expect(page.locator('.block-yard img')).toBeVisible();
    await expect(page.locator('.block-yard-thing')).toHaveCount(BLOCK_SCENERY.length + BLOCK_DECOYS.length);
    await expect(page.locator('.game-facts li')).toHaveText([/fire risks round the home/, /3:00\s*to find them/, /Tap\s*each one you spot/]);
    await page.getByRole('button', { name: 'Start looking' }).click();
    await expect(page.getByRole('img', { name: /yard seen from above/ })).toBeVisible();
    await expect(page.locator('.block-found')).toHaveText('Found 0 of 8');
    // On screen in full, not only in the page.
    await expect(page.locator('.block-found')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('.drill-timer')).toHaveText(/^[23]:\d\d$/);
  });

  test('a tap on a risk finds it; a tap on a harmless thing costs a little', async ({ page }) => {
    await page.goto(`${HARNESS}/block`);
    await page.getByRole('button', { name: 'Start looking' }).click();
    await wholeYard(page);
    const [first] = hazards;
    const at = await onScreen(page, first.sprite, first.x, first.y);
    await page.mouse.click(at.x, at.y);
    await expect(page.locator('.block-found')).toHaveText('Found 1 of 8');
    // A find in green with its tick and its points, and the score beside the count.
    const message = page.locator('.block-message');
    await expect(message).toContainText(`Found ${first.name}.`);
    await expect(message).toHaveClass(/tone-found/);
    await expect(message.locator('.block-points')).toContainText('+13');
    await expect(page.locator('.block-score')).toHaveText('Score13');

    const decoy = BLOCK_DECOYS.find((candidate) => candidate.id === 'car')!;
    const car = await onScreen(page, decoy.sprite, decoy.x, decoy.y);
    await page.mouse.click(car.x, car.y);
    await expect(message).toContainText('The car. Nothing to fix there.');
    await expect(message).toHaveClass(/tone-wrong/);
    await expect(message.locator('.block-points')).toContainText('\u22124');
    await expect(page.locator('.block-score')).toHaveText('Score9');
  });

  // A wrong tap before any find takes the score below 0 and shows it, and
  // the next find adds its full points from there.
  test('the score shows a cost below 0 and a find adds its points from there', async ({ page }) => {
    await page.goto(`${HARNESS}/block`);
    await page.getByRole('button', { name: 'Start looking' }).click();
    await wholeYard(page);
    const decoy = BLOCK_DECOYS.find((candidate) => candidate.id === 'car')!;
    const car = await onScreen(page, decoy.sprite, decoy.x, decoy.y);
    await page.mouse.click(car.x, car.y);
    const score = page.locator('.block-score');
    await expect(score).toHaveText('Score\u22124');
    await expect(score).toHaveClass(/below/);
    const [first] = hazards;
    const at = await onScreen(page, first.sprite, first.x, first.y);
    await page.mouse.click(at.x, at.y);
    await expect(score).toHaveText('Score9');
    await expect(score).not.toHaveClass(/below/);
  });

  // A risk not in today's eight is drawn as it looks once dealt with, and a
  // tap on it says what is there, not only that it was dealt with.
  test('a tap on a risk already dealt with names what is there', async ({ page }) => {
    await page.goto(`${HARNESS}/block`);
    await page.getByRole('button', { name: 'Start looking' }).click();
    await wholeYard(page);
    const today = new Set(hazards.map((hazard) => hazard.id));
    const safe = BLOCK_HAZARDS.find((hazard) => !today.has(hazard.id) && hazard.cleared && hazard.clearedName)!;
    const at = await onScreen(page, safe.cleared!, safe.x, safe.y);
    await page.mouse.click(at.x, at.y);
    const name = safe.clearedName!;
    await expect(page.locator('.block-message')).toContainText(`${name[0].toUpperCase()}${name.slice(1)}. Already dealt with, nothing to fix.`);
    await expect(page.locator('.block-message')).toHaveClass(/tone-wrong/);
  });

  // A trackpad sends many small scrolls in one swipe: they add up to one step
  // of zoom, never racing from one end to the other.
  test('small scrolls add up to one step of zoom', async ({ page }) => {
    await page.goto(`${HARNESS}/block`);
    await page.getByRole('button', { name: 'Start looking' }).click();
    const canvas = page.locator('.block-stage canvas');
    await expect(canvas).toHaveAttribute('data-camera', /\d/);
    const scaleNow = async () => Number((await canvas.getAttribute('data-camera'))!.split(',')[2]);
    const before = await scaleNow();
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    for (let i = 0; i < 3; i++) await page.mouse.wheel(0, -10);
    await page.waitForTimeout(100);
    expect(await scaleNow()).toBe(before);
    await page.mouse.wheel(0, -10);
    await expect.poll(scaleNow).toBe(before + 1);
    // A part step is forgotten after a rest, so the next swipe starts afresh.
    for (let i = 0; i < 3; i++) await page.mouse.wheel(0, -10);
    await page.waitForTimeout(400);
    for (let i = 0; i < 3; i++) await page.mouse.wheel(0, -10);
    await page.waitForTimeout(100);
    expect(await scaleNow()).toBe(before + 1);
  });

  // Scrolling or a trackpad pinch (a scroll with Ctrl held) over the yard is
  // kept by the yard: it zooms the yard, and the browser neither scrolls the
  // page nor zooms it with its buttons.
  test('scrolling or pinching over the yard zooms the yard only', async ({ page }) => {
    await page.goto(`${HARNESS}/block`);
    await page.getByRole('button', { name: 'Start looking' }).click();
    await wholeYard(page);
    const canvas = page.locator('.block-stage canvas');
    const scaleNow = async () => Number((await canvas.getAttribute('data-camera'))!.split(',')[2]);
    await page.evaluate(() => {
      const kept: boolean[] = [];
      (window as unknown as { kept: boolean[] }).kept = kept;
      window.addEventListener('wheel', (event) => kept.push(event.defaultPrevented));
    });
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -40);
    await expect.poll(scaleNow).toBe(2);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -10);
    await page.keyboard.up('Control');
    await expect.poll(scaleNow).toBe(3);
    expect(await page.evaluate(() => (window as unknown as { kept: boolean[] }).kept)).toEqual([true, true]);
  });

  test('a hint is spent and named, up to three', async ({ page }) => {
    await page.goto(`${HARNESS}/block`);
    await page.getByRole('button', { name: 'Start looking' }).click();
    // A hint moves the camera, so it waits for the yard to be drawn.
    await expect(page.locator('.block-stage canvas')).toHaveAttribute('data-camera', /\d/);
    await page.getByRole('button', { name: 'Hint, 3 left' }).click();
    await expect(page.locator('.block-message')).toContainText('Look inside the ring.');
    await expect(page.locator('.block-message .block-points')).toContainText('\u221210');
    await expect(page.locator('.block-message')).toBeInViewport({ ratio: 1 });
    await page.getByRole('button', { name: 'Hint, 2 left' }).click();
    await page.getByRole('button', { name: 'Hint, 1 left' }).click();
    await expect(page.getByRole('button', { name: 'Hint, 0 left' })).toBeDisabled();
  });

  // The end is not a jump: the yard stays a moment with the last ring and
  // what it means, then the result opens.
  test('finding the last risk pauses on the yard, saying so, before the result', async ({ page }) => {
    await page.goto(`${HARNESS}/block`);
    await page.getByRole('button', { name: 'Start looking' }).click();
    await wholeYard(page);
    for (const hazard of hazards) {
      const at = await onScreen(page, hazard.sprite, hazard.x, hazard.y);
      await page.mouse.click(at.x, at.y);
    }
    // The last find says what it found, then that all eight are found.
    const last = hazards[hazards.length - 1];
    await expect(page.locator('.block-message')).toContainText(`Found ${last.name}. You found all eight.`);
    await expect(page.locator('.block-stage canvas')).toBeVisible();
    await expect(page.locator('.block-found')).toHaveText('Found 8 of 8');
    await expect(page.locator('.block-row')).toHaveCount(0);
    await expect(page.locator('.block-row')).toHaveCount(8, { timeout: 5000 });
  });

  test('the clock running out pauses on the yard, saying so, before the result', async ({ page }) => {
    await page.goto(`${HARNESS}/block?seconds=2`);
    await page.getByRole('button', { name: 'Start looking' }).click();
    await expect(page.locator('.block-message')).toHaveText('Time is up', { timeout: 5000 });
    await expect(page.locator('.block-stage canvas')).toBeVisible();
    await expect(page.locator('.block-row')).toHaveCount(8, { timeout: 5000 });
  });

  test('time running out shows every risk, found or missed, with why', async ({ page }) => {
    await page.goto(`${HARNESS}/block?seconds=2`);
    await page.getByRole('button', { name: 'Start looking' }).click();
    await expect(page.getByRole('heading', { name: 'Plenty still to spot' })).toBeVisible({ timeout: 10_000 });
    const rows = page.locator('.block-row');
    await expect(rows).toHaveCount(8);
    await expect(rows.first()).toContainText('Missed');
    await expect(rows.first()).toContainText(hazards[0].reason);
    await expect(page.locator('main')).toContainText('Your highest so far is 0 out of 100.');
    await page.getByRole('button', { name: 'Play again' }).click();
    await expect(page.getByRole('img', { name: /yard seen from above/ })).toBeVisible();
  });
});
