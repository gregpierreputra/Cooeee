import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import * as copy from '../../core/copy';
import { homeView, shownPackName, titleCase } from '../../core/home';
import { packIcon } from '../../core/pack';
import { ageLabel } from '../../core/provenance';
import Glyph from '../components/Glyph';
import { useMinuteClock } from '../components/useMinuteClock';
import Head from './Head';
import GameTiles from '../Games/GameTiles';
import { replayDrill } from '../Drill/drill-state';
import type { Pack } from '../../core/types';
import { listCompletePacks, listRehearsalsForPack } from '../../data/db';
import RehearsalEntry from './Entry';
import { useRehearsalRun } from './run-state';

/** E5-US3-AC2 — the bar's Rehearse, before a pack is known.
 *
 *  One saved pack needs no question and goes straight to its gate. Several are
 *  listed under Your packs as the home screen's own cards, newest first with
 *  each pack's age in its own words, so the packs read here exactly as they
 *  read there, and nothing is chosen for the user. Each card adds when that
 *  pack was last rehearsed. None is the gate's own
 *  "no pack" screen, so that state has one set of words, not two. A rehearsal
 *  already running is where Rehearse goes, before any question. */
/** When a pack was last rehearsed, or null. A store that cannot be read
 *  reads as never rehearsed. */
const lastRehearsed = (packId: string): Promise<number | null> =>
  listRehearsalsForPack(packId).then((rows) => rows.at(-1)?.finishedAt ?? null, () => null);

export default function Choose({ loadPacks = listCompletePacks }: { loadPacks?: () => Promise<Pack[]> }) {
  const navigate = useNavigate();
  const run = useRehearsalRun();
  const [packs, setPacks] = useState<Pack[] | null>(null);
  const [rehearsed, setRehearsed] = useState<Map<string, number | null>>(new Map());
  const clock = useMinuteClock();

  useEffect(() => {
    let live = true;
    loadPacks().then(
      async (rows) => {
        const times = await Promise.all(rows.map((pack) => lastRehearsed(pack.id)));
        if (!live) return;
        setRehearsed(new Map(rows.map((pack, i) => [pack.id, times[i]])));
        setPacks(rows);
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
      <Head title={copy.REHEARSE_TITLE} />
      <GameTiles onDrill={playDrill} />
      <h2 className="kicker section-label packs-title">
        {copy.YOUR_PACKS}
        <span className="packs-count">{rows.length}</span>
      </h2>
      <p className="muted">{copy.CHOOSE_PACK_LINE}</p>

      {/* Home's own pack card, its name a link stretched over the card. */}
      <ul className="list pack-choice-list">
        {rows.map(({ pack, ageLine }) => {
          const at = rehearsed.get(pack.id) ?? null;
          return (
            <li key={pack.id}>
              <section className="card pack-card saved-place">
                <div className="saved-place-title">
                  <Glyph kind={packIcon(pack)} />
                  <h2 className="pack-name">
                    <Link to={`/rehearse/${pack.id}`}>{shownPackName(pack.name)}</Link>
                  </h2>
                </div>
                <p className="muted">{titleCase(pack.address)}</p>
                {/* The person's own result, so a pill as on the game cards:
                    teal with a tick once rehearsed, plain grey before. */}
                {at === null ? (
                  <p className="rehearsed-pill">{copy.NOT_REHEARSED_CARD}</p>
                ) : (
                  <p className="rehearsed-pill done with-glyph">
                    <Glyph kind="check" line />
                    {copy.REHEARSED_AGO(ageLabel(clock - at))}
                  </p>
                )}
                <p className="muted figure saved-place-footer with-glyph">
                  <Glyph kind="saved" line />
                  {ageLine}
                  <svg className="card-chevron" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
                    <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </p>
              </section>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
