import { NavLink, useNavigate } from 'react-router';
import { NAV_HOLD_HINT_MS } from '../../core/constants';
import * as copy from '../../core/copy';
import { NAV_ITEMS, type NavItem } from '../../core/home';
import HoldButton from './HoldButton';

/** The bottom navigation. Four destinations, all of which always exist; what
 *  they are is decided in core/home.ts NAV_ITEMS, not here. BlackSky sits in
 *  the middle as a compass, raised out of a notch in the bar.
 *
 *  A fixed bar on the panel colour, so it stays within thumb reach whatever the
 *  page above it does. Each item is an icon over its label — the label is
 *  always there, because an icon on its own is a guess. The destination the
 *  user is on is marked (aria-current, set by NavLink) so the bar also says
 *  where they are.
 *
 *  BlackSky is no tab: a tap does nothing, as a tab is exactly the accidental
 *  entry the hold exists to prevent. The compass opens it only on a two second
 *  hold, from any screen with the bar, and says so if it is only tapped. */
export default function BottomNav() {
  const navigate = useNavigate();
  const half = NAV_ITEMS.length / 2;
  const tab = (item: NavItem) => (
    <NavLink key={item.key} className="bottom-nav-item" to={item.to} end={item.to === '/'}>
      <NavIcon kind={item.key} />
      <span className="bottom-nav-label">{item.label}</span>
    </NavLink>
  );
  return (
    <nav className="bottom-nav" aria-label={copy.NAV_LABEL}>
      <div className="bottom-nav-inner">
        {NAV_ITEMS.slice(0, half).map(tab)}
        <div className="nav-blacksky-slot">
          <HoldButton
            className="nav-blacksky"
            label={copy.HOLD_FOR_BLACKSKY}
            hint={copy.HOLD_TO_ENTER}
            hintMs={NAV_HOLD_HINT_MS}
            onHold={() => navigate('/blacksky', { state: { held: true } })}
          >
            <Compass />
          </HoldButton>
          <span className="bottom-nav-label" aria-hidden="true">{copy.BLACKSKY_TITLE}</span>
        </div>
        {NAV_ITEMS.slice(half).map(tab)}
      </div>
    </nav>
  );
}

/** BlackSky's own arrow inside the four compass ticks, in its amber, and the
 *  ring the hold sweeps round outside it. */
function Compass() {
  return (
    <>
      <svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true" focusable="false">
        <path d="M24 3v5M45 24h-5M24 45v-5M3 24h5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M24 12 32 33 24 28.5 16 33z" fill="currentColor" />
      </svg>
      <svg className="nav-blacksky-sweep" viewBox="0 0 74 74" aria-hidden="true" focusable="false">
        <circle cx="37" cy="37" r="35.5" pathLength="100" />
      </svg>
    </>
  );
}

const ICON_PATHS: Record<NavItem['key'], string> = {
  home: 'M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z',
  nearby: 'M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11zM12 7.8a2.2 2.2 0 1 0 0 4.4a2.2 2.2 0 1 0 0-4.4',
  rehearse: 'M4 12a8 8 0 1 1 2.3 5.7M4 18v-4h4M12 8v4l2.5 2.5',
  recover: 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17M8.5 12h7M12 8.5v7',
};

/** Drawn inline, so the bar costs no request and renders with the radios off.
 *  Decorative in every case — the label beside it is the accessible one. */
function NavIcon({ kind }: { kind: NavItem['key'] }) {
  return (
    <svg
      className="bottom-nav-icon"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={ICON_PATHS[kind]} />
    </svg>
  );
}
