import { expect, test } from '@playwright/test';
import { HARNESS } from './helpers';

// E7. The drill stands in front of the rehearsal. Asserted here: the way in,
// the way past, one short minute played to its debrief, and the record.
test.describe('E7 the drill in front of the rehearsal', () => {
  test('opens on one quiet screen, and Skip the drill lands on the choice of condition', async ({ page }) => {
    await page.goto(`${HARNESS}/rehearse?mode=rehearsable&drill=1`);
    await expect(page.getByRole('heading', { name: 'One minute to leave' })).toBeVisible();
    await page.getByRole('button', { name: 'Skip the drill' }).click();
    await expect(page.locator('main')).toContainText('Rehearsal');
    await expect(page.getByRole('heading', { name: 'One minute to leave' })).toHaveCount(0);
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

  test('a minute away from the door ends with no score, and can be tried again', async ({ page }) => {
    await page.goto(`${HARNESS}/drill?seconds=2`);
    await page.getByRole('button', { name: 'Start the drill' }).click();
    await expect(page.getByRole('img', { name: /bushfire arrives/ })).toBeVisible();
    await page.getByRole('button', { name: 'Skip', exact: true }).click();
    await expect(page.locator('main')).toContainText('Bag 0 of 10');
    await expect(page.getByRole('heading', { name: 'The minute ended away from the door' })).toBeVisible();
    await expect(page.locator('main')).not.toContainText('out of 100');
    await expect(page.getByRole('heading', { name: 'Left in the house' })).toBeVisible();
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.locator('main')).toContainText('Bag 0 of 10');
  });

  test('the sound control says its state and the pack page lists no drill yet', async ({ page }) => {
    await page.goto(`${HARNESS}/drill`);
    const sound = page.getByRole('button', { name: 'Sound on' });
    await expect(sound).toHaveAttribute('aria-pressed', 'true');
    await sound.click();
    await expect(page.getByRole('button', { name: 'Sound off' })).toHaveAttribute('aria-pressed', 'false');
    await page.goto(`${HARNESS}/detail`);
    await page.getByRole('button', { name: /Show Drills/ }).click();
    await expect(page.locator('main')).toContainText('Not yet drilled.');
  });
});
