import { useEffect, useRef, useState } from 'react';
import { HOLD_MS } from '../../core/constants';
import * as copy from '../../core/copy';

/** The hold-to-enter control, extracted from Home so every screen that offers
 *  BlackSky offers the same gesture rather than its own copy of the timer.
 *
 *  BlackSky opens on a HOLD, not a tap: a pocket press must not switch the
 *  phone into an emergency screen. The timer lives in a ref, and any release or
 *  exit before HOLD_MS cancels it. A cut-short press earns only the small
 *  "hold to enter" hint. A completed hold gets a confirmation buzz where the
 *  device supports one (iOS does not — there, the pressed colour fill is the
 *  cue) and then runs onHold.
 *
 *  Keyboard-operable by the same rule: Enter or Space held for the same
 *  duration, so the gesture has an accessible equivalent rather than being
 *  pointer-only. */
export default function HoldButton({
  label,
  onHold,
  className = 'blacksky-hold',
}: {
  label: string;
  onHold: () => void;
  className?: string;
}) {
  // Once shown, the hint stays until the mode is actually entered (entering
  // unmounts this screen). Removing it when a press starts would shift the
  // layout UNDER the active press, slide the button out from beneath the
  // finger, and fire pointerleave — silently cancelling the very hold the hint
  // taught.
  const [showHoldHint, setShowHoldHint] = useState(false);
  const holdTimer = useRef<number | null>(null);

  const clearHold = () => {
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

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
      setShowHoldHint(true);
    }
  };

  useEffect(() => clearHold, []);

  return (
    <>
      <button
        type="button"
        className={className}
        onPointerDown={startHold}
        onPointerUp={releaseHold}
        onPointerLeave={releaseHold}
        onPointerCancel={releaseHold}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) startHold();
        }}
        onKeyUp={releaseHold}
      >
        {label}
      </button>
      {showHoldHint ? (
        <p className="muted blacksky-hold-hint" role="status">
          {copy.HOLD_TO_ENTER}
        </p>
      ) : null}
    </>
  );
}
