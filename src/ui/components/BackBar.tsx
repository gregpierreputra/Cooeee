import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { backTarget, ONE_STEP } from '../../core/back';
import * as copy from '../../core/copy';
import { listCompletePacks } from '../../data/db';
import { useBuilderBack } from '../PackNew/builder-back';
import RehearsalBar from '../Rehearsal/RehearsalBar';
import { useRehearsalRun } from '../Rehearsal/run-state';

/** The one persistent way back, at the top of every screen below a tab. Back
 *  goes up to the screen above (core/back.ts), so it never jumps to whichever
 *  tab was open before. In the pack builder it goes back one step. It hides
 *  on the tabs' own screens, and in BlackSky, whose only exit is its own Leave
 *  control.
 *
 *  E5-US1-AC2 — while a rehearsal is running, its bar sits inside this one,
 *  above the Back control, so the marker is the first thing at the top of every
 *  rehearsal screen and the two stick to the page as one. */
export default function BackBar() {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const run = useRehearsalRun();
  const builder = useBuilderBack();
  // On a rehearsal, Back to the chooser only makes sense with several packs.
  const [packCount, setPackCount] = useState<number | null>(null);
  useEffect(() => {
    if (!pathname.startsWith('/rehearse/')) return;
    let live = true;
    listCompletePacks().then(
      (packs) => live && setPackCount(packs.length),
      () => live && setPackCount(0),
    );
    return () => {
      live = false;
    };
  }, [pathname]);

  const target = backTarget(pathname, search, { packCount, runPackId: run?.packId ?? null, builder });
  // Only on the running rehearsal's own screens: another pack's rehearsal
  // page is not a screen of this run, and must not wear its bar.
  const runBar = run && pathname.startsWith(`/rehearse/${run.packId}`) ? <RehearsalBar run={run} /> : null;
  if (!target && !runBar) return null;

  return (
    <nav className="back-bar">
      {runBar}
      {target ? (
        <div className="back-bar-inner">
          <button type="button" onClick={() => (target === ONE_STEP ? navigate(ONE_STEP) : navigate(target))}>
            <span aria-hidden="true">‹</span> {copy.BACK}
          </button>
        </div>
      ) : null}
    </nav>
  );
}
