import { expect, test } from '@playwright/test';
import { deviceStorage, storedRehearsals } from './helpers';

const ORIGIN = 'http://127.0.0.1:4174';
const REHEARSABLE = `${ORIGIN}/rehearse?mode=rehearsable`;
const EMPTY = `${ORIGIN}/rehearse?mode=empty`;

const HEADING = 'What are we rehearsing without?';
const NO_DATA = 'No mobile data';
const NO_FIX = 'No location fix';
/** Each condition as it reads after "without". */
const WITHOUT: Record<string, string> = { [NO_DATA]: 'mobile data', [NO_FIX]: 'a location fix' };
const JOURNEY_HEADING = 'Rehearse the way on foot';
const GO = "I'm going now";

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

      // Chosen and not yet gone on (E5-US1-AC5): the journey screen names the
      // chosen condition in words, and never the other.
      await expect(page.getByText(`This rehearsal is without ${WITHOUT[label]}.`)).toBeVisible();
      await expect(page.locator('main')).not.toContainText(`without ${WITHOUT[other]}`);
      await page.getByRole('main').getByRole('button', { name: GO, exact: true }).click();

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

  // Choosing a condition is setup, not commitment (E5-US1-AC5): it writes
  // nothing at all. "I'm going now" keeps the started rehearsal, and ending it
  // records it over that same row (E5-US2-AC1). A rehearsal writes that one
  // record, and a note only if she writes one after walking (the test below).
  // Nothing about the pack is otherwise touched: a rehearsal reads the pack and
  // reports on it, and must never alter what it is reporting on.
  test('choosing writes nothing at all, and a rehearsal without a note writes only its own record', async ({
    page,
  }) => {
    await page.goto(REHEARSABLE);
    // The baseline is taken AFTER the screen is up: the harness seeds the pack
    // on load, so sampling earlier would compare against a half-seeded device
    // and call the harness's own writes a rehearsal's.
    await expect(page.getByRole('heading', { name: HEADING })).toBeVisible();
    const before = await deviceStorage(page);
    expect(before.recordCounts.rehearsals).toBe(0);

    // Choosing: nothing at all, given time for a late write to land.
    await page.getByRole('button', { name: new RegExp(NO_DATA) }).click();
    await expect(page.getByRole('heading', { name: JOURNEY_HEADING })).toBeVisible();
    await page.waitForTimeout(500);
    expect(await deviceStorage(page)).toEqual(before);

    // Going, then ending: the one record.
    await page.getByRole('main').getByRole('button', { name: GO, exact: true }).click();
    await page.getByRole('main').getByRole('button', { name: 'End without going', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Nothing was missing in this rehearsal' })).toBeVisible();
    await expect(page.locator('.rehearsal-bar-condition')).toHaveText(NO_DATA);
    // The started row and the finished one are the same row: one record, and it
    // has finished.
    await expect.poll(async () => (await deviceStorage(page)).recordCounts.rehearsals).toBe(1);
    await expect.poll(async () => typeof (await storedRehearsals(page))[0]?.finishedAt).toBe('number');

    const after = await deviceStorage(page);
    expect(after.recordCounts).toEqual({ ...before.recordCounts, rehearsals: 1 });
    expect(after.localStorageLength).toBe(before.localStorageLength);
    expect(after.sessionStorageLength).toBe(before.sessionStorageLength);
  });

  // E5-US1-AC5, step 3. After a walked rehearsal she may write a note about the
  // way. Without one, the device is unchanged beyond the one record; with one,
  // exactly one note row is added, and nothing else.
  test('a walked rehearsal writes its own record, and exactly one note row only if she writes one', async ({
    page,
  }) => {
    await page.goto(REHEARSABLE);
    await expect(page.getByRole('heading', { name: HEADING })).toBeVisible();
    const before = await deviceStorage(page);
    expect(before.recordCounts.rehearsals).toBe(0);

    await page.getByRole('button', { name: new RegExp(NO_DATA) }).click();
    await page.getByRole('main').getByRole('button', { name: GO, exact: true }).click();
    await page.getByRole('main').getByRole('button', { name: 'I have arrived', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Nothing was missing in this rehearsal' })).toBeVisible();
    await expect(page.getByLabel('Your note about the way')).toBeVisible();
    await expect.poll(async () => (await deviceStorage(page)).recordCounts.rehearsals).toBe(1);
    await expect.poll(async () => typeof (await storedRehearsals(page))[0]?.finishedAt).toBe('number');

    // Without a note: nothing beyond the one record, given time for a late write.
    await page.waitForTimeout(500);
    expect(await deviceStorage(page)).toEqual({
      ...before,
      recordCounts: { ...before.recordCounts, rehearsals: 1 },
    });

    // With a note: exactly one note row added, and nothing else.
    await page.getByLabel('Your note about the way').fill('The gate by the oval is locked after dark.');
    await page.getByRole('main').getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Note saved.')).toBeVisible();
    await expect.poll(async () => (await deviceStorage(page)).recordCounts.notes).toBe(before.recordCounts.notes + 1);
    await page.waitForTimeout(500);
    expect(await deviceStorage(page)).toEqual({
      ...before,
      recordCounts: { ...before.recordCounts, rehearsals: 1, notes: before.recordCounts.notes + 1 },
    });
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
  await expect(page.getByRole('heading', { name: JOURNEY_HEADING })).toBeVisible();
  await page.getByRole('main').getByRole('button', { name: GO, exact: true }).click();
  await expect(page.locator('.rehearsal-bar-condition')).toHaveText(NO_FIX);

  expect(offOrigin).toEqual([]);
});
