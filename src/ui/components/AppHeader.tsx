import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import * as copy from '../../core/copy';
import { headerAge, oldestPack, type HeaderAge } from '../../core/home';
import { watchCompletePacks } from '../../data/db';
import Mark from './Mark';
import { startTour } from './Tour';

/** The fixed header — ONE component, mounted once by the application shell, so
 *  every screen carries the same header rather than its own copy of it.
 *
 *  Left: the mark and the name, which return home. Right: the oldest saved pack's age
 *  as real text, and the ring that starts the guided tour. Connection state lives in the notice bar above, not here. It
 *  reads IndexedDB and nothing else: no request is made from here in any state,
 *  and nothing in it suggests entering BlackSky, whatever the connection reports. */
export default function AppHeader({ now }: { now?: number }) {
  const [age, setAge] = useState<HeaderAge>({ kind: 'none' });

  // The header is mounted once for the whole app, so a single read at mount
  // would go on stating the age of a pack deleted since, and state nothing
  // after a first pack is saved. It is told whenever the packs change. It still
  // reads IndexedDB and nothing else.
  useEffect(
    () => watchCompletePacks((rows) => setAge(headerAge(now ?? Date.now(), oldestPack(rows)?.verifiedAt ?? null))),
    [now],
  );

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link className="app-header-home" to="/" aria-label={copy.HEADER_HOME_LABEL}>
          <Mark size={22} className="app-mark" />
          <span className="app-header-name">{copy.APP_NAME}</span>
        </Link>
        <div className="app-header-end">
          {/* The age as real text. Nothing at all when no pack is saved: no
              dash, no zero, no placeholder standing in for a fact that does not
              exist. */}
          {age.kind === 'none' ? null : <span className="app-header-age figure">{age.text}</span>}
          {/* UAT: the tour lives where help is looked for, on every screen. */}
          <button type="button" className="info-ring tour-ring" aria-label={copy.TOUR_HINT} onClick={startTour}>
            <span aria-hidden="true">?</span>
          </button>
        </div>
      </div>
    </header>
  );
}
