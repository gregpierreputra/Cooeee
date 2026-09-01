import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import * as copy from '../../core/copy';
import { headerAge, oldestPack, type HeaderAge } from '../../core/home';
import type { Pack } from '../../core/types';
import { listCompletePacks } from '../../data/db';

/** The fixed header — ONE component, mounted once by the application shell, so
 *  every screen carries the same header rather than its own copy of it.
 *
 *  Left: the mark and the name, which return home. Right: the saved pack's age
 *  as real text, and a connection dot that carries no words on screen. It reads
 *  IndexedDB and nothing else: no request is made from here in any state, and
 *  nothing in it suggests entering BlackSky, whatever the connection reports. */
export default function AppHeader({ now }: { now?: number }) {
  const [age, setAge] = useState<HeaderAge>({ kind: 'none' });

  useEffect(() => {
    let live = true;
    listCompletePacks().then((rows: Pack[]) => {
      if (!live) return;
      setAge(headerAge(now ?? Date.now(), oldestPack(rows)?.verifiedAt ?? null));
    });
    return () => {
      live = false;
    };
  }, [now]);

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link className="app-header-home" to="/" aria-label={copy.HEADER_HOME_LABEL}>
          <AppMark />
          <span className="app-header-name">{copy.APP_NAME}</span>
        </Link>
        <div className="app-header-state">
          {/* Nothing at all when no pack is saved: no dash, no zero, no
              placeholder standing in for an age that does not exist. */}
          {age.kind === 'none' ? null : (
            <span className="app-header-age figure">{age.text}</span>
          )}
          <ConnectionDot />
        </div>
      </div>
    </header>
  );
}

/** The mark. Three strokes of a call carrying outward — drawn inline so it
 *  costs no request and renders with the radios off, and decorative, because
 *  the name beside it is the accessible one. */
function AppMark() {
  return (
    <svg
      className="app-mark"
      viewBox="0 0 24 24"
      width="22"
      height="22"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="6" cy="12" r="2.5" fill="currentColor" />
      <path
        d="M11 6.5a8 8 0 0 1 0 11M15.5 3a13 13 0 0 1 0 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A dot, with no words on screen. It reports what the browser reports and
 *  nothing more — this app cannot detect phone signal — so its whole meaning
 *  lives in its accessible name, and it never offers a way into anything. */
function ConnectionDot() {
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

  return (
    <span
      className={`connection-dot ${online ? 'connection-online' : 'connection-offline'}`}
      role="img"
      aria-label={online ? copy.CONNECTION_ONLINE_LABEL : copy.CONNECTION_OFFLINE_LABEL}
    />
  );
}
