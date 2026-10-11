import { expect, test, type Page } from '@playwright/test';
import { boxOf, hazardsForDay } from '../src/core/block';
import { BLOCK_DECOYS } from '../src/core/block-hazards';
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
    await page.getByRole('button', { name: 'Start looking' }).click();
    await expect(page.getByRole('img', { name: /yard seen from above/ })).toBeVisible();
    await expect(page.locator('.drill-bag')).toHaveText('Found 0 of 8');
    await expect(page.locator('.drill-timer')).toHaveText(/^[23]:\d\d$/);
  });

  test('a tap on a risk finds it; a tap on a harmless thing costs a little', async ({ page }) => {
    await page.goto(`${HARNESS}/block`);
    await page.getByRole('button', { name: 'Start looking' }).click();
    await wholeYard(page);
    const [first] = hazards;
    const at = await onScreen(page, first.sprite, first.x, first.y);
    await page.mouse.click(at.x, at.y);
    await expect(page.locator('.drill-bag')).toHaveText('Found 1 of 8');
    await expect(page.locator('.block-message')).toHaveText(`Found ${first.name}.`);

    const decoy = BLOCK_DECOYS.find((candidate) => candidate.id === 'car')!;
    const car = await onScreen(page, decoy.sprite, decoy.x, decoy.y);
    await page.mouse.click(car.x, car.y);
    await expect(page.locator('.block-message')).toContainText('The car. Nothing to fix there.');
  });

  test('a hint is spent and named, up to three', async ({ page }) => {
    await page.goto(`${HARNESS}/block`);
    await page.getByRole('button', { name: 'Start looking' }).click();
    await page.getByRole('button', { name: 'Hint, 3 left' }).click();
    await expect(page.locator('.block-message')).toHaveText('Look inside the ring.');
    await page.getByRole('button', { name: 'Hint, 2 left' }).click();
    await page.getByRole('button', { name: 'Hint, 1 left' }).click();
    await expect(page.getByRole('button', { name: 'Hint, 0 left' })).toBeDisabled();
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
