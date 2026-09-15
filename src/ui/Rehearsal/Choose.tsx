import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import * as copy from '../../core/copy';
import { homeView } from '../../core/home';
import Head from './Head';
import type { Pack } from '../../core/types';
import { listCompletePacks } from '../../data/db';
import RehearsalEntry from './Entry';
import { useRehearsalRun } from './run-state';

/** E5-US3-AC2 — the bar's Rehearse, before a pack is known.
 *
 *  One saved pack needs no question and goes straight to its gate. Several are
 *  asked about in the same tappable rows as the choice of condition, and
 *  nothing is chosen for the user. The rows are the home screen's own list,
 *  newest first with each pack's age in its own words, so the packs read here
 *  exactly as they read there. None is the gate's own
 *  "no pack" screen, so that state has one set of words, not two. A rehearsal
 *  already running is where Rehearse goes, before any question. */
export default function Choose({ loadPacks = listCompletePacks }: { loadPacks?: () => Promise<Pack[]> }) {
  const navigate = useNavigate();
  const run = useRehearsalRun();
  const [packs, setPacks] = useState<Pack[] | null>(null);

  useEffect(() => {
    let live = true;
    loadPacks().then(
      (rows) => {
        if (live) setPacks(rows);
      },
      () => {
        if (live) setPacks([]);
      },
    );
    return () => {
      live = false;
    };
  }, [loadPacks]);

  if (run) return <Navigate to={`/rehearse/${run.packId}`} replace />;
  if (packs === null) return null;
  if (packs.length === 0) return <RehearsalEntry packId="" />;
  if (packs.length === 1) return <Navigate to={`/rehearse/${packs[0].id}`} replace />;

  return (
    <main className="page rehearsal-condition">
      <Head />
      <h2>{copy.CHOOSE_PACK_TO_REHEARSE}</h2>
      <p>{copy.CHOOSE_PACK_TO_REHEARSE_DETAIL}</p>

      <ul className="list condition-list">
        {homeView(Date.now(), packs).packs.map(({ pack, ageLine }) => (
          <li key={pack.id}>
            <button
              type="button"
              className="candidate-action condition-action"
              onClick={() => navigate(`/rehearse/${pack.id}`)}
            >
              <span className="condition-label">{pack.name}</span>
              <span className="condition-detail">{pack.address}</span>
              <span className="condition-detail">{ageLine}</span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
