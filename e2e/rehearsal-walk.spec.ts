import { expect, test, type Locator, type Page } from '@playwright/test';
import { HOLD_MS } from '../src/core/constants';

// E5-US1-AC5 — the rehearsal walks the journey: the pack, then BlackSky, then
// the result. docs/requirements/epic-5-ac5.md, test cases TC-5.1.5-A to F.
//
// Every assertion about held and gap is an assertion about WORDS. Nothing here
// treats a colour, an icon or a tick as the thing that tells the two apart.

const ORIGIN = 'http://127.0.0.1:4174';
/** A complete pack: a designation present and an official place saved. */
const REHEARSABLE = `${ORIGIN}/rehearse?mode=rehearsable`;
/** A pack with a designation and no official place saved with it. */
const WITH_GAP = `${ORIGIN}/rehearse?mode=gap`;
/** `keep=1` seeds once, so a reload finds what the last load left. */
const KEEP_REHEARSABLE = `${REHEARSABLE}&keep=1`;
const KEEP_WITH_GAP = `${WITH_GAP}&keep=1`;

const NO_DATA = 'No mobile data';
const NO_FIX = 'No location fix';
const CONDITIONS = [NO_DATA, NO_FIX] as const;
const CHOOSE_HEADING = 'What are we rehearsing without?';
const ENDING_HEADING = 'How did this rehearsal end?';
const CONDITION_VALUE: Record<string, string> = {
  'No mobile data': 'no-data',
  'No location fix': 'no-location-fix',
};

type Device = {
  indexedDB: Record<string, Record<string, Record<string, unknown>[]>>;
  localStorage: unknown;
  sessionStorage: unknown;
};

const rehearsalRows = (device: Device) =>
  Object.values(device.indexedDB).flatMap((stores) => stores.rehearsals ?? []);

/** E5-US1-AC5: starting a rehearsal keeps exactly one thing. Asserts that the
 *  only difference between two devices is one added rehearsal row, and that the
 *  row is a started one: no finish, no gaps, no ending. */
function expectOnlyAStartedRehearsalAdded(before: Device, after: Device, condition: string) {
  const withoutRehearsals = (device: Device) => ({
    ...device,
    indexedDB: Object.fromEntries(
      Object.entries(device.indexedDB).map(([name, stores]) => [
        name,
        Object.fromEntries(Object.entries(stores).filter(([store]) => store !== 'rehearsals')),
      ]),
    ),
  });
  expect(withoutRehearsals(after)).toEqual(withoutRehearsals(before));
  expect(rehearsalRows(before)).toEqual([]);
  const added = rehearsalRows(after);
  expect(added).toHaveLength(1);
  expect(Object.keys(added[0]).sort()).toEqual(['condition', 'id', 'packId', 'startedAt']);
  expect(added[0].condition).toBe(CONDITION_VALUE[condition]);
}

const STEP_1 = 'Step 1 of 2';
const STEP_2 = 'Step 2 of 2';
const YOUR_PACK = 'Your pack';
const BLACKSKY = 'BlackSky';

const DESIGNATION = 'The official area designation for this address';
const PROVENANCE = 'The publisher and saved date on every stored item';
const PLACES = 'The official places saved with this pack';
const LIVE_DIRECTION = 'Live direction and distance to your saved places';

/** The harness pack's own values, as the rest of the app words them: the area
 *  check's sentence, the shared provenance line, and the destinations list's name. */
const DESIGNATION_VALUE = 'This address is inside a Designated Bushfire Prone Area.';
const DTP_PROVENANCE = 'Published by Department of Transport and Planning · Saved 3 March 2026';
const CFA_PROVENANCE = 'Published by Country Fire Authority · Saved 3 March 2026';
const PLACE_VALUE = 'Kalorama Reserve';

const HELD_PACK_CONTENT = 'This information is in your pack.';
/** Each condition as it reads after "without". The row titles already say "No". */
const NO_DATA_WITHOUT = 'mobile data';
const NO_FIX_WITHOUT = 'a location fix';
const HELD_CONDITION = (without: string) => `This still works without ${without}.`;
const GAP_PACK_CONTENT = 'This information is missing from your pack.';
const GAP_CONDITION_FACT = 'This is not available under this condition.';
const GAP_CONDITION_NEXT = 'Here is what to do instead.';
const GAP_CONDITION = `${GAP_CONDITION_FACT} ${GAP_CONDITION_NEXT}`;

const HOLD_HINT = 'Hold to enter. Two seconds.';
const SEE_WHAT_IT_FOUND = 'See what it found';
const RESULT_HEADING = 'What this rehearsal found';
const NO_GAPS_HEADING = 'Nothing was missing in this rehearsal';

/** Comfortably past the real control's two seconds. */
const FULL_HOLD = HOLD_MS + 500;

const bar = (page: Page) => page.locator('.rehearsal-bar');
const main = (page: Page) => page.getByRole('main');
const counter = (page: Page, text: string) => main(page).getByText(text, { exact: true });
const stepHeading = (page: Page, name: string) =>
  main(page).getByRole('heading', { level: 2, name, exact: true });
const holdControl = (page: Page) => main(page).getByRole('button', { name: /Hold for BlackSky/ });
const seeWhatItFound = (page: Page) => main(page).getByRole('button', { name: SEE_WHAT_IT_FOUND });
const stepLines = (page: Page) => main(page).getByRole('listitem');
/** One line on a step, or one row on the result, found by the heading it carries. */
const lineFor = (page: Page, title: string) =>
  main(page)
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { level: 3, name: title, exact: true }) });
/** The sentence saying whether a line held: always the line's last paragraph. */
const statementOf = (line: Locator) => line.locator('p').last();
/** What a held line shows from the pack: every paragraph above its sentence. */
const valuesOf = (line: Locator) => line.locator('p:not(:last-child)');

/** Start a run by choosing a condition, exactly as a user does. */
async function startRun(page: Page, condition: string, url = REHEARSABLE) {
  await page.goto(url);
  await expect(page.getByRole('heading', { name: CHOOSE_HEADING })).toBeVisible();
  await page.getByRole('button', { name: new RegExp(condition) }).click();
  await expect(bar(page)).toBeVisible();
  await expect(counter(page, STEP_1)).toBeVisible();
}

/** Press and hold the step 1 control with a pointer for `ms`, then let go. */
async function pointerHold(page: Page, ms: number) {
  const hold = holdControl(page);
  await hold.scrollIntoViewIfNeeded();
  const box = (await hold.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

/** From step 1 to step 2, through the full hold and no other way. */
async function holdToStep2(page: Page) {
  await pointerHold(page, FULL_HOLD);
  await expect(counter(page, STEP_2)).toBeVisible();
  await expect(stepHeading(page, BLACKSKY)).toBeVisible();
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

/** Records every request that leaves the harness origin. */
function watchOffOrigin(page: Page): string[] {
  const offOrigin: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(ORIGIN)) offOrigin.push(`${request.method()} ${request.url()}`);
  });
  return offOrigin;
}

// TC-5.1.5-A
test.describe('TC-5.1.5-A a complete pack under no mobile data', () => {
  test('walks both steps in order, every line held in words, to the no-gaps result', async ({ page }) => {
    await startRun(page, NO_DATA);

    // Step 1, and only step 1.
    await expect(stepHeading(page, YOUR_PACK)).toBeVisible();
    await expect(counter(page, STEP_2)).toHaveCount(0);
    await expect(stepHeading(page, BLACKSKY)).toHaveCount(0);
    await expect(stepLines(page)).toHaveCount(2);
    await expect(statementOf(lineFor(page, DESIGNATION))).toHaveText(HELD_PACK_CONTENT);
    await expect(statementOf(lineFor(page, PROVENANCE))).toHaveText(HELD_PACK_CONTENT);
    // The line order is the criterion's: designation, then provenance.
    await expect(stepLines(page).getByRole('heading', { level: 3 })).toHaveText([DESIGNATION, PROVENANCE]);

    await holdToStep2(page);
    await expect(stepHeading(page, YOUR_PACK)).toHaveCount(0);
    await expect(stepLines(page)).toHaveCount(2);
    await expect(stepLines(page).getByRole('heading', { level: 3 })).toHaveText([PLACES, LIVE_DIRECTION]);
    await expect(statementOf(lineFor(page, PLACES))).toHaveText(HELD_PACK_CONTENT);
    await expect(statementOf(lineFor(page, LIVE_DIRECTION))).toHaveText(HELD_CONDITION(NO_DATA_WITHOUT));
    // No gap sentence anywhere on a walk where everything held.
    await expect(main(page)).not.toContainText(GAP_PACK_CONTENT);
    await expect(main(page)).not.toContainText(GAP_CONDITION_FACT);

    await seeWhatItFound(page).click();
    await expect(page.getByRole('heading', { name: NO_GAPS_HEADING })).toBeVisible();
    await expect(counter(page, STEP_2)).toHaveCount(0);
    await expect(bar(page)).toBeVisible();
  });
});

// TC-5.1.5-B
test.describe('TC-5.1.5-B the official places are missing from the pack', () => {
  test('step 2 states the places gap in the sentence the result uses', async ({ page }) => {
    await startRun(page, NO_DATA, WITH_GAP);
    await holdToStep2(page);

    const places = lineFor(page, PLACES);
    await expect(statementOf(places)).toHaveText(GAP_PACK_CONTENT);
    // The other line on the step is unaffected by the missing places.
    await expect(statementOf(lineFor(page, LIVE_DIRECTION))).toHaveText(HELD_CONDITION(NO_DATA_WITHOUT));

    await seeWhatItFound(page).click();
    await expect(page.getByRole('heading', { name: RESULT_HEADING })).toBeVisible();
    const row = lineFor(page, PLACES).filter({ hasText: GAP_PACK_CONTENT });
    await expect(row).toHaveCount(1);
  });
});

// TC-5.1.5-C
test.describe('TC-5.1.5-C no location fix', () => {
  test('the step states the fact alone, and the result keeps both halves', async ({ page }) => {
    await startRun(page, NO_FIX);
    await holdToStep2(page);

    const live = statementOf(lineFor(page, LIVE_DIRECTION));
    await expect(live).toHaveText(GAP_CONDITION_FACT);
    // The second half promises an action, and there is no action on a step.
    await expect(live).not.toContainText(GAP_CONDITION_NEXT);
    await expect(main(page)).not.toContainText(GAP_CONDITION_NEXT);
    // What the pack holds does not need a fix, so it still holds.
    await expect(statementOf(lineFor(page, PLACES))).toHaveText(HELD_PACK_CONTENT);

    await seeWhatItFound(page).click();
    await expect(page.getByRole('heading', { name: RESULT_HEADING })).toBeVisible();
    const row = lineFor(page, LIVE_DIRECTION);
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(GAP_CONDITION_FACT);
    await expect(row).toContainText(GAP_CONDITION_NEXT);
    await expect(row).toContainText(GAP_CONDITION);
    // And the contingency action it points to is there.
    await expect(row).toContainText('Write down how to reach each saved place from your front door');
  });
});

// TC-5.1.5-D. With every colour removed only the words are left, so the words
// alone have to say which state each line is in.
test.describe('TC-5.1.5-D greyscale', () => {
  const HELD = [HELD_PACK_CONTENT, HELD_CONDITION(NO_DATA_WITHOUT), HELD_CONDITION(NO_FIX_WITHOUT)];
  const GAP = [GAP_PACK_CONTENT, GAP_CONDITION_FACT];

  const cases = [
    // Step 2 carries one held line and one gap line under each of these.
    { condition: NO_FIX, url: REHEARSABLE, step2: { [PLACES]: 'held', [LIVE_DIRECTION]: 'gap' } },
    { condition: NO_DATA, url: WITH_GAP, step2: { [PLACES]: 'gap', [LIVE_DIRECTION]: 'held' } },
  ] as const;

  for (const { condition, url, step2 } of cases) {
    test(`held and gap are told apart by words alone under "${condition}"`, async ({ page }) => {
      await page.goto(url);
      await page.addStyleTag({ content: 'html { filter: grayscale(1) !important; }' });
      await expect(page.getByRole('heading', { name: CHOOSE_HEADING })).toBeVisible();
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).filter)).toBe(
        'grayscale(1)',
      );
      await page.getByRole('button', { name: new RegExp(condition) }).click();
      await expect(counter(page, STEP_1)).toBeVisible();

      // The two vocabularies never share a sentence, so a sentence names its state.
      expect(HELD.filter((sentence) => GAP.includes(sentence))).toEqual([]);

      const readState = async (title: string) => {
        const text = (await statementOf(lineFor(page, title)).innerText()).trim();
        if (HELD.includes(text)) return 'held';
        if (GAP.includes(text)) return 'gap';
        return `unreadable: ${text}`;
      };

      expect(await readState(DESIGNATION)).toBe('held');
      expect(await readState(PROVENANCE)).toBe('held');

      // A value now sits above the sentence on a line that holds. No value may
      // read as a held or gap sentence, so the sentence alone still says which.
      const valuesNeverReadAsState = async (title: string) => {
        for (const value of await valuesOf(lineFor(page, title)).allInnerTexts()) {
          expect(HELD, `${title}: ${value}`).not.toContain(value.trim());
          expect(GAP, `${title}: ${value}`).not.toContain(value.trim());
        }
      };
      await valuesNeverReadAsState(DESIGNATION);
      await valuesNeverReadAsState(PROVENANCE);

      await holdToStep2(page);
      for (const [title, state] of Object.entries(step2)) {
        expect(await readState(title), title).toBe(state);
      }

      // A held line shows a value unless it is live direction and distance; a gap
      // line shows none. Neither kind of value reads as a state sentence.
      for (const [title, state] of Object.entries(step2)) {
        await valuesNeverReadAsState(title);
        const values = await valuesOf(lineFor(page, title)).count();
        if (state === 'gap' || title === LIVE_DIRECTION) expect(values, title).toBe(0);
        else expect(values, title).toBeGreaterThan(0);
      }

      // Nothing but the words tells the held line from the gap line: no icon, and
      // the card, its title and its sentence carry the same computed treatment.
      // The value above a held sentence is what the pack holds, not a state, so
      // it is compared by what it says above rather than by how it is drawn.
      const heldTitle = Object.entries(step2).find(([, state]) => state === 'held')![0];
      const gapTitle = Object.entries(step2).find(([, state]) => state === 'gap')![0];
      for (const title of [heldTitle, gapTitle]) {
        await expect(lineFor(page, title).locator('svg, img, [role="img"]')).toHaveCount(0);
      }
      const treatment = (title: string) =>
        lineFor(page, title).evaluate((li) => {
          const describe = (el: Element) => {
            const style = getComputedStyle(el);
            return [el.tagName, style.color, style.backgroundColor, style.borderColor, style.fontWeight, style.fontStyle, style.textDecorationLine].join('|');
          };
          return [li, li.querySelector('h3')!, li.querySelector('p:last-child')!].map(describe);
        });
      expect(await treatment(gapTitle)).toEqual(await treatment(heldTitle));
    });
  }
});

// Amended 14 September 2026: the step shows the thing, not a claim about the
// thing. A line that holds shows its value from the pack above its sentence,
// worded exactly as the rest of the app words it. A gap shows its sentence alone.
test.describe('AC5 a held line shows its value from the pack', () => {
  test('under a complete pack, each held line shows its value above its sentence', async ({ page }) => {
    await startRun(page, NO_DATA);

    // The line's paragraphs in order: the value, then the sentence.
    await expect(lineFor(page, DESIGNATION).locator('p')).toHaveText([DESIGNATION_VALUE, HELD_PACK_CONTENT]);
    await expect(lineFor(page, PROVENANCE).locator('p')).toHaveText([
      DTP_PROVENANCE,
      CFA_PROVENANCE,
      HELD_PACK_CONTENT,
    ]);

    await holdToStep2(page);
    await expect(lineFor(page, PLACES).locator('p')).toHaveText([PLACE_VALUE, HELD_PACK_CONTENT]);
    // Live direction and distance holds and shows no value: a real one would need
    // a position, and a rehearsal never asks for one.
    await expect(lineFor(page, LIVE_DIRECTION).locator('p')).toHaveText([HELD_CONDITION(NO_DATA_WITHOUT)]);
  });

  test('under ?mode=gap, the places line shows the gap sentence and no value', async ({ page }) => {
    await startRun(page, NO_DATA, WITH_GAP);

    // What the pack does hold is still shown.
    await expect(lineFor(page, DESIGNATION).locator('p')).toHaveText([DESIGNATION_VALUE, HELD_PACK_CONTENT]);
    await expect(lineFor(page, PROVENANCE).locator('p')).toHaveText([DTP_PROVENANCE, HELD_PACK_CONTENT]);

    await holdToStep2(page);
    const places = lineFor(page, PLACES);
    await expect(places.locator('p')).toHaveText([GAP_PACK_CONTENT]);
    await expect(valuesOf(places)).toHaveCount(0);
    await expect(places).not.toContainText(PLACE_VALUE);
    // No empty slot where a value would be: the title and the sentence, nothing else.
    expect(
      await places.evaluate((li) =>
        Array.from(li.children).map((child) => [child.tagName, (child.textContent ?? '').trim() !== '']),
      ),
    ).toEqual([
      ['H3', true],
      ['P', true],
    ]);
  });
});

// TC-5.1.5-E
test.describe('TC-5.1.5-E interrupted mid-walk', () => {
  test('leaving step 2 and returning in the same session resumes step 2', async ({ page }) => {
    await startRun(page, NO_FIX);
    await holdToStep2(page);

    await page.getByTestId('remount').click();
    await expect(bar(page)).toHaveCount(0);
    await page.getByTestId('remount').click();

    await expect(bar(page)).toBeVisible();
    await expect(page.locator('.rehearsal-bar-condition')).toHaveText(NO_FIX);
    await expect(counter(page, STEP_2)).toBeVisible();
    await expect(stepHeading(page, BLACKSKY)).toBeVisible();
    await expect(seeWhatItFound(page)).toBeVisible();
    // Resumed, not restarted, and not skipped ahead.
    await expect(counter(page, STEP_1)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: RESULT_HEADING })).toHaveCount(0);
  });

  // As amended by E5-US1-AC5: still no bar, no step and no partial result; the
  // started rehearsal is now kept, unfinished, and asked about.
  test('a cold start on step 2 leaves no bar, no step and no partial result, and asks how it ended', async ({
    page,
  }) => {
    await page.goto(KEEP_REHEARSABLE);
    await expect(page.getByRole('heading', { name: CHOOSE_HEADING })).toBeVisible();
    const before = await deviceBytes(page);

    await page.getByRole('button', { name: new RegExp(NO_FIX) }).click();
    await expect(counter(page, STEP_1)).toBeVisible();
    await expect.poll(async () => rehearsalRows(JSON.parse(await deviceBytes(page))).length).toBe(1);
    await holdToStep2(page);
    const started = await deviceBytes(page);

    // The app is closed and reopened.
    await page.reload();
    await expect(page.getByRole('heading', { name: ENDING_HEADING })).toBeVisible();
    await expect(bar(page)).toHaveCount(0);
    await expect(counter(page, STEP_1)).toHaveCount(0);
    await expect(counter(page, STEP_2)).toHaveCount(0);
    await expect(stepHeading(page, BLACKSKY)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: RESULT_HEADING })).toHaveCount(0);
    // The only thing kept is the started rehearsal, and the restart changed nothing.
    expectOnlyAStartedRehearsalAdded(JSON.parse(before), JSON.parse(started), NO_FIX);
    expect(await deviceBytes(page)).toBe(started);

    // No step comes back: answering goes to the result, not to where the walk stopped.
    await page.getByRole('button', { name: /^Not walked, a dry run/ }).click();
    await expect(page.getByRole('heading', { name: RESULT_HEADING })).toBeVisible();
    await expect(counter(page, STEP_1)).toHaveCount(0);
    await expect(counter(page, STEP_2)).toHaveCount(0);
  });
});

// TC-5.1.5-F
test.describe('TC-5.1.5-F nothing is written, nothing is sent', () => {
  for (const condition of CONDITIONS) {
    // As amended by E5-US1-AC5: starting keeps one started rehearsal, and the
    // two steps write nothing beyond it, through a reload.
    test(`both steps under "${condition}" write nothing beyond the started rehearsal, through a reload`, async ({
      page,
    }) => {
      const offOrigin = watchOffOrigin(page);
      await page.goto(KEEP_WITH_GAP);
      await expect(page.getByRole('heading', { name: CHOOSE_HEADING })).toBeVisible();
      const before = await deviceBytes(page);

      await page.getByRole('button', { name: new RegExp(condition) }).click();
      await expect(counter(page, STEP_1)).toBeVisible();
      await expect.poll(async () => rehearsalRows(JSON.parse(await deviceBytes(page))).length).toBe(1);
      const started = await deviceBytes(page);
      expectOnlyAStartedRehearsalAdded(JSON.parse(before), JSON.parse(started), condition);

      // A tap that does not advance writes nothing further.
      await holdControl(page).click();
      await expect(page.getByText(HOLD_HINT)).toBeVisible();
      expect(await deviceBytes(page)).toBe(started);

      await holdToStep2(page);
      // Give any late write the chance to land before it is ruled out.
      await page.waitForTimeout(500);
      expect(await deviceBytes(page)).toBe(started);

      // A reload finds the started rehearsal and asks; it writes nothing.
      await page.reload();
      await expect(page.getByRole('heading', { name: ENDING_HEADING })).toBeVisible();
      expect(await deviceBytes(page)).toBe(started);

      expect(offOrigin).toEqual([]);
    });

    // The walk writes nothing. Reaching the result is what records the finished
    // run (E5-US2-AC1), and that one record is the only thing that changes.
    test(`completing the walk under "${condition}" adds only the finished rehearsal, and sends nothing`, async ({
      page,
    }) => {
      const offOrigin = watchOffOrigin(page);
      await page.goto(KEEP_WITH_GAP);
      await expect(page.getByRole('heading', { name: CHOOSE_HEADING })).toBeVisible();
      const before = JSON.parse(await deviceBytes(page));

      await page.getByRole('button', { name: new RegExp(condition) }).click();
      await expect(counter(page, STEP_1)).toBeVisible();
      await holdToStep2(page);
      await seeWhatItFound(page).click();
      await expect(page.getByRole('heading', { name: RESULT_HEADING })).toBeVisible();

      const rehearsals = async () => {
        const now = JSON.parse(await deviceBytes(page));
        return Object.values(now.indexedDB as Record<string, Record<string, unknown[]>>)
          .map((stores) => stores.rehearsals?.length ?? 0)
          .reduce((sum, n) => sum + n, 0);
      };
      await expect.poll(rehearsals).toBe(1);

      const strip = (device: { indexedDB: Record<string, Record<string, unknown>> }) => ({
        ...device,
        indexedDB: Object.fromEntries(
          Object.entries(device.indexedDB).map(([name, stores]) => [
            name,
            Object.fromEntries(Object.entries(stores).filter(([store]) => store !== 'rehearsals')),
          ]),
        ),
      });
      expect(strip(JSON.parse(await deviceBytes(page)))).toEqual(strip(before));

      await page.reload();
      await expect(page.getByRole('heading', { name: CHOOSE_HEADING })).toBeVisible();
      expect(strip(JSON.parse(await deviceBytes(page)))).toEqual(strip(before));
      expect(await rehearsals()).toBe(1);

      expect(offOrigin).toEqual([]);
    });
  }
});

// E5-US1-AC2 on the walk: the bar on both steps, without exception.
test.describe('AC5 the rehearsal bar is on both steps', () => {
  for (const condition of CONDITIONS) {
    test(`names "${condition}" on step 1 and step 2, and never the other`, async ({ page }) => {
      const other = condition === NO_DATA ? NO_FIX : NO_DATA;
      await startRun(page, condition);

      for (const step of [STEP_1, STEP_2]) {
        if (step === STEP_2) await holdToStep2(page);
        await expect(counter(page, step)).toBeVisible();
        await expect(bar(page)).toHaveCount(1);
        await expect(bar(page)).toContainText('Rehearsal');
        await expect(page.locator('.rehearsal-bar-condition')).toHaveText(condition);
        await expect(bar(page)).not.toContainText(other);
      }
    });
  }
});

test.describe('AC5 the walk cannot be skipped', () => {
  test('the result is not reachable from step 1', async ({ page }) => {
    await startRun(page, NO_DATA);

    await expect(seeWhatItFound(page)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: RESULT_HEADING })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: NO_GAPS_HEADING })).toHaveCount(0);
    // The only control that moves the walk on is the hold.
    const controls = main(page).getByRole('button');
    await expect(controls).toHaveCount(2);
    await expect(controls.nth(0)).toHaveAccessibleName(/^Hold for BlackSky\s*Next step$/i);
    await expect(controls.nth(1)).toHaveAccessibleName('Leave the rehearsal');
    await expect(main(page).getByRole('link')).toHaveCount(0);

    // Leaving and returning does not move it on either.
    await page.getByTestId('remount').click();
    await page.getByTestId('remount').click();
    await expect(counter(page, STEP_1)).toBeVisible();
    await expect(seeWhatItFound(page)).toHaveCount(0);
  });

  test('step 2 is not reachable without the hold', async ({ page }) => {
    await startRun(page, NO_DATA);

    // A tap, a press released at half the time, and a keyboard tap.
    await holdControl(page).click();
    await pointerHold(page, HOLD_MS / 2);
    await holdControl(page).focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(FULL_HOLD);

    await expect(counter(page, STEP_1)).toBeVisible();
    await expect(counter(page, STEP_2)).toHaveCount(0);
    await expect(stepHeading(page, BLACKSKY)).toHaveCount(0);
  });

  test('leaving the rehearsal on step 2 and starting again begins at step 1', async ({ page }) => {
    await startRun(page, NO_FIX);
    await holdToStep2(page);
    await main(page).getByRole('button', { name: 'Leave the rehearsal' }).click();
    await expect(bar(page)).toHaveCount(0);

    await page.getByTestId('remount').click();
    await page.getByTestId('remount').click();
    // E5-US1-AC5: leaving gave it no ending, so that is asked before another
    // can start. Answered, it reaches its result; left from there, the choice.
    await expect(page.getByRole('heading', { name: ENDING_HEADING })).toBeVisible();
    await page.getByRole('button', { name: /^Not walked, a dry run/ }).click();
    await expect(page.getByRole('heading', { name: RESULT_HEADING })).toBeVisible();
    await main(page).getByRole('button', { name: 'Leave the rehearsal' }).click();

    await page.getByRole('button', { name: new RegExp(NO_FIX) }).click();
    await expect(counter(page, STEP_1)).toBeVisible();
    await expect(counter(page, STEP_2)).toHaveCount(0);
  });
});

// The hold on step 1 behaves like the real control [E3-US3-AC1, HOLD_TO_ENTER].
test.describe('AC5 the two-second hold', () => {
  test('a tap earns only the hint, and does not advance', async ({ page }) => {
    await startRun(page, NO_DATA);
    await expect(page.getByText(HOLD_HINT)).toHaveCount(0);

    await holdControl(page).click();
    await expect(page.getByText(HOLD_HINT)).toBeVisible();
    await page.waitForTimeout(FULL_HOLD);
    await expect(counter(page, STEP_1)).toBeVisible();
    await expect(stepHeading(page, BLACKSKY)).toHaveCount(0);
  });

  test('a press released before two seconds does not advance', async ({ page }) => {
    await startRun(page, NO_DATA);
    await pointerHold(page, HOLD_MS - 700);
    await page.waitForTimeout(FULL_HOLD);
    await expect(counter(page, STEP_1)).toBeVisible();
    await expect(page.getByText(HOLD_HINT)).toBeVisible();
  });

  test('a full hold advances to step 2', async ({ page }) => {
    await startRun(page, NO_DATA);
    await holdToStep2(page);
    await expect(counter(page, STEP_1)).toHaveCount(0);
  });

  for (const key of ['Enter', ' '] as const) {
    test(`is operable from the keyboard with ${key === ' ' ? 'Space' : key}`, async ({ page }) => {
      await startRun(page, NO_DATA);

      await holdControl(page).focus();
      await expect(holdControl(page)).toBeFocused();
      await page.keyboard.down(key);
      await page.waitForTimeout(FULL_HOLD);
      await page.keyboard.up(key);

      await expect(counter(page, STEP_2)).toBeVisible();
      await expect(stepHeading(page, BLACKSKY)).toBeVisible();
    });
  }

  test('the advance on step 2 is reachable and usable from the keyboard', async ({ page }) => {
    await startRun(page, NO_DATA);
    await holdToStep2(page);
    await seeWhatItFound(page).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: NO_GAPS_HEADING })).toBeVisible();
  });
});

// The criterion's rules: nothing on a step counts, totals, scores or grades, and
// no step names a hazard the pack does not hold. A value from the pack may carry
// a date, and a designation may name the pack's own hazard.
test.describe('AC5 a step never marks the reader', () => {
  // Both harness packs hold bushfire and nothing else.
  const ABSENT_HAZARDS = /\b(extreme heat|heat|flood|flooding)\b/;

  for (const [condition, url] of [
    [NO_DATA, REHEARSABLE],
    [NO_FIX, WITH_GAP],
  ] as const) {
    test(`nothing counts or scores, and no hazard the pack does not hold, under "${condition}"`, async ({
      page,
    }) => {
      await startRun(page, condition, url);
      for (const step of [STEP_1, STEP_2]) {
        if (step === STEP_2) await holdToStep2(page);
        await expect(stepLines(page)).toHaveCount(2);
        // The counter is set in capitals by its style, so everything is lowered first.
        const text = (await main(page).innerText()).toLowerCase();
        const counterText = step.toLowerCase();
        const values = (await valuesOf(stepLines(page)).allInnerTexts()).map((value) =>
          value.trim().toLowerCase(),
        );

        // No percentage, no "out of", and no score, grade or verdict word.
        expect(text).not.toContain('%');
        ['score', 'grade', 'passed', 'failed', 'out of', 'prepared'].forEach((word) =>
          expect(text, `found "${word}"`).not.toContain(word),
        );
        // The only "n of n" on a step is the step counter.
        expect(text.match(/\b\d+\s+of\s+\d+\b/g)).toEqual([counterText.replace('step ', '')]);
        // Every other digit sits inside a value taken from the pack: with the
        // counter and every value removed, no digit is left standing alone.
        let rest = text.replace(counterText, '');
        values.forEach((value) => {
          rest = rest.split(value).join('');
        });
        expect(rest).not.toMatch(/\d/);
        // No hazard the pack does not hold.
        expect(text).not.toMatch(ABSENT_HAZARDS);

        if (step === STEP_1) {
          // So both rules bite: step 1 does show a saved date, and it is inside a
          // value; and the pack's own hazard is named, inside its designation.
          expect(values.some((value) => /\d/.test(value))).toBe(true);
          expect(values.some((value) => value.includes('bushfire'))).toBe(true);
        }
        await expect(page.getByText('Nothing is sent from this rehearsal. Nothing leaves this phone.')).toBeVisible();
      }
    });
  }
});

// Accessibility, after e2e/rehearsal-entry-a11y.spec.ts. Desktop Chromium at a
// narrow viewport stands in for, and does not replace, the device passes the
// criterion still owes (VoiceOver, Dynamic Type, Android font scale).

/** Walks to the step and waits for its lines. */
async function openStep(page: Page, step: 1 | 2, condition = NO_FIX, url = REHEARSABLE) {
  await startRun(page, condition, url);
  if (step === 2) await holdToStep2(page);
  await expect(stepLines(page)).toHaveCount(2);
}

for (const step of [1, 2] as const) {
  // WCAG 1.4.4
  test(`AC5 step ${step} survives 200% text with no clipping or overlap`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await openStep(page, step);

    const lineHeight = async () => Math.round((await stepLines(page).first().boundingBox())!.height);
    const before = await lineHeight();
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await expect
      .poll(async () => page.evaluate(() => getComputedStyle(document.documentElement).fontSize))
      .toBe('32px');
    // The check has to bite: the lines must actually have reflowed.
    expect(await lineHeight()).toBeGreaterThan(before);

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
      // Every block of the step in document order: none may intrude on the one above.
      const blocks = [...document.querySelectorAll<HTMLElement>('main h2, main h3, main p, main button')].map(
        (el) => {
          const box = el.getBoundingClientRect();
          return { text: (el.textContent ?? '').slice(0, 30), top: box.top, bottom: box.bottom };
        },
      );
      const overlaps: string[] = [];
      for (let i = 1; i < blocks.length; i += 1) {
        if (blocks[i].top < blocks[i - 1].bottom - 1) overlaps.push(`${blocks[i - 1].text} / ${blocks[i].text}`);
      }
      return {
        overflowing,
        clipped,
        overlaps,
        hScroll: document.body.scrollWidth > doc.clientWidth + 1,
      };
    });

    expect(report.overlaps).toEqual([]);
    expect(report.clipped).toEqual([]);
    expect(report.overflowing).toEqual([]);
    expect(report.hScroll).toBe(false);
    await expect(stepLines(page)).toHaveCount(2);
    await expect(counter(page, step === 1 ? STEP_1 : STEP_2)).toBeVisible();
  });

  // WCAG 2.5.8
  test(`AC5 step ${step} controls meet the minimum target size`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await openStep(page, step);

    const advance = step === 1 ? holdControl(page) : seeWhatItFound(page);
    for (const control of [advance, main(page).getByRole('button', { name: 'Leave the rehearsal' })]) {
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(24);
      expect(box!.height).toBeGreaterThanOrEqual(24);
    }
  });

  // WCAG 1.4.3. Measured with opacity folded in, since a translucent line reads
  // lighter than its computed colour says.
  test(`AC5 step ${step} meets the contrast minimum on every element`, async ({ page }) => {
    await openStep(page, step);

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
        '.rehearsal-bar-marker, .rehearsal-bar-condition, main h2, main h3, main p, main button, main button span';
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

    // Bar marker and condition, counter, heading, two line titles and two
    // statements, the advance control, the line about sending, and the way out.
    expect(rows.length).toBeGreaterThanOrEqual(11);
    const failing = rows.filter((row) => row.ratio < row.required);
    expect(failing, JSON.stringify(failing)).toEqual([]);
  });

  // WCAG 1.3.1. What a screen reader announces is the DOM order, so that is what
  // is asserted; the VoiceOver pass stands.
  test(`AC5 step ${step} reads bar, counter, heading, then its lines`, async ({ page }) => {
    await openStep(page, step);

    const position = (locator: Locator) =>
      locator.evaluate((el) => Array.from(document.querySelectorAll('*')).indexOf(el));

    const heading = stepHeading(page, step === 1 ? YOUR_PACK : BLACKSKY);
    await expect(heading).toHaveJSProperty('tagName', 'H2');

    const order = [
      await position(bar(page)),
      await position(counter(page, step === 1 ? STEP_1 : STEP_2)),
      await position(heading),
      await position(stepLines(page).nth(0)),
      await position(stepLines(page).nth(1)),
      await position(step === 1 ? holdControl(page) : seeWhatItFound(page)),
    ];
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);

    // Navigating by heading meets the step heading first, then each line's title.
    const headings = await main(page)
      .getByRole('heading')
      .evaluateAll((els) => els.map((el) => `${el.tagName} ${el.textContent}`));
    expect(headings).toEqual(
      step === 1
        ? ['H2 Your pack', `H3 ${DESIGNATION}`, `H3 ${PROVENANCE}`]
        : ['H2 BlackSky', `H3 ${PLACES}`, `H3 ${LIVE_DIRECTION}`],
    );
  });
}
