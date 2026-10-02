import { useEffect } from 'react';

/** Keeps the screen awake while `active` is true, and only then
 *  (BS_Enhancement-AC4). The pure rule for WHEN lives in core/blacksky-voice.ts;
 *  this hook only asks the browser and lets go.
 *
 *  The browser drops a wake lock by itself whenever the page is hidden, so it
 *  is asked for again each time the page comes back. The lock goes when
 *  `active` turns false and when the screen unmounts, which is what the hold on
 *  Leave BlackSky does. A phone that refuses (power saving, or no such API)
 *  behaves as it always did: nothing is shown and nothing is said. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let over = false;

    const request = () => {
      if (document.hidden) return; // the browser refuses a hidden page anyway
      void lock?.release(); // never hold two
      lock = null;
      navigator.wakeLock.request('screen').then(
        (held) => {
          if (over) void held.release(); // granted after the need ended: let it go
          else lock = held;
        },
        () => {},
      );
    };
    const onVisibility = () => {
      if (!document.hidden) request();
    };

    request();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      over = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void lock?.release();
      lock = null;
    };
  }, [active]);
}
