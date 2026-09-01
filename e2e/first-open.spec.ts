import { expect, test, type Page } from '@playwright/test';
import { ACKNOWLEDGEMENT_KEY, ACKNOWLEDGEMENT_VALUE } from '../src/core/constants';
import {
  ACKNOWLEDGE_CHECKBOX,
  APP_NAME,
  CONTINUE,
  DISCLOSURE_ADDRESS,
  DISCLOSURE_DOES,
  DISCLOSURE_DOES_NOT,
  DISCLOSURE_POSITION,
  FIRST_OPEN_PURPOSE,
  HOME_TITLE,
  OFFICIAL_CHANNELS_LINE,
} from '../src/core/copy';

// E1-US1-AC0, against the real production bundle. Every test here starts from a
// device with no acknowledgement stored, which is what a fresh install — and a
// browser whose site data has just been cleared — actually looks like.

const continueButton = (page: Page) => page.getByRole('button', { name: CONTINUE });
const checkbox = (page: Page) => page.getByRole('checkbox', { name: ACKNOWLEDGE_CHECKBOX });

async function storedFlag(page: Page) {
  return page.evaluate((key) => localStorage.getItem(key), ACKNOWLEDGEMENT_KEY);
}

// TC-1.1.0-A
test('a device with nothing stored opens on the disclosure screen, continue inactive', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: APP_NAME })).toBeVisible();
  await expect(page.getByText(FIRST_OPEN_PURPOSE)).toBeVisible();

  // The four statements in full, as on-screen text — not behind a link and not
  // inside a details element.
  for (const statement of [
    DISCLOSURE_DOES,
    DISCLOSURE_DOES_NOT,
    DISCLOSURE_ADDRESS,
    DISCLOSURE_POSITION,
  ]) {
    await expect(page.getByText(statement)).toBeVisible();
  }
  await expect(page.locator('details')).toHaveCount(0);
  await expect(page.getByText(OFFICIAL_CHANNELS_LINE)).toBeVisible();

  await expect(checkbox(page)).not.toBeChecked();
  await expect(continueButton(page)).toBeDisabled();

  // Nothing was recorded by merely looking at the screen.
  expect(await storedFlag(page)).toBeNull();
});

test('the order on screen is the order the criterion names', async ({ page }) => {
  await page.goto('/');
  const body = (await page.locator('body').innerText()) ?? '';
  const order = [
    APP_NAME,
    FIRST_OPEN_PURPOSE,
    DISCLOSURE_DOES,
    DISCLOSURE_DOES_NOT,
    DISCLOSURE_ADDRESS,
    DISCLOSURE_POSITION,
    OFFICIAL_CHANNELS_LINE,
    ACKNOWLEDGE_CHECKBOX,
    CONTINUE,
  ].map((text) => body.indexOf(text));

  expect(order.every((index) => index >= 0)).toBe(true);
  expect([...order].sort((a, b) => a - b)).toEqual(order);
});

// TC-1.1.0-B
test('ticking the box enables continue, which records the acknowledgement and moves on', async ({
  page,
}) => {
  await page.goto('/');
  await checkbox(page).check();
  await expect(continueButton(page)).toBeEnabled();

  await continueButton(page).click();

  await expect(page.getByRole('heading', { name: HOME_TITLE })).toBeVisible();
  expect(await storedFlag(page)).toBe(ACKNOWLEDGEMENT_VALUE);
});

test('unticking the box makes continue inactive again — the button follows the box', async ({
  page,
}) => {
  await page.goto('/');
  await checkbox(page).check();
  await expect(continueButton(page)).toBeEnabled();
  await checkbox(page).uncheck();
  await expect(continueButton(page)).toBeDisabled();
});

// TC-1.1.0-C
test('a later open goes straight past the screen', async ({ page }) => {
  await page.goto('/');
  await checkbox(page).check();
  await continueButton(page).click();
  await expect(page.getByRole('heading', { name: HOME_TITLE })).toBeVisible();

  await page.goto('/');
  await expect(page.getByRole('heading', { name: HOME_TITLE })).toBeVisible();
  await expect(page.getByText(ACKNOWLEDGE_CHECKBOX)).toHaveCount(0);
});

// TC-1.1.0-D
test('an unexpected stored value is treated as not acknowledged', async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, 'true'), ACKNOWLEDGEMENT_KEY);
  await page.goto('/');

  await expect(page.getByText(ACKNOWLEDGE_CHECKBOX)).toBeVisible();
  await expect(continueButton(page)).toBeDisabled();
});

// Done when: clearing site data returns the app to first open.
test('clearing site data returns the app to first open', async ({ page }) => {
  await page.goto('/');
  await checkbox(page).check();
  await continueButton(page).click();
  await expect(page.getByRole('heading', { name: HOME_TITLE })).toBeVisible();

  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
  await expect(page.getByText(ACKNOWLEDGE_CHECKBOX)).toBeVisible();
});

// Must show: no network request and no call to navigator.geolocation anywhere
// on this screen. The counter starts before the first navigation, so it sees
// the shell load too; only the app's own origin may answer it.
test('the screen makes no request off this origin and asks for no position', async ({ page }) => {
  const offOrigin: string[] = [];
  await page.route('**', (route) => {
    const url = route.request().url();
    if (!url.startsWith('http://localhost:4173/')) offOrigin.push(url);
    return route.continue();
  });

  // A real geolocation call would resolve against the emulated position; this
  // records the attempt itself, which is what must not happen.
  await page.addInitScript(() => {
    const asked: string[] = [];
    (window as unknown as { __positionAsks: string[] }).__positionAsks = asked;
    for (const name of ['getCurrentPosition', 'watchPosition'] as const) {
      const original = navigator.geolocation[name].bind(navigator.geolocation);
      Object.defineProperty(navigator.geolocation, name, {
        configurable: true,
        value: (...args: unknown[]) => {
          asked.push(name);
          return (original as (...a: unknown[]) => unknown)(...args);
        },
      });
    }
  });

  await page.goto('/');
  await expect(page.getByText(ACKNOWLEDGE_CHECKBOX)).toBeVisible();
  await checkbox(page).check();

  expect(offOrigin).toEqual([]);
  expect(
    await page.evaluate(() => (window as unknown as { __positionAsks: string[] }).__positionAsks),
  ).toEqual([]);
});

// The stored flag holds an acknowledgement marker and nothing else: no date, no
// identifier, no counter, and nothing about the person.
test('the acknowledgement is one flag holding one marker', async ({ page }) => {
  await page.goto('/');
  await checkbox(page).check();
  await continueButton(page).click();
  await expect(page.getByRole('heading', { name: HOME_TITLE })).toBeVisible();

  expect(
    await page.evaluate(() =>
      Object.fromEntries(
        Array.from({ length: localStorage.length }, (_unused, i) => {
          const key = localStorage.key(i)!;
          return [key, localStorage.getItem(key)];
        }),
      ),
    ),
  ).toEqual({ [ACKNOWLEDGEMENT_KEY]: ACKNOWLEDGEMENT_VALUE });
});
