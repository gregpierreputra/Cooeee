import { useEffect, useState } from 'react';
import { AGE_CLOCK_MS } from '../../core/constants';

/** The time now, moved on once a minute, for screens that state an age in
 *  words: "Checked just now" becomes "Checked 1 minute ago" without a reload.
 *  A fixed time, passed by a test, stays fixed. */
export function useMinuteClock(fixed?: number): number {
  const [now, setNow] = useState(() => fixed ?? Date.now());
  useEffect(() => {
    if (fixed !== undefined) return undefined;
    const tick = setInterval(() => setNow(Date.now()), AGE_CLOCK_MS);
    return () => clearInterval(tick);
  }, [fixed]);
  return fixed ?? now;
}
