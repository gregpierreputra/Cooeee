import type { FlagStore } from './acknowledgement';
import { AWAY_DAYS, LAST_VISIT_KEY } from './constants';

const DAY_MS = 86_400_000;

/** Whether this browser opened Cooeee before and has been away AWAY_DAYS or
 *  more. A first visit, a missing or unreadable value and a store that cannot
 *  be read all say no, so nobody is asked on a guess. */
export function backAfterAWeek(store: FlagStore | null, now: number): boolean {
  try {
    const last = Number(store?.getItem(LAST_VISIT_KEY));
    return Number.isInteger(last) && last > 0 && Math.floor(now / DAY_MS) - last >= AWAY_DAYS;
  } catch {
    return false;
  }
}

/** Records today as the last visit. A store that refuses simply forgets. */
export function recordVisit(store: FlagStore | null, now: number): void {
  try {
    store?.setItem(LAST_VISIT_KEY, String(Math.floor(now / DAY_MS)));
  } catch {
    // Nothing depends on it but the next visit's question.
  }
}
