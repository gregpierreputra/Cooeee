import { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes, useLocation, useParams } from 'react-router';
import * as copy from './core/copy';
import BlackSky from './ui/BlackSky';
import Home from './ui/Home';
import PackDetail from './ui/PackDetail';
import { Search } from './ui/PackNew/Search';

/** main.tsx dispatches this when the service worker has a new version waiting.
 *  Nothing reloads on its own: reloading someone mid-emergency is exactly the
 *  silent replacement this product forbids, in the place it would hurt most. */
export const SW_UPDATE_EVENT = 'cooeee:update-ready';

// Route prefix to <html data-mode>. Routing configuration, not a threshold —
// it decides nothing about the user's situation, so it stays out of src/core.
const MODE_BY_PREFIX: readonly (readonly [string, string])[] = [
  ['/blacksky', 'blacksky'],
  ['/recover', 'recover'],
];

function ModeSwitch() {
  const { pathname } = useLocation();
  useEffect(() => {
    const mode = MODE_BY_PREFIX.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? 'prepare';
    document.documentElement.dataset.mode = mode;
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
  return (
    <BrowserRouter>
      <ModeSwitch />
      <UpdateBanner applyUpdate={applyUpdate} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/packs/:packId" element={<PackDetailRoute />} />
        <Route path="/packs/new" element={<Search />} />
        <Route path="/blacksky" element={<BlackSky />} />
      </Routes>
    </BrowserRouter>
  );
}
