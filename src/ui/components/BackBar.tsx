import { useLocation, useNavigate } from 'react-router';
import * as copy from '../../core/copy';
import { canStepBack } from './history';
import RehearsalBar from '../Rehearsal/RehearsalBar';
import { useRehearsalRun } from '../Rehearsal/run-state';

/** The one persistent way back, at the top of every screen. Each click steps
 *  back through the pages the user actually visited; when there is nothing
 *  left to step back through, it lands on the home screen — never outside the
 *  app. The home screen itself is that terminal point, so the bar hides there.
 *  BlackSky hides it too: that mode's only exit is its own Leave control, so
 *  none of the prepare-mode chrome offers a way out.
 *
 *  E5-US1-AC2 — while a rehearsal is running, its bar sits inside this one,
 *  above the Back control, so the marker is the first thing at the top of every
 *  rehearsal screen and the two stick to the page as one. */
export default function BackBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const run = useRehearsalRun();
  if (pathname === '/' || pathname.startsWith('/blacksky')) return null;

  const goBack = () => {
    // Nothing of ours behind this entry means going back would leave the app,
    // so the home screen is the terminal point instead.
    if (canStepBack()) navigate(-1);
    else navigate('/');
  };

  return (
    <nav className="back-bar">
      {/* Only on the running rehearsal's own screens: another pack's rehearsal
          page is not a screen of this run, and must not wear its bar. */}
      {run && pathname.startsWith(`/rehearse/${run.packId}`) ? <RehearsalBar run={run} /> : null}
      <div className="back-bar-inner">
        <button type="button" onClick={goBack}>
          <span aria-hidden="true">‹</span> {copy.BACK}
        </button>
      </div>
    </nav>
  );
}
