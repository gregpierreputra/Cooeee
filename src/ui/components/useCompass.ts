import { useCallback, useEffect, useRef, useState } from 'react';
import { freshHeading, headingSource, type HeadingReading } from '../../core/blacksky-dial';
import { COMPASS_SILENT_MS } from '../../core/constants';
import { compassHeading } from '../../core/geo';

// iOS only hands out the orientation sensor after a tap-driven permission
// request; Android and desktop browsers expose it without one.
type OrientationEvents = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};
const orientationEvents = (): OrientationEvents | undefined =>
  typeof DeviceOrientationEvent === 'undefined' ? undefined : DeviceOrientationEvent;

/** Turns the dial with the phone. Two sources feed it: the orientation sensor,
 *  corrected from magnetic to true north by `declinationDeg`, and the direction
 *  of movement the position sensor reports, handed in through `setMovement`.
 *  Each reading lands in a ref; once per display frame the pure rule in
 *  core/blacksky-dial.ts picks between them and the winner is written into the
 *  CSS variable `--heading` on the document root. One DOM write, no React
 *  render: the dial's own CSS does the rotation from it. Readings arrive at
 *  sensor rate (about 60 a second); the frame throttle only ever drops readings
 *  the display could not have shown.
 *
 *  A source that stays quiet for COMPASS_SILENT_MS stops counting. With none
 *  left the variable is removed, which draws the dial north up, and `live`
 *  turns false so the screen can say so. `live` changes only when the dial
 *  starts or stops turning, so that is the only render this hook causes. */
export function useCompass(declinationDeg: number) {
  // Read at each sensor event through a ref, so a new fix (and so a new
  // declination) never re-registers the listener.
  const declination = useRef(declinationDeg);
  declination.current = declinationDeg;
  const [granted, setGranted] = useState(
    () => typeof orientationEvents()?.requestPermission !== 'function',
  );
  const [live, setLive] = useState(false);

  const compass = useRef<HeadingReading | null>(null);
  const movement = useRef<(HeadingReading & { speedMps: number }) | null>(null);
  // Asks for one paint on the next frame. Filled in by the effect below, so
  // that readings arriving before it runs are simply kept for the first paint.
  const requestPaint = useRef(() => {});

  useEffect(() => {
    const target = document.documentElement;
    let frame = 0;
    let turning = false;

    const paint = () => {
      frame = 0;
      const now = Date.now();
      // A movement heading is already true north: no declination is added.
      const { deg } = headingSource(
        freshHeading(compass.current, now),
        freshHeading(movement.current, now),
        movement.current?.speedMps,
      );
      if (deg === null) target.style.removeProperty('--heading');
      else target.style.setProperty('--heading', String(deg));
      if (turning !== (deg !== null)) {
        turning = deg !== null;
        setLive(turning); // only on the change, never per reading
      }
    };
    requestPaint.current = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };

    // A silent sensor sends no event to react to, so silence is looked for on a
    // timer. A third of the limit bounds the lateness to one second.
    const watchdog = setInterval(paint, COMPASS_SILENT_MS / 3);
    requestPaint.current();
    return () => {
      clearInterval(watchdog);
      cancelAnimationFrame(frame);
      requestPaint.current = () => {};
      target.style.removeProperty('--heading');
    };
  }, []);

  useEffect(() => {
    if (!granted) return;
    const onReading = (event: DeviceOrientationEvent) => {
      const magnetic = compassHeading(event, screen.orientation?.angle ?? 0);
      if (magnetic === null) return;
      compass.current = { deg: (magnetic + declination.current + 360) % 360, at: Date.now() };
      requestPaint.current();
    };

    // Chrome on Android gives the absolute (magnetic-north) reading on its own event name.
    const type =
      'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
    window.addEventListener(type, onReading as EventListener);
    return () => {
      window.removeEventListener(type, onReading as EventListener);
      compass.current = null;
    };
  }, [granted]);

  /** The position sensor's own direction of movement and speed, from each
   *  position sample. Anything but two finite numbers clears the reading: a
   *  phone that is standing still reports none. */
  const setMovement = useCallback((headingDeg: number | undefined, speedMps: number | undefined) => {
    movement.current =
      typeof headingDeg === 'number' && typeof speedMps === 'number'
        ? { deg: headingDeg, speedMps, at: Date.now() }
        : null;
    requestPaint.current();
  }, []);

  const enable = async () => {
    const request = orientationEvents()?.requestPermission;
    if (request && (await request()) === 'granted') setGranted(true);
  };

  return { live, needsPermission: !granted, enable, setMovement };
}
