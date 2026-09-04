import { Link } from 'react-router';
import * as copy from '../../core/copy';
import type { NavItem } from '../../core/home';

/** The bottom navigation. Two or three destinations, all of which exist; what
 *  they are is decided in core/home.ts navItems(), not here.
 *
 *  A fixed bar on the panel colour, so it stays within thumb reach whatever the
 *  page above it does. Each item is an icon over its label — the label is
 *  always there, because an icon on its own is a guess.
 *
 *  BlackSky is deliberately absent: it is entered by a deliberate hold, and a
 *  tab is exactly the accidental entry the hold exists to prevent. */
export default function BottomNav({ items }: { items: NavItem[] }) {
  return (
    <nav className="bottom-nav" aria-label={copy.NAV_LABEL}>
      <div className="bottom-nav-inner">
        {items.map((item) => (
          <Link key={item.key} className="bottom-nav-item" to={item.to}>
            <NavIcon kind={item.key} />
            <span className="bottom-nav-label">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

const ICON_PATHS: Record<NavItem['key'], string> = {
  home: 'M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z',
  nearby: 'M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11zM12 7.8a2.2 2.2 0 1 0 0 4.4a2.2 2.2 0 1 0 0-4.4',
  pack: 'M5 4h9l5 5v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM14 4v5h5M8 13h8M8 17h5',
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
