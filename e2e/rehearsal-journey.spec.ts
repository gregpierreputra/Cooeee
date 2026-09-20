import { expect, test, type Locator, type Page } from '@playwright/test';
import { HOLD_MS } from '../src/core/constants';
import { storedRehearsals } from './helpers';

// E5-US1-AC5 — the journey screen: one screen, two states.
//
// Before she goes: the official places by name, what a rehearsal is, and one
// control. Nothing is kept. After she goes: the bar, what to do, the real hold
// into the real BlackSky, and the two endings. The rehearsal brackets the
// journey; it does not contain it.
//
// This spec replaces rehearsal-walk.spec.ts. Every assertion from that file
// that still applies to a rehearsal is carried here onto the new screen: the bar
// on a running rehearsal, nothing written beyond the record, nothing sent,
// greyscale, target size, contrast, reading order, and the hold by pointer and
// by keyboard.

const ORIGIN = 'http://127.0.0.1:4174';
const REHEARSABLE = `${ORIGIN}/rehearse?mode=rehearsable`;
/** A pack with a designation and no official place saved with it. */
const WITH_GAP = `${ORIGIN}/rehearse?mode=gap`;
/** `keep=1` seeds once, so a reload finds what the last load kept. */
const KEEP_REHEARSABLE = `${REHEARSABLE}&keep=1`;

const NO_DATA = 'No mobile data';
const NO_FIX = 'No location fix';
const CONDITIONS = [NO_DATA, NO_FIX] as const;
const WITHOUT: Record<string, string> = { [NO_DATA]: 'mobile data', [NO_FIX]: 'a location fix' };
const CONDITION_VALUE: Record<string, string> = { [NO_DATA]: 'no-data', [NO_FIX]: 'no-location-fix' };

const CHOOSE_HEADING = 'What are we rehearsing without?';
const BEFORE_HEADING = 'Rehearse the way there';
const RUNNING_HEADING = 'Practising the way';
const GO = "I'm going now";
const ARRIVED = 'I have arrived';
const WITHOUT_GOING = 'End without going';
const ENDING_HEADING = 'How did this rehearsal end?';
const RESULT_HEADING = 'What this rehearsal found';
const NO_GAPS_HEADING = 'Nothing was missing in this rehearsal';
const HOLD_HINT = 'Hold to enter. Two seconds.';

const CONDITION_LINE = (condition: string) => `This rehearsal is without ${WITHOUT[condition]}.`;
const WHAT_IT_IS =
  'A rehearsal is a trip to one of the official places saved with this pack, in calm conditions, with BlackSky open. Go the way you would on the day.';
const WHAT_IT_IS_FOR =
  'It is practice at knowing the way: how long it takes, and which turns you take.';
const INSTRUCTIONS_FIRST = 'Follow Country Fire Authority and emergency service instructions first.';
const RUNNING_DETAIL =
  'Go to one of these places in calm conditions, with BlackSky open. When you stop, come back here and say how it ended.';
const PLACES_HEADING = 'The official places saved with this pack';
const NO_PLACE_SAVED = 'This information is missing from your pack.';
const PLACE = 'Kalorama Reserve';
const PLACE_WHERE = 'Kalorama Memorial Reserve Road, Kalorama';
const PLACE_SAVED = 'Saved 3 March 2026';

/** Comfortably past the real control's two seconds. */
const FULL_HOLD = HOLD_MS + 500;

const bar = (page: Page) => page.locator('.rehearsal-bar');
const main = (page: Page) => page.getByRole('main');
const heading = (page: Page, name: string) => main(page).getByRole('heading', { level: 2, name, exact: true });
const goControl = (page: Page) => main(page).getByRole('button', { name: GO, exact: true });
const holdControl = (page: Page) => main(page).getByRole('button', { name: /Hold for BlackSky/ });
const endingControl = (page: Page, label: string) => main(page).getByRole('button', { name: label, exact: true });
const leaveControl = (page: Page) => main(page).getByRole('button', { name: 'Leave the rehearsal' });
const places = (page: Page) => main(page).getByRole('listitem');
/** Harness furniture: where the in-memory router is. */
const location = (page: Page) => page.getByTestId('location');

/** Open the choice and choose a condition. Nothing is kept yet. */
async function choose(page: Page, condition: string, url = REHEARSABLE) {
  await page.goto(url);
  await expect(page.getByRole('heading', { name: CHOOSE_HEADING })).toBeVisible();
  await page.getByRole('button', { name: new RegExp(condition) }).click();
  await expect(heading(page, BEFORE_HEADING)).toBeVisible();
}

/** "I'm going now": the rehearsal is running. */
async function go(page: Page) {
  await goControl(page).click();
  await expect(heading(page, RUNNING_HEADING)).toBeVisible();
  await expect(bar(page)).toBeVisible();
}

/** Press and hold the BlackSky control with a pointer for `ms`, then let go. */
async function pointerHold(page: Page, ms: number) {
  const hold = holdControl(page);
  await hold.scrollIntoViewIfNeeded();
  const box = (await hold.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

/** Every record in every IndexedDB store, and both web storages, serialised with
 *  binary values spelled out byte by byte. Two equal strings are two devices
 *  holding the same bytes, which a per-table count cannot say. */
async function deviceBytes(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const encode = (value: unknown): unknown => {
      if (value instanceof ArrayBuffer) return { bytes: Array.from(new Uint8Array(value)) };
      if (ArrayBuffer.isView(value)) {
        return { bytes: Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)) };
      }
      if (Array.isArray(value)) return value.map(encode);
      if (value && typeof value === 'object') {
        return Object.fromEntries(
          Object.entries(value)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([key, inner]) => [key, encode(inner)]),
        );
      }
      return value;
    };
    const request = <T>(req: IDBRequest<T>) =>
      new Promise<T>((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    const databases: Record<string, Record<string, unknown>> = {};
    const names = (await indexedDB.databases()).map(({ name }) => name).filter(Boolean) as string[];
    for (const name of names.sort()) {
      const db = await request(indexedDB.open(name));
      const stores: Record<string, unknown> = {};
      for (const store of Array.from(db.objectStoreNames).sort()) {
        stores[store] = encode(await request(db.transaction(store).objectStore(store).getAll()));
      }
      db.close();
      databases[name] = stores;
    }
    const web = (storage: Storage) =>
      Object.fromEntries(
        Array.from({ length: storage.length }, (_, i) => storage.key(i)!)
          .sort()
          .map((key) => [key, storage.getItem(key)]),
      );
    return JSON.stringify({
      indexedDB: databases,
      localStorage: web(localStorage),
      sessionStorage: web(sessionStorage),
    });
  });
}

type Device = {
  indexedDB: Record<string, Record<string, Record<string, unknown>[]>>;
  localStorage: unknown;
  sessionStorage: unknown;
};

const rehearsalRows = (device: Device) =>
  Object.values(device.indexedDB).flatMap((stores) => stores.rehearsals ?? []);

const withoutRehearsals = (device: Device) => ({
  ...device,
  indexedDB: Object.fromEntries(
    Object.entries(device.indexedDB).map(([name, stores]) => [
      name,
      Object.fromEntries(Object.entries(stores).filter(([store]) => store !== 'rehearsals')),
    ]),
  ),
});

/** The only difference between two devices is one added rehearsal row, and it is
 *  a started one: no finish, no gaps, no ending, no time. */
function expectOnlyAStartedRehearsalAdded(before: Device, after: Device, condition: string) {
  expect(withoutRehearsals(after)).toEqual(withoutRehearsals(before));
  expect(rehearsalRows(before)).toEqual([]);
  const added = rehearsalRows(after);
  expect(added).toHaveLength(1);
  expect(Object.keys(added[0]).sort()).toEqual(['condition', 'id', 'packId', 'startedAt']);
  expect(added[0].condition).toBe(CONDITION_VALUE[condition]);
}

/** Records every request that leaves the harness origin. */
function watchOffOrigin(page: Page): string[] {
  const offOrigin: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(ORIGIN)) offOrigin.push(`${request.method()} ${request.url()}`);
  });
  return offOrigin;
}

const keptRows = async (page: Page) => rehearsalRows(JSON.parse(await deviceBytes(page))).length;

test.describe('AC5 before she goes', () => {
  test('names the official places, says what a rehearsal is, and offers one control', async ({ page }) => {
    await choose(page, NO_DATA);

    await expect(main(page).getByText(CONDITION_LINE(NO_DATA), { exact: true })).toBeVisible();
    for (const line of [WHAT_IT_IS, WHAT_IT_IS_FOR, INSTRUCTIONS_FIRST]) {
      await expect(main(page).getByText(line, { exact: true })).toBeVisible();
    }
    await expect(main(page).getByRole('heading', { level: 3, name: PLACES_HEADING })).toBeVisible();
    await expect(places(page)).toHaveCount(1);
    await expect(places(page).first()).toContainText(PLACE);
    await expect(places(page).first()).toContainText(PLACE_WHERE);
    await expect(places(page).first()).toContainText(PLACE_SAVED);
    await expect(places(page).first()).not.toContainText('Published by');

    // One control, and it is the commitment.
    await expect(main(page).getByRole('button')).toHaveCount(1);
    await expect(goControl(page)).toBeVisible();
    await expect(main(page).getByRole('link')).toHaveCount(0);
    // Nothing of a running rehearsal is here yet: no bar, no hold, no ending.
    await expect(bar(page)).toHaveCount(0);
    await expect(holdControl(page)).toHaveCount(0);
    await expect(endingControl(page, ARRIVED)).toHaveCount(0);
    await expect(endingControl(page, WITHOUT_GOING)).toHaveCount(0);
  });

  test('a pack with no official place saved says so, and still offers the one control', async ({ page }) => {
    await choose(page, NO_FIX, WITH_GAP);

    await expect(main(page).getByRole('heading', { level: 3, name: PLACES_HEADING })).toBeVisible();
    await expect(main(page).getByText(NO_PLACE_SAVED, { exact: true })).toBeVisible();
    await expect(places(page)).toHaveCount(0);
    await expect(goControl(page)).toBeVisible();
  });

  // A curious tap is not a rehearsal.
  for (const condition of CONDITIONS) {
    test(`choosing "${condition}" writes nothing at all, through leaving the screen and a cold start`, async ({
      page,
    }) => {
      const offOrigin = watchOffOrigin(page);
      await page.goto(KEEP_REHEARSABLE);
      await expect(page.getByRole('heading', { name: CHOOSE_HEADING })).toBeVisible();
      const before = await deviceBytes(page);

      await page.getByRole('button', { name: new RegExp(condition) }).click();
      await expect(heading(page, BEFORE_HEADING)).toBeVisible();
      // Give any late write the chance to land before it is ruled out.
      await page.waitForTimeout(500);
      expect(await deviceBytes(page)).toBe(before);

      // Leaving the screen and coming back: a choice is setup, so it is not held.
      await page.getByTestId('remount').click();
      await page.getByTestId('remount').click();
      await expect(page.getByRole('heading', { name: CHOOSE_HEADING })).toBeVisible();
      expect(await deviceBytes(page)).toBe(before);

      // A cold start after choosing finds nothing, and asks nothing.
      await page.getByRole('button', { name: new RegExp(condition) }).click();
      await expect(heading(page, BEFORE_HEADING)).toBeVisible();
      await page.reload();
      await expect(page.getByRole('heading', { name: CHOOSE_HEADING })).toBeVisible();
      await expect(page.getByRole('heading', { name: ENDING_HEADING })).toHaveCount(0);
      expect(await deviceBytes(page)).toBe(before);

      expect(offOrigin).toEqual([]);
    });
  }
});

test.describe('AC5 going is the commitment', () => {
  for (const condition of CONDITIONS) {
    test(`"${GO}" under "${condition}" keeps one started rehearsal, timed from that moment`, async ({ page }) => {
      await page.goto(KEEP_REHEARSABLE);
      await expect(page.getByRole('heading', { name: CHOOSE_HEADING })).toBeVisible();
      const before = await deviceBytes(page);

      await page.getByRole('button', { name: new RegExp(condition) }).click();
      await expect(heading(page, BEFORE_HEADING)).toBeVisible();
      const chosenAt = await page.evaluate(() => Date.now());
      await page.waitForTimeout(400);
      const tappedAt = await page.evaluate(() => Date.now());
      await go(page);

      await expect.poll(async () => keptRows(page)).toBe(1);
      const started = JSON.parse(await deviceBytes(page)) as Device;
      expectOnlyAStartedRehearsalAdded(JSON.parse(before), started, condition);
      // The start is the moment she went, not the moment she chose.
      const startedAt = rehearsalRows(started)[0].startedAt as number;
      expect(startedAt).toBeGreaterThanOrEqual(tappedAt);
      expect(startedAt).toBeGreaterThan(chosenAt + 300);
    });

    test(`the bar marks the running rehearsal under "${condition}", naming it and never the other`, async ({
      page,
    }) => {
      const other = condition === NO_DATA ? NO_FIX : NO_DATA;
      await choose(page, condition);
      await expect(bar(page)).toHaveCount(0);
      await go(page);

      await expect(bar(page)).toHaveCount(1);
      await expect(bar(page)).toContainText('Rehearsal');
      await expect(page.locator('.rehearsal-bar-condition')).toHaveText(condition);
      await expect(bar(page)).not.toContainText(other);

      // What to do, the places, the real hold, and the two endings beside it.
      await expect(main(page).getByText(RUNNING_DETAIL, { exact: true })).toBeVisible();
      await expect(places(page).first()).toContainText(PLACE);
      await expect(holdControl(page)).toBeVisible();
      await expect(endingControl(page, ARRIVED)).toBeVisible();
      await expect(endingControl(page, WITHOUT_GOING)).toBeVisible();
      // The control that started it has gone with the state it belonged to.
      await expect(goControl(page)).toHaveCount(0);
      await expect(heading(page, BEFORE_HEADING)).toHaveCount(0);
    });
  }
});

test.describe('AC5 while she is out', () => {
  for (const condition of CONDITIONS) {
    test(`nothing is written while it runs under "${condition}", through the hold hint, leaving, and a cold start`, async ({
      page,
    }) => {
      const offOrigin = watchOffOrigin(page);
      await choose(page, condition, KEEP_REHEARSABLE);
      await go(page);
      await expect.poll(async () => keptRows(page)).toBe(1);
      const started = await deviceBytes(page);

      // A tap on the hold writes nothing.
      await holdControl(page).click();
      await expect(page.getByText(HOLD_HINT)).toBeVisible();
      expect(await deviceBytes(page)).toBe(started);

      // Leaving the screen and coming back in the same session: still running.
      await page.getByTestId('remount').click();
      await expect(bar(page)).toHaveCount(0);
      await page.getByTestId('remount').click();
      await expect(heading(page, RUNNING_HEADING)).toBeVisible();
      await expect(page.locator('.rehearsal-bar-condition')).toHaveText(condition);
      await page.waitForTimeout(500);
      expect(await deviceBytes(page)).toBe(started);

      // A cold start: no bar, no resumed screen, and the question.
      await page.reload();
      await expect(page.getByRole('heading', { name: ENDING_HEADING })).toBeVisible();
      await expect(bar(page)).toHaveCount(0);
      await expect(heading(page, RUNNING_HEADING)).toHaveCount(0);
      expect(await deviceBytes(page)).toBe(started);

      expect(offOrigin).toEqual([]);
    });
  }
});

// The hold behaves exactly like the real control [E3-US3-AC1, HOLD_TO_ENTER],
// because it is the real control, into the real BlackSky.
test.describe('AC5 the real two-second hold into BlackSky', () => {
  test('a tap earns only the hint, and goes nowhere', async ({ page }) => {
    await choose(page, NO_DATA);
    await go(page);
    await expect(location(page)).toHaveText('/rehearse/rehearse-pack');
    await expect(page.getByText(HOLD_HINT)).toHaveCount(0);

    await holdControl(page).click();
    await expect(page.getByText(HOLD_HINT)).toBeVisible();
    await page.waitForTimeout(FULL_HOLD);
    await expect(location(page)).toHaveText('/rehearse/rehearse-pack');
  });

  test('a press released before two seconds goes nowhere', async ({ page }) => {
    await choose(page, NO_DATA);
    await go(page);

    await pointerHold(page, HOLD_MS - 700);
    await page.waitForTimeout(FULL_HOLD);
    await expect(location(page)).toHaveText('/rehearse/rehearse-pack');
    await expect(page.getByText(HOLD_HINT)).toBeVisible();
  });

  test('a full hold opens BlackSky, and the rehearsal is still running on her return', async ({ page }) => {
    await choose(page, NO_FIX);
    await go(page);

    await pointerHold(page, FULL_HOLD);
    await expect(location(page)).toHaveText('/blacksky');

    // Going into BlackSky does not end the rehearsal: returning finds it running.
    await page.getByTestId('remount').click();
    await page.getByTestId('remount').click();
    await expect(heading(page, RUNNING_HEADING)).toBeVisible();
    await expect(page.locator('.rehearsal-bar-condition')).toHaveText(NO_FIX);
    await expect(endingControl(page, ARRIVED)).toBeVisible();
  });

  // E5-US3-AC3. Leaving BlackSky goes back to the rehearsal she came from, not
  // to Home. The harness mounts the real BlackSky with a run already started.
  test('leaving BlackSky returns to the running rehearsal', async ({ page }) => {
    await page.goto(`${ORIGIN}/blacksky?run=1`);
    const leave = page.getByRole('button', { name: 'Hold to leave' });
    await leave.scrollIntoViewIfNeeded();
    const box = (await leave.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(FULL_HOLD);
    await page.mouse.up();
    await expect(location(page)).toHaveText('/rehearse/saved-pack');
  });

  for (const key of ['Enter', ' '] as const) {
    test(`is operable from the keyboard with ${key === ' ' ? 'Space' : key}`, async ({ page }) => {
      await choose(page, NO_DATA);
      await go(page);

      await holdControl(page).focus();
      await expect(holdControl(page)).toBeFocused();
      await page.keyboard.down(key);
      await page.waitForTimeout(FULL_HOLD);
      await page.keyboard.up(key);

      await expect(location(page)).toHaveText('/blacksky');
    });
  }
});

test.describe('AC5 the two endings', () => {
  for (const [label, ending] of [
    [ARRIVED, 'walked'],
    [WITHOUT_GOING, 'dry-run'],
  ] as const) {
    test(`"${label}" records that ending and when it was given, ${
      ending === 'walked' ? 'and the time between' : 'and no time'
    }, and reaches the result`, async ({ page }) => {
      const offOrigin = watchOffOrigin(page);
      await page.goto(KEEP_REHEARSABLE);
      await expect(page.getByRole('heading', { name: CHOOSE_HEADING })).toBeVisible();
      const before = JSON.parse(await deviceBytes(page)) as Device;

      await page.getByRole('button', { name: new RegExp(NO_FIX) }).click();
      await go(page);
      await expect.poll(async () => keptRows(page)).toBe(1);
      const [started] = await storedRehearsals(page);
      await page.waitForTimeout(1100);
      const tappedAt = await page.evaluate(() => Date.now());

      await endingControl(page, label).click();

      await expect(page.getByRole('heading', { name: RESULT_HEADING })).toBeVisible();
      await expect(page.locator('.gap-row h3')).toHaveText(['Live direction and distance to your saved places']);
      await expect(bar(page)).toBeVisible();

      await expect.poll(async () => (await storedRehearsals(page))[0]?.ending).toBe(ending);
      const rows = await storedRehearsals(page);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        id: started.id,
        packId: 'rehearse-pack',
        condition: 'no-location-fix',
        startedAt: started.startedAt,
        ending,
      });
      const finishedAt = rows[0].finishedAt as number;
      expect(finishedAt).toBeGreaterThanOrEqual(tappedAt);
      if (ending === 'walked') {
        expect(rows[0].elapsedMs).toBe(finishedAt - (started.startedAt as number));
        expect(rows[0].elapsedMs as number).toBeGreaterThanOrEqual(1000);
      } else {
        expect(rows[0]).not.toHaveProperty('elapsedMs');
      }

      // Nothing else on the device changed, and a reload does not ask again.
      expect(withoutRehearsals(JSON.parse(await deviceBytes(page)))).toEqual(withoutRehearsals(before));
      await page.reload();
      await expect(page.getByRole('heading', { name: CHOOSE_HEADING })).toBeVisible();
      await expect(page.getByRole('heading', { name: ENDING_HEADING })).toHaveCount(0);
      expect(withoutRehearsals(JSON.parse(await deviceBytes(page)))).toEqual(withoutRehearsals(before));

      expect(offOrigin).toEqual([]);
    });
  }

  // A gap is a fact about the pack, never about her legs.
  for (const [name, url, condition] of [
    ['a complete pack under no mobile data', REHEARSABLE, NO_DATA],
    ['a pack with no place saved, under no location fix', WITH_GAP, NO_FIX],
  ] as const) {
    test(`both endings find the same result for ${name}`, async ({ page }) => {
      const found = async (label: string) => {
        await choose(page, condition, url);
        await go(page);
        await endingControl(page, label).click();
        const resultHeading = main(page).getByRole('heading', {
          level: 2,
          name: new RegExp(`^(${RESULT_HEADING}|${NO_GAPS_HEADING})$`),
        });
        await expect(resultHeading).toBeVisible();
        return {
          heading: await resultHeading.innerText(),
          gaps: await page.locator('.gap-row h3').allInnerTexts(),
          meanings: await page.locator('.gap-row > p.muted').allInnerTexts(),
        };
      };

      const walked = await found(ARRIVED);
      const dryRun = await found(WITHOUT_GOING);
      expect(dryRun).toEqual(walked);
      if (url === REHEARSABLE) {
        expect(walked.heading).toBe(NO_GAPS_HEADING);
      } else {
        expect(walked.gaps.length).toBeGreaterThan(0);
      }
    });
  }

  test('the endings cannot be reached before she goes', async ({ page }) => {
    await choose(page, NO_FIX);

    await expect(endingControl(page, ARRIVED)).toHaveCount(0);
    await expect(endingControl(page, WITHOUT_GOING)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: RESULT_HEADING })).toHaveCount(0);
    await expect(main(page).getByRole('button')).toHaveCount(1);
  });

  test('each ending is operable from the keyboard', async ({ page }) => {
    for (const label of [ARRIVED, WITHOUT_GOING]) {
      await choose(page, NO_FIX);
      await go(page);
      await endingControl(page, label).focus();
      await expect(endingControl(page, label)).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('heading', { name: RESULT_HEADING })).toBeVisible();
    }
  });

  test('leaving a running rehearsal asks its ending before another can start, then starts afresh', async ({
    page,
  }) => {
    await choose(page, NO_FIX);
    await go(page);
    await leaveControl(page).click();
    await expect(bar(page)).toHaveCount(0);

    await page.getByTestId('remount').click();
    await page.getByTestId('remount').click();
    await expect(page.getByRole('heading', { name: ENDING_HEADING })).toBeVisible();
    await page.getByRole('button', { name: /^I did not go, a dry run/ }).click();
    await expect(page.getByRole('heading', { name: RESULT_HEADING })).toBeVisible();
    await leaveControl(page).click();

    // A fresh choice is setup again: the screen before she goes, not a running one.
    await page.getByRole('button', { name: new RegExp(NO_FIX) }).click();
    await expect(heading(page, BEFORE_HEADING)).toBeVisible();
    await expect(bar(page)).toHaveCount(0);
    await expect(goControl(page)).toBeVisible();
  });
});

// Her time is hers. Since step 4 the result states it once, in whole minutes,
// beside the condition line; nothing judges it, and the progress view carries
// none of it.
test('AC5 her time is stated once, in whole minutes, never judged, and never on the progress view', async ({
  page,
}) => {
  await page.clock.install();
  await choose(page, NO_FIX, `${ORIGIN}/rehearse?mode=gap&earlier=changed`);
  await go(page);
  await page.clock.fastForward('14:20');
  await endingControl(page, ARRIVED).click();

  await expect(page.getByRole('heading', { name: RESULT_HEADING })).toBeVisible();
  const progress = page.locator('.progress');
  await expect(progress).toBeVisible();
  await expect
    .poll(async () => (await storedRehearsals(page)).find((row) => row.ending === 'walked')?.elapsedMs)
    .toBeGreaterThanOrEqual(14 * 60_000 + 20_000);
  const elapsed = String((await storedRehearsals(page)).find((row) => row.ending === 'walked')!.elapsedMs);

  const text = (await main(page).innerText()).toLowerCase();
  // The recorded figure itself is never shown: only its whole minutes, once.
  expect(text).not.toContain(elapsed);
  const line = 'you went there. it took you 14 minutes.';
  expect(text.split(line).length - 1).toBe(1);
  // Nowhere else on the result is a duration, and nothing anywhere rates one.
  // The bare word "time" is not in this list: the progress view's existing
  // heading "Not found last time" uses it for an occasion, not a duration.
  const rest = text.replace(line, '');
  expect(rest).not.toMatch(/\b\d+\s*(ms|s|secs?|seconds?|mins?|minutes?|h|hrs?|hours?)\b/);
  expect(rest).not.toMatch(/\b(your time|time taken|took|minutes?|mins?|hours?)\b/);
  expect(text).not.toMatch(
    /\b(seconds?|secs?|elapsed|fast|faster|slow|slower|quick|quicker|target|pace|personal best|your best)\b/,
  );
  // The progress view carries no figure but its dates, and nothing of her time.
  const progressText = (await progress.innerText()).toLowerCase();
  expect(progressText.replace(/\d{1,2} [a-z]+ \d{4}/g, '')).not.toMatch(/\d/);
  expect(progressText).not.toMatch(/minute|walked|took/);
});

// How it is worded matters more here than anywhere else.
test.describe('AC5 the words of the journey screen', () => {
  const TRAVEL = /\b(route|routes|directions|turn-by-turn|eta|arrival|arrive by)\b/;
  const PLAN = /\b(destination|destinations|evacuat\w*|your plan|plan to go|where you will go|go there on the day|meeting point)\b/;
  const JUDGED = /\b(fast|faster|slow|slower|quick|target|pace|beat|score|grade|passed|failed|partial|incomplete|so far)\b/;

  for (const state of ['before she goes', 'while she is out'] as const) {
    test(`${state}: no travel word, nothing read as a plan for the day, nothing judged or counted`, async ({
      page,
    }) => {
      await choose(page, NO_DATA);
      if (state === 'while she is out') await go(page);

      const text = (await main(page).innerText()).toLowerCase();
      expect(text).not.toMatch(TRAVEL);
      expect(text).not.toMatch(PLAN);
      expect(text).not.toMatch(JUDGED);
      expect(text).not.toContain('%');

      // Every digit on the screen sits inside a place's own entry: its saved date.
      let rest = text;
      for (const line of await places(page).locator('p').allInnerTexts()) {
        rest = rest.split(line.trim().toLowerCase()).join('');
      }
      expect(rest).not.toMatch(/\d/);
      // So the rule bites: the saved date is on the screen.
      expect(text).toContain('3 march 2026');
    });
  }
});

// WCAG 1.4.1. With every colour removed only the words are left.
test('AC5 the journey reads in greyscale: both states and both endings told apart by words alone', async ({
  page,
}) => {
  await page.goto(REHEARSABLE);
  await page.addStyleTag({ content: 'html { filter: grayscale(1) !important; }' });
  await expect(page.getByRole('heading', { name: CHOOSE_HEADING })).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).filter)).toBe('grayscale(1)');
  await page.getByRole('button', { name: new RegExp(NO_FIX) }).click();

  // Before she goes: said by its heading and by its one control.
  await expect(heading(page, BEFORE_HEADING)).toBeVisible();
  await expect(goControl(page)).toHaveText(GO);
  await goControl(page).click();

  // While she is out: said by its heading and by the bar's words.
  await expect(heading(page, RUNNING_HEADING)).toBeVisible();
  await expect(bar(page)).toContainText('Rehearsal');
  await expect(page.locator('.rehearsal-bar-condition')).toHaveText(NO_FIX);

  // The two endings: different words, identical treatment, no icon.
  const arrived = endingControl(page, ARRIVED);
  const withoutGoing = endingControl(page, WITHOUT_GOING);
  await expect(arrived).toHaveText(ARRIVED);
  await expect(withoutGoing).toHaveText(WITHOUT_GOING);
  for (const control of [arrived, withoutGoing]) {
    await expect(control.locator('svg, img, [role="img"]')).toHaveCount(0);
  }
  // The pointer rests where the go control was, which is now an ending: park it
  // off the controls so a hover border is not read as a difference in treatment.
  await page.mouse.move(0, 0);
  await page.waitForTimeout(200);
  const treatment = (control: Locator) =>
    control.evaluate((el) => {
      const style = getComputedStyle(el);
      return [
        el.tagName,
        el.className,
        style.color,
        style.backgroundColor,
        style.borderColor,
        style.fontWeight,
        style.fontStyle,
        style.textDecorationLine,
      ].join('|');
    });
  expect(await treatment(withoutGoing)).toBe(await treatment(arrived));
});

// Accessibility, after e2e/rehearsal-entry-a11y.spec.ts. Desktop Chromium at a
// narrow viewport stands in for, and does not replace, the device passes the
// criterion still owes (VoiceOver, Dynamic Type, Android font scale).

async function openState(page: Page, state: 'before' | 'running') {
  await choose(page, NO_FIX);
  if (state === 'running') await go(page);
  await expect(places(page)).toHaveCount(1);
}

for (const state of ['before', 'running'] as const) {
  // WCAG 1.4.4
  test(`AC5 the journey ${state} she goes survives 200% text with no clipping or overlap`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await openState(page, state);

    const placeHeight = async () => Math.round((await places(page).first().boundingBox())!.height);
    const before = await placeHeight();
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await expect
      .poll(async () => page.evaluate(() => getComputedStyle(document.documentElement).fontSize))
      .toBe('32px');
    // The check has to bite: the place must actually have reflowed.
    expect(await placeHeight()).toBeGreaterThan(before);

    const report = await page.evaluate(() => {
      const doc = document.documentElement;
      const overflowing: string[] = [];
      const clipped: string[] = [];
      document.querySelectorAll<HTMLElement>('.rehearsal-bar *, main *').forEach((el) => {
        const box = el.getBoundingClientRect();
        if (box.right > doc.clientWidth + 1 || box.left < -1) overflowing.push(`${el.tagName}.${el.className}`);
        if (el.scrollHeight > el.clientHeight + 1 && getComputedStyle(el).overflowY === 'hidden') {
          clipped.push(`${el.tagName}.${el.className}`);
        }
      });
      // No two blocks of the screen may intrude on each other, in either axis:
      // the endings sit side by side, so a top-to-bottom check alone would miss
      // a collision between them.
      const blocks = [...document.querySelectorAll<HTMLElement>('main h2, main h3, main p, main button')].map(
        (el) => {
          const box = el.getBoundingClientRect();
          return { text: (el.textContent ?? '').slice(0, 30), box };
        },
      );
      const overlaps: string[] = [];
      for (let i = 0; i < blocks.length; i += 1) {
        for (let j = i + 1; j < blocks.length; j += 1) {
          const a = blocks[i].box;
          const b = blocks[j].box;
          if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) {
            overlaps.push(`${blocks[i].text} / ${blocks[j].text}`);
          }
        }
      }
      return { overflowing, clipped, overlaps, hScroll: document.body.scrollWidth > doc.clientWidth + 1 };
    });

    expect(report.overlaps).toEqual([]);
    expect(report.clipped).toEqual([]);
    expect(report.overflowing).toEqual([]);
    expect(report.hScroll).toBe(false);
    await expect(heading(page, state === 'before' ? BEFORE_HEADING : RUNNING_HEADING)).toBeVisible();
  });

  // WCAG 2.5.8
  test(`AC5 every control on the journey ${state} she goes meets the minimum target size`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await openState(page, state);

    const controls =
      state === 'before'
        ? [goControl(page)]
        : [holdControl(page), endingControl(page, ARRIVED), endingControl(page, WITHOUT_GOING), leaveControl(page)];
    for (const control of controls) {
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(24);
      expect(box!.height).toBeGreaterThanOrEqual(24);
    }
  });

  // WCAG 1.4.3. Measured with opacity folded in, since a translucent line reads
  // lighter than its computed colour says.
  test(`AC5 the journey ${state} she goes meets the contrast minimum on every element`, async ({ page }) => {
    await openState(page, state);

    const rows = await page.evaluate(() => {
      const luminance = (channels: number[]) => {
        const [r, g, b] = channels.map((value) => {
          const s = value / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const parse = (colour: string) => {
        const parts = colour.match(/\d+(\.\d+)?/g)!.map(Number);
        return { rgb: parts.slice(0, 3), alpha: parts.length > 3 ? parts[3] : 1 };
      };
      const painted = (el: HTMLElement): number[] => {
        let node: HTMLElement | null = el;
        while (node) {
          const background = getComputedStyle(node).backgroundColor;
          if (background && !background.includes('rgba(0, 0, 0, 0)')) return parse(background).rgb;
          node = node.parentElement;
        }
        return [255, 255, 255];
      };
      const opacity = (el: HTMLElement) => {
        let alpha = 1;
        for (let node: HTMLElement | null = el; node; node = node.parentElement) {
          alpha *= Number(getComputedStyle(node).opacity);
        }
        return alpha;
      };
      const selector =
        '.rehearsal-bar-marker, .rehearsal-bar-condition, main .kicker, main h2, main h3, main p, main button, main button span';
      return [...document.querySelectorAll<HTMLElement>(selector)].map((el) => {
        const style = getComputedStyle(el);
        const fg = parse(style.color);
        const bg = painted(el);
        const alpha = fg.alpha * opacity(el);
        const blended = fg.rgb.map((channel, i) => channel * alpha + bg[i] * (1 - alpha));
        const a = luminance(blended);
        const b = luminance(bg);
        const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        const px = Number.parseFloat(style.fontSize);
        const large = px >= 24 || (px >= 18.66 && Number(style.fontWeight) >= 700);
        return {
          text: (el.textContent ?? '').slice(0, 34),
          ratio: Math.round(ratio * 100) / 100,
          required: large ? 3 : 4.5,
        };
      });
    });

    // Before: kicker, heading, four lines, the places heading, the place's two
    // lines, and the one control. Running adds the bar's two parts, the hold, the
    // two endings, the line about sending and the way out.
    expect(rows.length).toBeGreaterThanOrEqual(state === 'before' ? 10 : 12);
    const failing = rows.filter((row) => row.ratio < row.required);
    expect(failing, JSON.stringify(failing)).toEqual([]);
  });

  // WCAG 1.3.1. What a screen reader announces is the DOM order, so that is what
  // is asserted; the VoiceOver pass stands.
  test(`AC5 the journey ${state} she goes reads in order`, async ({ page }) => {
    await openState(page, state);

    const position = (locator: Locator) =>
      locator.evaluate((el) => Array.from(document.querySelectorAll('*')).indexOf(el));

    const order =
      state === 'before'
        ? [
            await position(main(page).getByText('Rehearsal', { exact: true })),
            await position(heading(page, BEFORE_HEADING)),
            await position(main(page).getByText(CONDITION_LINE(NO_FIX), { exact: true })),
            await position(main(page).getByText(WHAT_IT_IS, { exact: true })),
            await position(main(page).getByText(WHAT_IT_IS_FOR, { exact: true })),
            await position(main(page).getByText(INSTRUCTIONS_FIRST, { exact: true })),
            await position(main(page).getByRole('heading', { level: 3, name: PLACES_HEADING })),
            await position(places(page).first()),
            await position(goControl(page)),
          ]
        : [
            await position(bar(page)),
            await position(heading(page, RUNNING_HEADING)),
            await position(main(page).getByText(RUNNING_DETAIL, { exact: true })),
            await position(main(page).getByRole('heading', { level: 3, name: PLACES_HEADING })),
            await position(places(page).first()),
            await position(holdControl(page)),
            await position(endingControl(page, ARRIVED)),
            await position(endingControl(page, WITHOUT_GOING)),
            await position(leaveControl(page)),
          ];
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);

    // Navigating by heading meets the state's heading, then the places.
    const headings = await main(page)
      .getByRole('heading')
      .evaluateAll((els) => els.map((el) => `${el.tagName} ${el.textContent}`));
    expect(headings).toEqual(
      state === 'before'
        ? [`H2 ${BEFORE_HEADING}`, `H3 ${PLACES_HEADING}`]
        : [`H2 ${RUNNING_HEADING}`, `H3 ${PLACES_HEADING}`, 'H3 Notes'],
    );
  });
}

// E5-US6 — the condition is made on the phone, not pretended. Before going, one
// instruction about the phone; while out under no data, what the browser
// reports, stated and never acted on. A location fix is never asked about.
test.describe('US6 making the condition real on the phone', () => {
  test('before going, the screen says how to make the chosen condition on the phone', async ({ page }) => {
    await choose(page, NO_DATA);
    await expect(main(page).getByText(/aeroplane mode/)).toBeVisible();
    await expect(main(page).getByText(/location off/)).toHaveCount(0);
    await expect(main(page).getByRole('button')).toHaveCount(1);
  });

  test('while out without data, the screen says whether the phone is offline yet', async ({ page, context }) => {
    await choose(page, NO_DATA);
    await go(page);
    const line = main(page).locator('.journey-connection');
    await expect(line).toHaveText(/still has a connection/);
    await context.setOffline(true);
    await expect(line).toHaveText(/offline now, as on the day/);
    // Stated only: both endings stay offered whatever the phone reports.
    await expect(endingControl(page, ARRIVED)).toBeEnabled();
    await expect(endingControl(page, WITHOUT_GOING)).toBeEnabled();
  });

  test('a rehearsal without a location fix carries no such line', async ({ page }) => {
    await choose(page, NO_FIX);
    await go(page);
    await expect(main(page).locator('.journey-connection')).toHaveCount(0);
  });
});

// E5-US7 — her own notes on the journey, read as BlackSky shows them on the
// day. Read-only here: nothing on the run can change a note.
test.describe('US7 the pack notes on the journey', () => {
  test('a pack with notes shows each note while she is out, and none can be edited', async ({ page }) => {
    await choose(page, NO_DATA, `${REHEARSABLE}&notes=1`);
    await expect(main(page).getByText('Gas is off at the meter.')).toHaveCount(0);
    await go(page);
    await expect(main(page).getByRole('heading', { level: 3, name: 'Notes' })).toBeVisible();
    await expect(main(page).locator('.journey-note')).toHaveText(['Gas is off at the meter.']);
    await expect(main(page).getByRole('textbox')).toHaveCount(0);
    await expect(places(page)).toHaveCount(1);
  });

  test('a pack without notes says so', async ({ page }) => {
    await choose(page, NO_DATA);
    await go(page);
    await expect(main(page).getByText('No notes are saved with this pack.')).toBeVisible();
  });
});
