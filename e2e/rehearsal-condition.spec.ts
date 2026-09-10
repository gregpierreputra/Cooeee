import { expect, test } from '@playwright/test';
import { deviceStorage } from './helpers';

const ORIGIN = 'http://127.0.0.1:4174';
const REHEARSABLE = `${ORIGIN}/rehearse?mode=rehearsable`;
const EMPTY = `${ORIGIN}/rehearse?mode=empty`;

const HEADING = 'What are we rehearsing without?';
const NO_DATA = 'No mobile data';
const NO_FIX = 'No location fix';

// E5-US1-AC1 — the user says what the rehearsal is run without.
//
// The gate of AC4 decides first, and this screen is its only readable outcome,
// so a pack that cannot be rehearsed never reaches an empty choice. That is
// asserted here (TC-5.1.1-C) rather than assumed.

test.describe('AC1 both conditions are offered, and neither is chosen for the user', () => {
  // TC-5.1.1-A
  test('lists exactly the two supported conditions, in plain words', async ({ page }) => {
    await page.goto(REHEARSABLE);

    await expect(page.getByRole('heading', { name: HEADING })).toBeVisible();
    await expect(page.locator('.condition-list li')).toHaveCount(2);
    await expect(page.getByRole('button', { name: new RegExp(NO_DATA) })).toBeVisible();
    await expect(page.getByRole('button', { name: new RegExp(NO_FIX) })).toBeVisible();
    await expect(
      page.getByText('Nothing loads. Anything the phone did not already have is not there.'),
    ).toBeVisible();
    await expect(page.getByText('The phone cannot work out where it is.')).toBeVisible();
  });

  // TC-5.1.1-A. Nothing is pre-selected, and there is nothing that COULD be:
  // the rows are buttons with no selected state to carry.
  test('nothing is pre-selected, and no row carries a selected state at all', async ({ page }) => {
    await page.goto(REHEARSABLE);
    await expect(page.getByRole('heading', { name: HEADING })).toBeVisible();

    await expect(page.locator('.condition-list [aria-pressed="true"]')).toHaveCount(0);
    await expect(page.locator('.condition-list [aria-selected="true"]')).toHaveCount(0);
    await expect(page.locator('.condition-list [aria-checked="true"]')).toHaveCount(0);
    await expect(page.locator('.condition-list input')).toHaveCount(0);
    await expect(page.locator('.condition-list :checked')).toHaveCount(0);
    // No rehearsal has begun: the bar that marks a run is not there.
    await expect(page.locator('.rehearsal-bar')).toHaveCount(0);
  });

  test('neither condition is ranked, marked or weighted above the other', async ({ page }) => {
    await page.goto(REHEARSABLE);
    await expect(page.getByRole('heading', { name: HEADING })).toBeVisible();

    await expect(page.locator('main')).not.toContainText('recommended');
    await expect(page.locator('main')).not.toContainText('most likely');
    await expect(page.locator('main')).not.toContainText('Step 1');

    // Identical markup and identical size: neither row is visually first.
    const [first, second] = await page.locator('.condition-action').all();
    const [a, b] = [await first.boundingBox(), await second.boundingBox()];
    expect(await first.getAttribute('class')).toBe(await second.getAttribute('class'));
    expect(Math.abs(a!.width - b!.width)).toBeLessThanOrEqual(1);
  });

  // TC-5.1.1-D. The filled control means "this is what would fix it", and
  // choosing a disruption fixes nothing.
  test('has no filled control', async ({ page }) => {
    await page.goto(REHEARSABLE);
    await expect(page.getByRole('heading', { name: HEADING })).toBeVisible();

    await expect(page.locator('.main-action')).toHaveCount(0);
  });
});

// TC-5.1.1-B
test.describe('AC1 choosing carries exactly that one condition forward', () => {
  for (const [label, other] of [[NO_DATA, NO_FIX], [NO_FIX, NO_DATA]] as const) {
    test(`choosing "${label}" carries it, and never the other`, async ({ page }) => {
      await page.goto(REHEARSABLE);
      await page.getByRole('button', { name: new RegExp(label) }).click();

      // The chosen condition is carried onto the run, on the bar that marks it.
      await expect(page.locator('.rehearsal-bar-condition')).toHaveText(label);
      // The condition that was not chosen is nowhere: not on the bar, not
      // beside it, not as a second line.
      await expect(page.locator('.rehearsal-bar')).not.toContainText(other);
      await expect(page.locator('main')).not.toContainText(other);
      await expect(page.locator('.rehearsal-bar-condition')).toHaveCount(1);
      // The choice is made, so the choice is no longer being asked.
      await expect(page.getByRole('heading', { name: HEADING })).toHaveCount(0);
      await expect(page.locator('.condition-list')).toHaveCount(0);
    });
  }

  // Choosing a condition starts a rehearsal, and a rehearsal that has finished
  // is recorded — that is E5-US2-AC1, and it is the ONLY thing the choice may
  // write. Nothing about the pack is touched: a rehearsal reads the pack and
  // reports on it, and must never alter what it is reporting on.
  test('choosing writes nothing but the record of the rehearsal itself', async ({ page }) => {
    await page.goto(REHEARSABLE);
    // The baseline is taken AFTER the screen is up: the harness seeds the pack
    // on load, so sampling earlier would compare against a half-seeded device
    // and call the harness's own writes a rehearsal's.
    await expect(page.getByRole('heading', { name: HEADING })).toBeVisible();
    const before = await deviceStorage(page);
    expect(before.recordCounts.rehearsals).toBe(0);

    await page.getByRole('button', { name: new RegExp(NO_DATA) }).click();
    await expect(page.locator('.rehearsal-bar-condition')).toHaveText(NO_DATA);
    // The rehearsal has to have finished before its record exists.
    await expect.poll(async () => (await deviceStorage(page)).recordCounts.rehearsals).toBe(1);

    const after = await deviceStorage(page);
    expect(after.recordCounts).toEqual({ ...before.recordCounts, rehearsals: 1 });
    expect(after.localStorageLength).toBe(before.localStorageLength);
    expect(after.sessionStorageLength).toBe(before.sessionStorageLength);
  });
});

// TC-5.1.1-C
test('AC1 a pack that cannot be rehearsed reaches the gate, not an empty choice', async ({
  page,
}) => {
  await page.goto(EMPTY);

  await expect(page.getByRole('heading', { name: 'This pack holds nothing to rehearse' })).toBeVisible();
  await expect(page.getByRole('heading', { name: HEADING })).toHaveCount(0);
  await expect(page.locator('.condition-list')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText(NO_DATA);
  await expect(page.locator('main')).not.toContainText(NO_FIX);
});

// The choice reads the device once through the gate and nothing else.
test('AC1 the choice renders with zero off-origin requests', async ({ page }) => {
  const offOrigin: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(ORIGIN)) offOrigin.push(`${request.method()} ${request.url()}`);
  });

  await page.goto(REHEARSABLE);
  await expect(page.getByRole('heading', { name: HEADING })).toBeVisible();
  await page.getByRole('button', { name: new RegExp(NO_FIX) }).click();
  await expect(page.locator('.rehearsal-bar-condition')).toHaveText(NO_FIX);

  expect(offOrigin).toEqual([]);
});
