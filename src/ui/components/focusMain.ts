/** Focus follows the screen, so a keyboard or screen reader lands on the new
 *  page rather than on a control that has just gone. Shared by the route change
 *  (app.tsx) and by screens whose steps swap the page without a new path. */
export function focusMain() {
  const main = document.querySelector('main');
  if (!main) return;
  main.tabIndex = -1;
  main.focus({ preventScroll: true });
}
