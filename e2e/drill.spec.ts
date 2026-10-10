import { expect, test } from '@playwright/test';
import { HARNESS } from './helpers';

// E9. The drill stands in front of the rehearsal. Asserted here: the way in,
// the way past, one short clock played to its debrief, and the record.
test.describe('E9 the drill in front of the rehearsal', () => {
  test('opens on one quiet screen, and Skip the drill lands on the choice of condition', async ({ page }) => {
    await page.goto(`${HARNESS}/rehearse?mode=rehearsable&drill=1`);
    await expect(page.getByRole('heading', { name: 'Two minutes to leave' })).toBeVisible();
    await page.getByRole('button', { name: 'Skip the drill' }).click();
    await expect(page.locator('main')).toContainText('Rehearsal');
    await expect(page.getByRole('heading', { name: 'Two minutes to leave' })).toHaveCount(0);
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
    await expect(page.locator('.debrief-why')).toContainText('Smoke makes midday dark.');
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

  test('the sound control says its state and the pack page lists no drill yet', async ({ page }) => {
    await page.goto(`${HARNESS}/drill`);
    const sound = page.getByRole('button', { name: 'Sound', exact: true });
    await expect(sound).toHaveAttribute('aria-pressed', 'true');
    await sound.click();
    await expect(sound).toHaveAttribute('aria-pressed', 'false');
    await expect(sound).toHaveClass(/off/);
    await page.goto(`${HARNESS}/detail`);
    await page.getByRole('tab', { name: 'Practice' }).click();
    await expect(page.locator('main')).toContainText('Not yet drilled.');
  });

  test('the Rehearse screen offers the drill again at any time', async ({ page }) => {
    await page.goto(`${HARNESS}/rehearse?mode=rehearsable`);
    await expect(page.getByRole('heading', { name: 'Rehearse without…' })).toBeVisible();
    await page.getByRole('button', { name: /Play the drill/ }).click();
    await expect(page.getByRole('heading', { name: 'Two minutes to leave' })).toBeVisible();
  });
});
