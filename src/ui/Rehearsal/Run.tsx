import type { ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import * as copy from '../../core/copy';
import type { RehearsalRun } from '../../core/rehearsal-run';
import { endRun } from './run-state';

/** E5-US1-AC2 — the shell every screen of a running rehearsal sits inside.
 *
 *  The bar is not rendered by the screens either: the app's back bar carries
 *  it above the Back control whenever a run is in memory on a rehearsal path,
 *  so "present on every screen of the run, without exception" is a property
 *  of the shell, and a screen added later cannot forget it.
 *
 *  Leaving is the only way out and ends the run, which is what removes the bar.
 *  There is no control anywhere in here that reaches outside the device: no
 *  call, no message, no share, no request. A rehearsal of an emergency that
 *  really dialled or really messaged someone would be the worst defect this
 *  product could ship, so the run holds nothing that could. */
export default function Run({ run, children }: { run: RehearsalRun; children?: ReactNode }) {
  const navigate = useNavigate();
  // Out the way it came in: the pack page when its Rehearse this pack opened
  // the rehearsal, else the Rehearse tab.
  const [params] = useSearchParams();
  const leave = () => {
    endRun();
    navigate(params.get('from') === 'pack' ? `/packs/${run.packId}` : '/rehearse');
  };

  return (
    <>
      <main className="page rehearsal-run">
        {children}
        {/* Once it has ended, the way out is Done, filled as a finished game
            ends. While it runs, leaving is set apart by a rule above it and the
            app's red outline: it ends something, like delete. */}
        <div className="actions rehearsal-leave">
          {run.ending ? (
            <button className="action main-action" type="button" onClick={leave}>
              {copy.GAME_DONE}
            </button>
          ) : (
            <button className="action leave-action" type="button" onClick={leave}>
              {copy.LEAVE_REHEARSAL}
            </button>
          )}
        </div>
      </main>
    </>
  );
}
