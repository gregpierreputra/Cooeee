import { useEffect, useRef, useState } from 'react';
import { COPY_CONFIRM_MS } from '../../core/constants';

export type CopyResult = 'copied' | 'failed';

/** Clears the one control now saying Copied or Not copied, so a copy from
 *  another never leaves two claiming the clipboard. */
let clearShown: (() => void) | null = null;

/** What a copy did, said on its own control for a few seconds and then gone:
 *  it reports a moment, not what the clipboard holds later. Shared by Copy on
 *  a call card and Share on a Nearby place. */
export function useCopied(): [CopyResult | null, (result: CopyResult) => void] {
  const [shown, setShown] = useState<CopyResult | null>(null);
  const timer = useRef<number | undefined>(undefined);

  // Leaving the page stops the timer with the control.
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const show = (result: CopyResult) => {
    const clear = () => {
      window.clearTimeout(timer.current);
      setShown(null);
    };
    clearShown?.();
    clearShown = clear;
    setShown(result);
    timer.current = window.setTimeout(clear, COPY_CONFIRM_MS);
  };
  return [shown, show];
}
