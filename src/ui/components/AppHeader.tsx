import { useEffect, useState } from 'react';
import Mark from './Mark';
import { Link } from 'react-router';
import * as copy from '../../core/copy';
import { headerAge, oldestPack, type HeaderAge } from '../../core/home';
import type { Pack } from '../../core/types';
import { listCompletePacks } from '../../data/db';

/** The fixed header — ONE component, mounted once by the application shell, so
 *  every screen carries the same header rather than its own copy of it.
 *
 *  Left: the mark and the name, which return home. Right: the oldest saved pack's age
 *  as real text. Connection state lives in the notice bar above, not here. It
 *  reads IndexedDB and nothing else: no request is made from here in any state,
 *  and nothing in it suggests entering BlackSky, whatever the connection reports. */
export default function AppHeader({ now }: { now?: number }) {
  const [age, setAge] = useState<HeaderAge>({ kind: 'none' });

  useEffect(() => {
    let live = true;
    listCompletePacks().then(
      (rows: Pack[]) => {
        if (!live) return;
        setAge(headerAge(now ?? Date.now(), oldestPack(rows)?.verifiedAt ?? null));
      },
      () => undefined, // an unreadable store reports no age
    );
    return () => {
      live = false;
    };
  }, [now]);

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link className="app-header-home" to="/" aria-label={copy.HEADER_HOME_LABEL}>
          <Mark size={22} className="app-mark" />
          <span className="app-header-name">{copy.APP_NAME}</span>
        </Link>
        {/* One pill on the right: the age as real text. Nothing at all when no
            pack is saved: no dash, no zero, no placeholder standing in for a
            fact that does not exist. */}
        {age.kind === 'none' ? null : <span className="app-header-age figure">{age.text}</span>}
      </div>
    </header>
  );
}

