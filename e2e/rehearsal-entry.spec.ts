import { expect, test, type Page } from '@playwright/test';
import { deviceStorage } from './helpers';

/** The criterion's "Never appears" list: a progress indicator, a step counter,
 *  and any wording that belongs to a running or a finished rehearsal. Asserted
 *  in BOTH stopped states, because a rehearsal that quietly started with
 *  nothing in it is the failure this criterion exists to prevent, and it would
 *  be no less a failure in one state than in the other. */
async function expectNoRehearsalSurface(page: Page) {
  await expect(page.locator('.page.rehearsal-entry [role="progressbar"]')).toHaveCount(0);
  await expect(page.locator('.page.rehearsal-entry progress')).toHaveCount(0);
  for (const wording of [
    'Step 1',
    'Step 1 of',
    'Rehearsal complete',
    'Rehearsal in progress',
    'Rehearsing',
    'Gaps found',
    'Finish rehearsal',
    'End rehearsal',
  ]) {
    await expect(page.locator('main')).not.toContainText(wording);
  }
}

const ORIGIN = 'http://127.0.0.1:4174';
const EMPTY = `${ORIGIN}/rehearse?mode=empty`;
const UNREADABLE = `${ORIGIN}/rehearse?mode=unreadable`;

const NOTHING_HEADING = 'This pack holds nothing to rehearse';
const UNREADABLE_HEADING = 'This pack could not be read';
const NOTHING_DETAIL =
  'Kalorama, saved 3 March 2026, holds no designation recorded for its address, and no official place saved with it.';
const UNREADABLE_DETAIL =
  'Cooeee read this pack from the device, and the saved places did not match what the pack recorded, so they were not used.';

// E5-US1-AC4 has four states. Only two of them are reachable in a running app,
// and this file covers exactly those two.
//
// 'Incomplete' cannot be reached: sweepBuilding() runs in main.tsx before the
// first render and deletes every status 'building' pack, so no unfinished build
// survives to a screen. 'No pack' cannot be reached either: the only trigger is
// the link on the pack page, which needs a complete pack to exist at all. Both
// states are built and both are covered by unit tests in
// tests/core/rehearsal-entry.test.ts; neither is demonstrable through the
// browser, and a spec that pretended otherwise would be asserting a path no
// user can take.

test.describe('AC4 the pack holds nothing to rehearse', () => {
  test('names what the pack does not hold, and the date it was saved', async ({ page }) => {
    await page.goto(EMPTY);

    // The heading is the first thing in the card: nothing above it repeats it.
    await expect(page.getByRole('heading', { name: NOTHING_HEADING })).toBeVisible();
    await expect(page.locator('.card > *').first()).toHaveText(NOTHING_HEADING);
    await expect(page.getByText(NOTHING_DETAIL)).toBeVisible();
    await expect(
      page.getByText(
        'A rehearsal runs from one of those two. Building this pack again, once the official information covers this address, is what would add them.',
      ),
    ).toBeVisible();
  });

  test('no rehearsal starts: no rehearsal surface, and nothing reads as reassurance', async ({ page }) => {
    await page.goto(EMPTY);
    await expect(page.getByRole('heading', { name: NOTHING_HEADING })).toBeVisible();
    await expectNoRehearsalSurface(page);

    // The other stopped state's wording must not leak into this one.
    await expect(page.locator('main')).not.toContainText('was not finished');
    await expect(page.locator('main')).not.toContainText('could not be read');
  });

  test('writes nothing to the device', async ({ page }) => {
    await page.goto(EMPTY);
    await expect(page.getByText(NOTHING_DETAIL)).toBeVisible();
    const before = await deviceStorage(page);

    // Read the screen again; the gate is the only thing that has run.
    await page.reload();
    await expect(page.getByText(NOTHING_DETAIL)).toBeVisible();

    expect(await deviceStorage(page)).toEqual(before);
  });
});

test.describe('AC4 the pack could not be read', () => {
  test('names the part that was withheld, not an unspecified problem', async ({ page }) => {
    await page.goto(UNREADABLE);

    await expect(page.getByRole('heading', { name: UNREADABLE_HEADING })).toBeVisible();
    await expect(page.locator('.card > *').first()).toHaveText(UNREADABLE_HEADING);
    await expect(page.getByText(UNREADABLE_DETAIL)).toBeVisible();
    await expect(
      page.getByText('An offline pack built for this address again would restore it.'),
    ).toBeVisible();
    // Two paragraphs, not three: the state no longer explains the other state.
    await expect(page.locator('.card p')).toHaveCount(2);
  });

  // Shared rule 0.1: a failed check and absent data are separate states, and
  // the screen has to keep them separate in words the user can act on.
  test('reads as plainly different from a pack that was never finished', async ({ page }) => {
    await page.goto(UNREADABLE);
    await expect(page.getByRole('heading', { name: UNREADABLE_HEADING })).toBeVisible();

    // The separation is now total: the state does not mention the other state
    // at all, in either direction.
    await expect(page.locator('main')).not.toContainText('This pack was not finished');
    await expect(page.locator('main')).not.toContainText('holds nothing to rehearse');
    await expect(page.locator('.card')).not.toContainText('finish');
  });

  test('no rehearsal starts here either: the same forbidden list applies', async ({ page }) => {
    await page.goto(UNREADABLE);
    await expect(page.getByRole('heading', { name: UNREADABLE_HEADING })).toBeVisible();
    await expectNoRehearsalSurface(page);
  });

  test('writes nothing to the device', async ({ page }) => {
    await page.goto(UNREADABLE);
    await expect(page.getByText(UNREADABLE_DETAIL)).toBeVisible();
    const before = await deviceStorage(page);

    await page.reload();
    await expect(page.getByText(UNREADABLE_DETAIL)).toBeVisible();

    expect(await deviceStorage(page)).toEqual(before);
  });
});

// The gate reads the device and nothing else. Both states must render with the
// radios off, so both are asserted to make no request off this origin.
test.describe('AC4 the gate makes no request', () => {
  for (const [name, url] of [['nothing to rehearse', EMPTY], ['could not be read', UNREADABLE]] as const) {
    test(`${name} renders with zero off-origin requests`, async ({ page }) => {
      const offOrigin: string[] = [];
      page.on('request', (request) => {
        if (!request.url().startsWith(ORIGIN)) offOrigin.push(`${request.method()} ${request.url()}`);
      });

      await page.goto(url);
      await expect(page.locator('.card h2')).toBeVisible();

      expect(offOrigin).toEqual([]);
    });
  }
});

// The user arrived from the pack page one tap ago, so the way back to that pack
// is offered first; building is what would make a rehearsal possible and takes
// the accent; Home is the escape and stays last, as on every other screen.
test.describe('AC4 the way on from a stopped state', () => {
  for (const [name, url] of [['nothing to rehearse', EMPTY], ['could not be read', UNREADABLE]] as const) {
    test(`${name} offers the pack, the build and Home, in that order`, async ({ page }) => {
      await page.goto(url);
      await expect(page.locator('.card h2')).toBeVisible();

      await expect(page.locator('.actions a')).toHaveText([
        'Back to this pack',
        'Build an offline pack',
        'Back to Home',
      ]);
      await expect(page.getByRole('link', { name: 'Back to this pack' })).toHaveAttribute(
        'href',
        '/packs/rehearse-pack',
      );
    });
  }
});
