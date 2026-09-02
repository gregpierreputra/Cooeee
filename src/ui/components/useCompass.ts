import { useEffect, useRef, useState } from 'react';
import { compassHeading } from '../../core/geo';

// iOS only hands out the orientation sensor after a tap-driven permission
// request; Android and desktop browsers expose it without one.
type OrientationEvents = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};
const orientationEvents = (): OrientationEvents | undefined =>
  typeof DeviceOrientationEvent === 'undefined' ? undefined : DeviceOrientationEvent;

/** Turns every arrow on screen with the phone. Each sensor reading, corrected
 *  from magnetic to true north by `declinationDeg`, is written once per display
 *  frame into the CSS variable `--heading` on the document root — one DOM
 *  write, no React render — and the arrows' own CSS does the rotation from it. Readings arrive at sensor rate (about 60 a second); the
 *  frame throttle only ever drops readings the display could not have shown. */
export function useCompass(declinationDeg: number) {
  // Read at each sensor event through a ref, so a new fix (and so a new
  // declination) never re-registers the listener.
  const declination = useRef(declinationDeg);
  declination.current = declinationDeg;
  const [granted, setGranted] = useState(
    () => typeof orientationEvents()?.requestPermission !== 'function',
  );
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!granted) return;
    const target = document.documentElement;

    let frame = 0;
    let heading = 0;
    let announced = false;
    const paint = () => {
      frame = 0;
      target.style.setProperty('--heading', String(heading));
    };
    const onReading = (event: DeviceOrientationEvent) => {
      const magnetic = compassHeading(event, screen.orientation?.angle ?? 0);
      if (magnetic === null) return;
      const next = (magnetic + declination.current + 360) % 360;
      if (!announced) {
        announced = true;
        setLive(true); // one render, so the screen can say the compass is on
      }
      heading = next;
      if (!frame) frame = requestAnimationFrame(paint);
    };

    // Chrome on Android gives the absolute (magnetic-north) reading on its own event name.
    const type =
      'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
    window.addEventListener(type, onReading as EventListener);
    return () => {
      window.removeEventListener(type, onReading as EventListener);
      cancelAnimationFrame(frame);
      target.style.removeProperty('--heading');
    };
  }, [granted]);

  const enable = async () => {
    const request = orientationEvents()?.requestPermission;
    if (request && (await request()) === 'granted') setGranted(true);
  };

  return { live, needsPermission: !granted, enable };
}
