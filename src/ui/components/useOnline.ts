import { useEffect, useState } from 'react';

/** What the browser reports about the network — reported state only, never a
 *  probe. This app cannot detect phone signal, so the value is a fact about the
 *  browser and never a verdict about the world. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  return online;
}
