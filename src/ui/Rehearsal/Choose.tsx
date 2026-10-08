import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import * as copy from '../../core/copy';
import { homeView, shownPackName, titleCase } from '../../core/home';
import { packIcon } from '../../core/pack';
import Glyph from '../components/Glyph';
import { useMinuteClock } from '../components/useMinuteClock';
import Head from './Head';
import DrillTile from '../Drill/DrillTile';
import { replayDrill } from '../Drill/drill-state';
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
  const clock = useMinuteClock();

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

  const rows = homeView(clock, packs).packs;
  // The drill is played in the newest pack's home, the one most likely lived in.
  const playDrill = () => {
    replayDrill(rows[0].pack.id);
    navigate(`/rehearse/${rows[0].pack.id}`);
  };

  return (
    <main className="page rehearsal-condition">
      <Head />
      <DrillTile onPlay={playDrill} />
      <h2>{copy.CHOOSE_PACK_TO_REHEARSE}</h2>
      <p>{copy.CHOOSE_PACK_TO_REHEARSE_DETAIL}</p>

      <ul className="list condition-list">
        {rows.map(({ pack, ageLine }) => (
          <li key={pack.id}>
            <button
              type="button"
              className="candidate-action condition-action pack-choice"
              onClick={() => navigate(`/rehearse/${pack.id}`)}
            >
              <Glyph kind={packIcon(pack)} />
              <span className="pack-choice-text">
                <span className="condition-label pack-name">{shownPackName(pack.name)}</span>
                <span className="condition-detail">{titleCase(pack.address)}</span>
                {/* The same downloaded sign as the pack card on Home. */}
                <span className="condition-detail pack-choice-age with-glyph">
                  <Glyph kind="saved" line />
                  {ageLine}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
