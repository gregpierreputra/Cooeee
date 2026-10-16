import { useEffect, useState } from 'react';
import {
  BrowserRouter,
  Route,
  Routes,
  useLocation,
  Navigate,
  useNavigate,
  useNavigationType,
  useParams,
} from 'react-router';
import { openingScreen, writeAcknowledgement } from './core/acknowledgement';
import { isBlackSkyLatched } from './core/blacksky-latch';
import { BLOCKED_NOTICE_MS, GATE_SHOWN, WORD_GAME_SHOWN } from './core/constants';
import { canStepBack } from './ui/components/history';
import * as copy from './core/copy';
import { readGate, writeGate } from './core/gate';
import { pruneKept } from './core/kept';
import { localFlagStore } from './data/acknowledgement';
import { cacheNspSnapshot } from './data/nsp';
import { loadRecoveryPrograms } from './data/recovery';
import BlackSky from './ui/BlackSky';
import FirstOpen from './ui/FirstOpen';
import Gate from './ui/Gate';
import Home from './ui/Home';
import Welcome from './ui/Welcome';
import Nearby from './ui/Nearby';
import AppHeader from './ui/components/AppHeader';
import BackBar from './ui/components/BackBar';
import Particles from './ui/components/Particles';
import BottomNav from './ui/components/BottomNav';
import AwayCheck from './ui/components/AwayCheck';
import NoticeBar from './ui/components/NoticeBar';
import Splash from './ui/components/Splash';
import Tour, { startTour } from './ui/components/Tour';
import { focusMain } from './ui/components/focusMain';
import PackDetail from './ui/PackDetail';
import PackPrint from './ui/PackPrint';
import Recover from './ui/Recover';
import Choose from './ui/Rehearsal/Choose';
import RehearsalEntry from './ui/Rehearsal/Entry';
import BlockScreen from './ui/Block/BlockScreen';
import DrillScreen from './ui/Drill/DrillScreen';
import WordScreen from './ui/Word/WordScreen';
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

/** The welcome's hold: into BlackSky once, as the bar's hold goes, with the
 *  first arrival spotlight asked for. */
function RescueStart() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/blacksky', { state: { held: true, guide: true } });
  }, []);
  return null;
}

/** A new person's visit to BlackSky ends when they leave it: with nothing
 *  agreed to, they go back to the welcome rather than on into the app. */
function RescueEnd({ onLeft }: { onLeft: () => void }) {
  const { pathname } = useLocation();
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (pathname.startsWith('/blacksky')) setSeen(true);
    else if (seen) onLeft();
  }, [pathname]);
  return null;
}

const BLACKSKY_BLOCKED_EVENT = 'cooeee:blacksky-blocked';

/** BlackSky, but only for the two arrivals that are meant to open it: a fresh
 *  two second hold, or a visit that never ended (the latch is still set, as
 *  after a reload or a relaunch).
 *
 *  Entering BlackSky adds two history entries and leaving replaces only the
 *  newest, so an older one stays under the screen the user left to. Back,
 *  Forward or a typed address would land on it and open BlackSky with no hold.
 *  The hold marks its own navigation with `held`. History keeps that mark on
 *  the old entry, so an arrival by Back or Forward (POP) never counts as a
 *  hold. Any other arrival is stepped over, and one short line says so. */
function BlackSkyRoute() {
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const { state } = useLocation();
  // Decided once, at arrival: BlackSky sets the latch as soon as it mounts.
  const [allowed] = useState(
    () =>
      isBlackSkyLatched(localFlagStore()) ||
      (navigationType !== 'POP' && (state as { held?: boolean } | null)?.held === true),
  );
  useEffect(() => {
    if (allowed) return;
    window.dispatchEvent(new Event(BLACKSKY_BLOCKED_EVENT));
    if (canStepBack()) navigate(-1);
    else navigate('/', { replace: true });
  }, [allowed]);
  return allowed ? <BlackSky /> : null;
}

/** The one line that says BlackSky was not opened. It asks for nothing, closes
 *  on a tap, and goes on its own after BLOCKED_NOTICE_MS. */
function BlockedNotice() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const onBlocked = () => setShown(true);
    window.addEventListener(BLACKSKY_BLOCKED_EVENT, onBlocked);
    return () => window.removeEventListener(BLACKSKY_BLOCKED_EVENT, onBlocked);
  }, []);
  useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(() => setShown(false), BLOCKED_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [shown]);

  if (!shown) return null;
  return (
    <div className="banner" role="status">
      <span>{copy.BLACKSKY_BLOCKED}</span>
      <button type="button" onClick={() => setShown(false)}>
        {copy.CLOSE}
      </button>
    </div>
  );
}

/** A new route starts at its top. The browser keeps the window's scroll when
 *  the router swaps one screen for another in the same document. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0); // in braces, see the first run effect in App
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
    focusMain();
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

/** The living background from the welcome, on every screen but BlackSky,
 *  where every pixel that can stay off does, to save the battery. Unmounting
 *  stops its frames. */
function ParticlesHost() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/blacksky')) return null;
  return <Particles />;
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

/** One page of a pack, to print, from the pack's menu on Home or its pack page. */
function PackPrintRoute() {
  const { packId = '' } = useParams();
  return <PackPrint packId={packId} />;
}

/** E5-US1-AC4 — the way into a rehearsal, from the pack page or from the bar's
 *  picker. The gate it renders decides from the device whether a rehearsal can
 *  start at all. */
function RehearsalRoute() {
  const { packId = '' } = useParams();
  return <RehearsalEntry packId={packId} />;
}

export default function App({ applyUpdate }: { applyUpdate: () => void }) {
  // E1-US1-AC0. Read once, synchronously, before the first paint: the
  // disclosure screen comes BEFORE any other screen, so there is no frame in
  // which a route renders behind it. A store that cannot be read reads as "not
  // acknowledged", which shows the screen rather than blocking the app.
  const [screen, setScreen] = useState(() => openingScreen(localFlagStore()));
  // Feature 1: the development gate stands in front of the disclosure itself,
  // while GATE_SHOWN is on. Off, every visitor has passed it.
  const [passed, setPassed] = useState(() => !GATE_SHOWN || readGate(localFlagStore()));
  // The welcome is seen once, on the way to the disclosure. Nothing records
  // it: the acknowledgement that follows is the only flag this screen leads to.
  const [welcomed, setWelcomed] = useState(false);
  // A new person who held I need a way out now: the app opens straight into
  // BlackSky with nothing agreed to ('hold'), as does a reload while there
  // ('resume'). They stay a first time visitor: leaving BlackSky takes them
  // back to the welcome, so the app itself only opens once they have agreed.
  const [rescue, setRescue] = useState<'hold' | 'resume' | null>(() =>
    screen === 'first-open' && isBlackSkyLatched(localFlagStore()) ? 'resume' : null,
  );
  // Each first run screen replaces the last in the same document, so the window
  // keeps its scroll. On a small phone the welcome's button is below the fold,
  // and the disclosure then opened at its checkbox with the four statements
  // above the screen. Every new screen starts at its top.
  useEffect(() => {
    // In braces on purpose: newer browsers return a promise from scrollTo, and
    // React takes whatever an effect returns for its cleanup function.
    window.scrollTo(0, 0);
  }, [passed, welcomed, screen, rescue]);
  // The call plays once more after the disclosure, over the first Home. A new
  // key mounts a fresh splash; `play` tells it not to ask how the page loaded.
  const [replays, setReplays] = useState(0);

  // The CFA site list into IndexedDB, so BlackSky can point at the nearest
  // official places with the radios off. A failed copy costs nothing now.
  useEffect(() => {
    cacheNspSnapshot().catch(() => {});
    // The recovery programs too, so Recover works before any pack is saved;
    // a kept id the new snapshot no longer holds is dropped with it.
    loadRecoveryPrograms()
      .then((programs) => pruneKept(localFlagStore(), programs.map((program) => program.id)))
      .catch(() => {});
  }, []);

  function screenFor() {
    if (!passed) {
      return (
        <Gate
          onPass={() => {
            writeGate(localFlagStore());
            setPassed(true);
          }}
        />
      );
    }

    if (screen === 'first-open' && !rescue && !welcomed) {
      return <Welcome onContinue={() => setWelcomed(true)} onWayOut={() => setRescue('hold')} />;
    }

    if (screen === 'first-open' && !rescue) {
      return (
        <FirstOpen
          onAcknowledge={() => {
            // The user moves on either way. A browser that refuses the write is a
            // reason to ask again on the next open, never a reason to trap
            // someone on this screen.
            writeAcknowledgement(localFlagStore());
            // The one time the tour starts on its own: the first landing.
            startTour();
            setReplays(1);
            setScreen('prepared');
          }}
        />
      );
    }

    return (
      <BrowserRouter>
        <BlackSkyResume />
        {rescue === 'hold' ? <RescueStart /> : null}
        {rescue ? <RescueEnd onLeft={() => setRescue(null)} /> : null}
        <ScrollToTop />
        <ModeSwitch />
        <NoticeBar />
        <ParticlesHost />
        <HeaderHost />
        <UpdateBanner applyUpdate={applyUpdate} />
        <BlockedNotice />
        <BackBar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/packs/:packId" element={<PackDetailRoute />} />
          <Route path="/packs/:packId/print" element={<PackPrintRoute />} />
          <Route path="/packs/new" element={<Search />} />
          <Route path="/rehearse" element={<Choose />} />
          {/* The games: static paths, so they rank above a pack id. */}
          <Route path="/rehearse/drill" element={<DrillScreen />} />
          {/* Kept, but offered nowhere: an old link lands on Rehearse. */}
          <Route path="/rehearse/word" element={WORD_GAME_SHOWN ? <WordScreen /> : <Navigate to="/rehearse" replace />} />
          <Route path="/rehearse/block" element={<BlockScreen />} />
          <Route path="/rehearse/:packId" element={<RehearsalRoute />} />
          <Route path="/nearby" element={<Nearby />} />
          <Route path="/recover" element={<Recover />} />
          {/* About moved into the tour's welcome; an old link lands Home. */}
          <Route path="/about" element={<Navigate to="/" replace />} />
          <Route path="/blacksky" element={<BlackSkyRoute />} />
        </Routes>
        <Tour />
        <BottomNavHost />
        <AwayCheck />
      </BrowserRouter>
    );
  }

  // The splash sits above whichever screen opens: the gate, the disclosure,
  // or the app itself, so an arrival looks the same wherever it lands.
  return (
    <>
      {/* Not over a return to BlackSky: the dial shows at once. */}
      <Splash
        key={replays}
        play={replays > 0 ? true : isBlackSkyLatched(localFlagStore()) ? false : undefined}
      />
      {/* The gate, the welcome and the disclosure stand before the router. */}
      {passed && (screen !== 'first-open' || rescue) ? null : <Particles />}
      {screenFor()}
    </>
  );
}
