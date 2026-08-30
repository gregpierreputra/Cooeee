import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import * as copy from '../core/copy';
import { freshness } from '../core/pack';
import type { Pack } from '../core/types';
import { listCompletePacks } from '../data/db';
import StateCard from './components/StateCard';

export default function Home() {
  // null = the store has not answered yet. It answers in a frame or two from
  // local IndexedDB, and a spinner would be a promise about a wait that isn't
  // happening, so nothing is drawn for it.
  const [packs, setPacks] = useState<Pack[] | null>(null);

  useEffect(() => {
    let live = true;
    listCompletePacks().then((rows) => {
      if (live) setPacks(rows);
    });
    return () => {
      live = false;
    };
  }, []);

  const now = Date.now();

  return (
    <main className="page">
      <h1>{copy.HOME_TITLE}</h1>

      {packs === null ? null : packs.length === 0 ? (
        <StateCard heading={copy.NO_PACKS_YET} detail={copy.NO_PACKS_HINT} />
      ) : (
        // Stored order. The packs are equals: nothing here ranks them, and the
        // first entry gets no visual weight.
        <ul className="list">
          {packs.map((p) => (
            <li key={p.id} className="card">
              <h2>{p.name}</h2>
              <p className="muted">{p.address}</p>
              <p className="muted figure">{freshness(now, p.verifiedAt).label}</p>
            </li>
          ))}
        </ul>
      )}

      <div className="actions">
        <Link className="action main-action" to="/packs/new">
          {copy.BUILD_A_PACK}
        </Link>
      </div>
    </main>
  );
}
