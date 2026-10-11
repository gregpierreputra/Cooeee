import type { NavItem } from '../../core/home';
import { NavIcon } from './BottomNav';

/** The tab's name over a screen's large title, led by the same drawing as the
 *  tab in the bottom bar, so it never reads as a section label. */
export default function TabLabel({ tab, text }: { tab: NavItem['key']; text: string }) {
  return (
    <span className="kicker tab-label">
      <NavIcon kind={tab} />
      {text}
    </span>
  );
}
