import { expect, test } from '@playwright/test';

// On a phone the height changes as the address bar hides and shows, and as the
// keyboard opens. The background keeps its motes and its size through both, so
// scrolling neither scatters them nor uncovers the page; only a new width, as
// when the phone is turned, starts them afresh. Reduced motion draws one still
// frame, so the frame itself shows whether the motes moved.
test.use({ viewport: { width: 390, height: 844 } });

const frame = (page: import('@playwright/test').Page) =>
  page.locator('canvas.particles').evaluate((canvas: HTMLCanvasElement) => ({
    width: canvas.width,
    height: canvas.height,
    cssHeight: canvas.getBoundingClientRect().height,
    pixels: canvas.toDataURL(),
  }));

test('the background holds still and stays covering as the height changes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('canvas.particles')).toHaveCount(1);
  const before = await frame(page);

  // The keyboard opens: a shorter screen. Nothing is redrawn and nothing shrinks.
  await page.setViewportSize({ width: 390, height: 500 });
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const keyboard = await frame(page);
  expect(keyboard.height).toBe(before.height);
  expect(keyboard.pixels).toBe(before.pixels);
  expect(keyboard.cssHeight).toBeGreaterThanOrEqual(844);

  // Back to full height, as when the address bar hides: the same motes.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => new Promise(requestAnimationFrame));
  expect((await frame(page)).pixels).toBe(before.pixels);

  // Turned on its side: a new width starts the motes afresh to fill it.
  await page.setViewportSize({ width: 844, height: 390 });
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const turned = await frame(page);
  expect(turned.width).not.toBe(before.width);
  expect(turned.pixels).not.toBe(before.pixels);
});
