import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App, { SW_UPDATE_EVENT } from './app';
import { sweepBuilding } from './data/db';
import './ui/theme.css';

// registerType: 'prompt' — the new shell waits until the user chooses it.
const updateSW = registerSW({
  onNeedRefresh: () => window.dispatchEvent(new Event(SW_UPDATE_EVENT)),
});

const root = createRoot(document.getElementById('root')!);

// Every 'building' pack and its children go before anything renders, so an
// interrupted build can never be observed as a saved place.
sweepBuilding().finally(() => {
  root.render(
    <StrictMode>
      <App applyUpdate={() => updateSW(true)} />
    </StrictMode>,
  );
});
