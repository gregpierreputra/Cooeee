import { useState } from 'react';
import * as copy from '../../core/copy';
import Mark from './Mark';

/** True only when this document load came from outside the app: a typed
 *  address, a link on another site, or the installed app being launched. A
 *  reload or a back/forward step is not an arrival, and moving between screens
 *  never reloads the document at all, so the splash cannot play twice in one
 *  visit. */
function arrivedFromOutside(): boolean {
  const [entry] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
  return entry?.type === 'navigate';
}

/** The call going out, once, on arrival: the mark draws itself, the sound
 *  rings away from it, the name and the tagline follow, then the whole layer
 *  fades. Purely decorative, hidden from assistive technology, and it lets
 *  every tap through, so nothing waits for it. The layer's own fade is the
 *  last animation, and its end unmounts it. */
export default function Splash() {
  const [shown, setShown] = useState(arrivedFromOutside);
  if (!shown) return null;

  return (
    <div
      className="splash"
      aria-hidden="true"
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) setShown(false);
      }}
    >
      <div className="splash-mark">
        <Mark size={72} />
      </div>
      <b className="splash-name">{copy.APP_NAME}</b>
      <p className="splash-tagline">{copy.APP_TAGLINE}</p>
    </div>
  );
}
