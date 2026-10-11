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
import type { Pack } from '../../core/types';
import { listCompletePacks, listRehearsalsForPack } from '../../data/db';
import { useRehearsalRun } from './run-state';

/** E5-US3-AC2 — the bar's Rehearse: the same screen whatever is saved.
 *
 *  Your packs first, as rehearsing a place is what the tab is for, listed as
 *  the home screen's own cards, newest first, each with when it was last
 *  rehearsed. Nothing is chosen for the user. The quick games follow. With no
 *  pack, the dashed space the packs will fill comes first, as on Home, and the
 *  games that need no pack follow it. A rehearsal already
 *  running is where Rehearse goes, before anything else. */
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
  const rows = homeView(clock, packs).packs;

  return (
    <main className="page rehearsal-condition">
      <Head title={copy.REHEARSE_TITLE} />
      <h2 className="kicker section-label packs-title">
        {copy.YOUR_PACKS}
        {rows.length > 0 ? <span className="packs-count">{rows.length}</span> : null}
      </h2>

      {/* No pack: the dashed space the packs will fill, as on Home, and the
          way to build one. The games that need no pack still follow. */}
      {rows.length === 0 ? (
        <>
          <section className="empty-state" role="status">
            <Glyph kind="rehearse" />
            <h3>{copy.NO_PACK_TO_REHEARSE}</h3>
            <p className="muted">{copy.NO_PACK_TO_REHEARSE_DETAIL}</p>
          </section>
          <Link className="action main-action with-glyph" to="/packs/new">
            <Glyph kind="plus" line />
            {copy.BUILD_A_PACK}
          </Link>
        </>
      ) : null}

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

      <GameTiles onDrill={rows.length > 0 ? () => navigate('/rehearse/drill') : undefined} />
    </main>
  );
}
