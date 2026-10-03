import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App, { markUpdateReady } from './app';
import { sweepBuilding } from './data/db';
import './ui/theme.css';

// registerType: 'prompt' — the new shell waits until the user chooses it.
// An installed app left open never navigates, so the browser never looks for a
// new version on its own: it is asked once an hour while online. The user still
// chooses when to take it.
const UPDATE_CHECK_MS = 60 * 60_000;
const updateSW = registerSW({
  onNeedRefresh: markUpdateReady,
  onRegisterError: console.error,
  onRegisteredSW: (_url, registration) => {
    if (registration) setInterval(() => navigator.onLine && void registration.update(), UPDATE_CHECK_MS);
  },
});

// Ask the browser not to evict the saved pack under storage pressure. Best
// effort: a refusal changes nothing about how the app works.
void navigator.storage?.persist?.();

// Every 'building' pack and its children are swept in the background. Reads
// are complete-only (see data/db.ts), so a half-built pack is invisible whether
// or not the sweep has finished — and a slow store never blanks the screen.
sweepBuilding().catch(() => undefined);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App applyUpdate={() => updateSW(true)} />
  </StrictMode>,
);
