import { ACKNOWLEDGEMENT_KEY, ACKNOWLEDGEMENT_VALUE } from './constants';

/** The narrowest slice of a browser storage that this decision needs. Passing
 *  the store in is what keeps the rule testable with no browser, and what stops
 *  a second call site inventing its own key. */
export type FlagStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

/** Which screen the app opens on. Derived from the stored flag every time it is
 *  asked, never held as a second copy of the same fact. */
type OpeningScreen = 'first-open' | 'prepared';

/** True only for the exact marker this version of the screen writes. Anything
 *  else — absent, empty, a stale value, a value from another origin's key, or a
 *  store that throws on read — is "not acknowledged", so the screen is shown
 *  again rather than the app being blocked or silently skipped. */
export function readAcknowledgement(store: FlagStore | null): boolean {
  if (!store) return false;
  try {
    return store.getItem(ACKNOWLEDGEMENT_KEY) === ACKNOWLEDGEMENT_VALUE;
  } catch {
    return false;
  }
}

/** Records the acknowledgement and reports whether it will survive to the next
 *  open. A store that refuses the write returns false; the caller still moves
 *  the user on, because a browser that cannot keep the flag is a reason to ask
 *  again next time, not a reason to trap someone on this screen. */
export function writeAcknowledgement(store: FlagStore | null): boolean {
  if (!store) return false;
  try {
    store.setItem(ACKNOWLEDGEMENT_KEY, ACKNOWLEDGEMENT_VALUE);
  } catch {
    return false;
  }
  return readAcknowledgement(store);
}

export function openingScreen(store: FlagStore | null): OpeningScreen {
  return readAcknowledgement(store) ? 'prepared' : 'first-open';
}
