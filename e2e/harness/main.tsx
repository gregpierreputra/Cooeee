import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import type { PendingPlace } from '../../src/core/types';
import { Confirm } from '../../src/ui/PackNew/Confirm';
import { Search } from '../../src/ui/PackNew/Search';
import '../../src/ui/theme.css';

declare global {
  interface Window {
    __confirmedPlace?: PendingPlace;
    __searchAgainCount: number;
  }
}

window.__searchAgainCount = 0;

// Synthetic data exists only in this harness, which is excluded from the PWA build.
const testCandidate = {
  address: '6 RIDGE ROAD KALORAMA 3766',
  localityName: 'KALORAMA',
  lat: -37.817939,
  lon: 145.36594,
};

const root = document.querySelector<HTMLDivElement>('#root');
if (!root) throw new Error('Test harness root is missing');

const confirmation = (
  <Confirm
    candidate={testCandidate}
    onConfirm={(pendingPlace) => {
      window.__confirmedPlace = pendingPlace;
    }}
    onSearchAgain={() => {
      window.__searchAgainCount += 1;
    }}
  />
);

createRoot(root).render(
  <StrictMode>
    {window.location.pathname === '/search' ? (
      <Search onPendingPlace={(place) => { window.__confirmedPlace = place; }} />
    ) : confirmation}
  </StrictMode>,
);
