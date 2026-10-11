/** The twist every drill plays under until the page is closed, set only by
 *  the test harness so a test does not change with the date. Null in the app,
 *  where the day decides. */
let pinned: string | null = null;
export const pinTwist = (twist: string | null): void => {
  pinned = twist;
};
export const pinnedTwist = (): string | null => pinned;
