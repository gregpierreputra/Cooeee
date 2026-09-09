import { expect, test } from '@playwright/test';
import { GATE_KEY, GATE_VALUE } from '../src/core/constants';
import { ACKNOWLEDGE_CHECKBOX, GATE_INCORRECT, GATE_LOCKED, GATE_SUBMIT, GATE_TITLE } from '../src/core/copy';

// Feature 1, against the real production bundle. Nothing serves /api under
// vite preview, so each test plays the server's answer itself.
const answer = (status: number, body: object) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

test('a wrong password stays on the gate, and the third miss locks it', async ({ page }) => {
  let misses = 0;
  await page.route('**/api/v1/gate', (route) => {
    misses += 1;
    return route.fulfill(
      misses < 3
        ? answer(401, { error: 'incorrect', attemptsLeft: 3 - misses })
        : answer(429, { error: 'locked', retryAfterSeconds: 45 }),
    );
  });
  await page.goto('/');
  const field = page.getByLabel(GATE_TITLE);
  const enter = page.getByRole('button', { name: GATE_SUBMIT });
  await expect(enter).toBeDisabled();

  await field.fill('wrong');
  await enter.click();
  await expect(page.getByRole('status')).toHaveText(GATE_INCORRECT(2));
  await expect(field).toHaveValue('');
  await field.fill('wrong');
  await enter.click();
  await expect(page.getByRole('status')).toHaveText(GATE_INCORRECT(1));
  await field.fill('wrong');
  await enter.click();
  await expect(page.getByRole('status')).toHaveText(GATE_LOCKED(45));
  await expect(field).toBeDisabled();
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
});

test('the password reaches the disclosure and stores one flag', async ({ page }) => {
  const sent: unknown[] = [];
  await page.route('**/api/v1/gate', (route) => {
    sent.push(route.request().postDataJSON());
    return route.fulfill(answer(200, { ok: true }));
  });
  await page.goto('/');
  await page.getByLabel(GATE_TITLE).fill('open-sesame');
  await page.getByRole('button', { name: GATE_SUBMIT }).click();
  await expect(page.getByText(ACKNOWLEDGE_CHECKBOX)).toBeVisible();

  expect(sent).toEqual([{ password: 'open-sesame' }]);
  expect(
    await page.evaluate(() =>
      Object.fromEntries(Array.from({ length: localStorage.length }, (_u, i) => [localStorage.key(i)!, localStorage.getItem(localStorage.key(i)!)])),
    ),
  ).toEqual({ [GATE_KEY]: GATE_VALUE });
});
