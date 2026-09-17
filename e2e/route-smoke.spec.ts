import { expect, test } from '@playwright/test';
import { acknowledgeFirstOpen, waitForController } from './helpers';

// Every screen a returning user can reach by its address, in the production
// build. One script error on any of them fails the run. A mistake that breaks
// rendering everywhere (a bad effect in the app shell, say) shows up here on
// its own, rather than as a scatter of unrelated looking failures.
const ROUTES = ['/', '/packs/new', '/nearby', '/recover', '/recover?need=kept', '/about', '/rehearse', '/packs/no-such-pack', '/rehearse/no-such-pack'];

for (const offline of [false, true]) {
  test(`every route renders with no script error, ${offline ? 'with the network off' : 'online'}`, async ({ page, context }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await acknowledgeFirstOpen(page);
    await page.goto('/');
    if (offline) {
      await waitForController(page);
      await context.setOffline(true);
    }
    for (const route of ROUTES) {
      await page.goto(route);
      // Something of the app is on screen: never a blank document.
      await expect(page.locator('main, [role="main"]').first(), route).toBeVisible();
    }
    // And from screen to screen inside the app, as a person moves: an effect
    // in the app shell runs its cleanup only on this kind of move, never on a
    // full page load.
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Main' });
    for (const name of ['Nearby', 'Rehearse', 'Recover', 'About', 'Home']) {
      await nav.getByRole('link', { name, exact: true }).click();
      await expect(page.locator('main, [role="main"]').first(), name).toBeVisible();
    }
    expect(errors).toEqual([]);
    await context.setOffline(false);
  });
}
