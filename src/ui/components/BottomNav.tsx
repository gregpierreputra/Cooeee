import { Link } from 'react-router';
import * as copy from '../../core/copy';
import type { NavItem } from '../../core/home';

/** The bottom navigation. Two destinations, both of which exist in Iteration 1;
 *  what they are is decided in core/home.ts navItems(), not here.
 *
 *  BlackSky is deliberately absent: it is entered by a deliberate hold, and a
 *  tab is exactly the accidental entry the hold exists to prevent. */
export default function BottomNav({ items }: { items: NavItem[] }) {
  return (
    <nav className="bottom-nav" aria-label={copy.NAV_LABEL}>
      {items.map((item) => (
        <Link key={item.key} className="bottom-nav-item" to={item.to}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
