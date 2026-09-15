import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import * as copy from '../../core/copy';
import type { RehearsalRun } from '../../core/rehearsal-run';
import Head from './Head';
import RehearsalBar from './RehearsalBar';
import { endRun } from './run-state';

/** E5-US1-AC2 — the shell every screen of a running rehearsal sits inside.
 *
 *  The bar is rendered HERE rather than by each screen, so "present on every
 *  screen of the run, without exception" is a property of the structure: a
 *  screen added later cannot be given the bar wrongly or forgotten, because it
 *  does not render the bar at all. The bar is first in the DOM and sticks to
 *  the top of the page, so it is read first and stays visible without
 *  scrolling.
 *
 *  Leaving is the only way out and ends the run, which is what removes the bar.
 *  There is no control anywhere in here that reaches outside the device: no
 *  call, no message, no share, no request. A rehearsal of an emergency that
 *  really dialled or really messaged someone would be the worst defect this
 *  product could ship, so the run holds nothing that could. */
export default function Run({ run, children }: { run: RehearsalRun; children?: ReactNode }) {
  const navigate = useNavigate();

  return (
    <>
      <RehearsalBar run={run} />
      <main className="page rehearsal-run">
        <Head kind={run.ending ? 'found' : 'go'} />
        {children}
        <div className="actions">
          {/* Not a filled control: leaving a rehearsal is not what fixes
              anything, and the filled control means "this is what would fix
              it" everywhere else in this flow. */}
          <button
            className="action"
            type="button"
            onClick={() => {
              endRun();
              navigate(`/packs/${run.packId}`);
            }}
          >
            {copy.LEAVE_REHEARSAL}
          </button>
        </div>
      </main>
    </>
  );
}
