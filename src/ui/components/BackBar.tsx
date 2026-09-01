import { useLocation, useNavigate } from 'react-router';
import * as copy from '../../core/copy';

/** The one persistent way back, at the top of every screen. Each click steps
 *  back through the pages the user actually visited; when there is nothing
 *  left to step back through, it lands on the pack list — never outside the
 *  app. The pack list itself is that terminal point, so the bar hides there.
 *  BlackSky hides it too: that mode's only exit is its own Leave control, so
 *  none of the prepare-mode chrome offers a way out. */
export default function BackBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  if (pathname === '/' || pathname.startsWith('/blacksky')) return null;

  const goBack = () => {
    // The router stores this entry's position in the history stack as
    // history.state.idx. Position 0 means the entry before this one is not
    // ours (or does not exist), so going back would leave the app.
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate('/');
  };

  return (
    <nav className="back-bar">
      <div className="back-bar-inner">
        <button type="button" onClick={goBack}>
          <span aria-hidden="true">‹</span> {copy.BACK}
        </button>
      </div>
    </nav>
  );
}
