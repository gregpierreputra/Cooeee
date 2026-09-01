import { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes, useLocation, useParams } from 'react-router';
import { openingScreen, writeAcknowledgement } from './core/acknowledgement';
import * as copy from './core/copy';
import { localFlagStore } from './data/acknowledgement';
import BlackSky from './ui/BlackSky';
import FirstOpen from './ui/FirstOpen';
import Home from './ui/Home';
import BackBar from './ui/components/BackBar';
import NoticeBar from './ui/components/NoticeBar';
import PackDetail from './ui/PackDetail';
import { Search } from './ui/PackNew/Search';

/** main.tsx dispatches this when the service worker has a new version waiting.
 *  Nothing reloads on its own: reloading someone mid-emergency is exactly the
 *  silent replacement this product forbids, in the place it would hurt most. */
export const SW_UPDATE_EVENT = 'cooeee:update-ready';

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

function UpdateBanner({ applyUpdate }: { applyUpdate: () => void }) {
  const [ready, setReady] = useState(false);

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
      <ModeSwitch />
      <NoticeBar />
      <UpdateBanner applyUpdate={applyUpdate} />
      <BackBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/packs/:packId" element={<PackDetailRoute />} />
        <Route path="/packs/new" element={<Search />} />
        <Route path="/blacksky" element={<BlackSky />} />
      </Routes>
    </BrowserRouter>
  );
}
