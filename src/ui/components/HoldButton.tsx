import { useEffect, useRef, useState, type ReactNode } from 'react';
import { HOLD_MS } from '../../core/constants';

export type HoldButtonProps = {
  onHold: () => void;
  hint: string;
  children: ReactNode;
};

/** A mode switch fires on a HOLD, not a tap: a pocket press must not flip the
 *  phone into or out of an emergency screen. The timer lives in a ref, and any
 *  release or exit before HOLD_MS cancels it. A cut-short press earns only the
 *  small "hold" hint. A completed hold gets a confirmation buzz where the
 *  device supports one (iOS does not — there, the pressed colour fill is the
 *  cue) and then runs onHold. */
export default function HoldButton({ onHold, hint, children }: HoldButtonProps) {
  const [showHint, setShowHint] = useState(false);
  const holdTimer = useRef<number | null>(null);
  const clearHold = () => {
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  // Once shown, the hint stays until the hold completes (onHold unmounts this
  // screen). Removing it when a press starts would shift the layout UNDER the
  // active press, slide the button out from beneath the finger, and fire
  // pointerleave — silently cancelling the very hold the hint taught.

  const startHold = () => {
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null;
      if ('vibrate' in navigator) navigator.vibrate(100);
      onHold();
    }, HOLD_MS);
  };

  const releaseHold = () => {
    if (holdTimer.current !== null) {
      clearHold();
      setShowHint(true);
    }
  };

  useEffect(() => clearHold, []);

  return (
    <>
      <button
        type="button"
        className="blacksky-hold"
        onPointerDown={startHold}
        onPointerUp={releaseHold}
        onPointerLeave={releaseHold}
        onPointerCancel={releaseHold}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) startHold();
        }}
        onKeyUp={releaseHold}
      >
        {children}
      </button>
      {showHint ? (
        <p className="muted blacksky-hold-hint" role="status">
          {hint}
        </p>
      ) : null}
    </>
  );
}
