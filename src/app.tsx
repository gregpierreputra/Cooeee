import { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes, useLocation, useNavigate, useParams } from 'react-router';
import { openingScreen, writeAcknowledgement } from './core/acknowledgement';
import { isBlackSkyLatched } from './core/blacksky-latch';
import * as copy from './core/copy';
import { localFlagStore } from './data/acknowledgement';
import { cacheNspSnapshot } from './data/nsp';
import BlackSky from './ui/BlackSky';
import FirstOpen from './ui/FirstOpen';
import Home from './ui/Home';
import Nearby from './ui/Nearby';
import AppHeader from './ui/components/AppHeader';
import BackBar from './ui/components/BackBar';
import BottomNav from './ui/components/BottomNav';
import NoticeBar from './ui/components/NoticeBar';
import PackDetail from './ui/PackDetail';
import { Search } from './ui/PackNew/Search';

/** main.tsx dispatches this when the service worker has a new version waiting.
 *  Nothing reloads on its own: reloading someone mid-emergency is exactly the
 *  silent replacement this product forbids, in the place it would hurt most. */
export const SW_UPDATE_EVENT = 'cooeee:update-ready';

// Latched as well as dispatched: the worker can report a waiting update before
// the banner has mounted its listener, and a missed event would leave the old
// shell running until the next full reload.
let updateReady = false;
export function markUpdateReady() {
  updateReady = true;
  window.dispatchEvent(new Event(SW_UPDATE_EVENT));
}

/** While BlackSky was the last screen open, every arrival anywhere else goes
 *  straight back to it: an installed app relaunches at '/', a reload or a
 *  return from another site lands wherever it lands, and a jump of several
 *  history entries at once (the long-press back list) unmounts BlackSky before
 *  its own back handler can run. Checked on start and on every change of
 *  screen; the hold on Leave BlackSky clears the latch first, so leaving is
 *  never bounced. */
function BlackSkyResume() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => {
    if (isBlackSkyLatched(localFlagStore()) && !pathname.startsWith('/blacksky')) {
      navigate('/blacksky', { replace: true });
    }
  }, [pathname]);
  return null;
}

// Route prefix to <html data-mode>. Routing configuration, not a threshold —
// it decides nothing about the user's situation, so it stays out of src/core.
function ModeSwitch() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.documentElement.dataset.mode = pathname.startsWith('/blacksky')
      ? 'blacksky'
      : 'prepare';
  }, [pathname]);
  return null;
}

/** E1-US2-AC6 — the fixed header is ONE component, mounted here for the whole
 *  application rather than copied into each screen. BlackSky is the exception:
 *  it is a full-screen mode with a single deliberate way out, and a second
 *  navigation bar across the top of it would be a second way to leave it by
 *  accident. */
function HeaderHost() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/blacksky')) return null;
  return <AppHeader />;
}

/** The bottom bar is ONE component too, mounted here for every screen but
 *  BlackSky, for the same reason as the header: that mode has a single
 *  deliberate way out, and a bar of destinations across the bottom of it
 *  would be another. */
function BottomNavHost() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/blacksky')) return null;
  return <BottomNav />;
}

function UpdateBanner({ applyUpdate }: { applyUpdate: () => void }) {
  const [ready, setReady] = useState(updateReady);

  useEffect(() => {
    const onReady = () => setReady(true);
    window.addEventListener(SW_UPDATE_EVENT, onReady);
    return () => window.removeEventListener(SW_UPDATE_EVENT, onReady);
  }, []);

  if (!ready) return null;
  return (
    <div className="banner" role="status">
      <span>{copy.NEW_VERSION_READY}</span>
      <button type="button" onClick={applyUpdate}>
        {copy.RELOAD_NOW}
      </button>
    </div>
  );
}

function PackDetailRoute() {
  const { packId = '' } = useParams();
  return <PackDetail packId={packId} />;
}

export default function App({ applyUpdate }: { applyUpdate: () => void }) {
  // E1-US1-AC0. Read once, synchronously, before the first paint: the
  // disclosure screen comes BEFORE any other screen, so there is no frame in
  // which a route renders behind it. A store that cannot be read reads as "not
  // acknowledged", which shows the screen rather than blocking the app.
  const [screen, setScreen] = useState(() => openingScreen(localFlagStore()));

  // The CFA site list into IndexedDB, so BlackSky can point at the nearest
  // official places with the radios off. A failed copy costs nothing now.
  useEffect(() => {
    cacheNspSnapshot().catch(() => {});
  }, []);

  if (screen === 'first-open') {
    return (
      <FirstOpen
        onAcknowledge={() => {
          // The user moves on either way. A browser that refuses the write is a
          // reason to ask again on the next open, never a reason to trap
          // someone on this screen.
          writeAcknowledgement(localFlagStore());
          setScreen('prepared');
        }}
      />
    );
  }

  return (
    <BrowserRouter>
      <BlackSkyResume />
      <ModeSwitch />
      <NoticeBar />
      <HeaderHost />
      <UpdateBanner applyUpdate={applyUpdate} />
      <BackBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/packs/:packId" element={<PackDetailRoute />} />
        <Route path="/packs/new" element={<Search />} />
        <Route path="/nearby" element={<Nearby />} />
        <Route path="/blacksky" element={<BlackSky />} />
      </Routes>
      <BottomNavHost />
    </BrowserRouter>
  );
}
