import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import * as copy from '../core/copy';
import { freshness } from '../core/pack';
import type { Pack } from '../core/types';
import { deleteCompletePack, listCompletePacks } from '../data/db';
import HoldButton from './components/HoldButton';
import StateCard from './components/StateCard';

export default function Home() {
  // null = the store has not answered yet. 
  // It answers in a frame or two from local IndexedDB, and 
  // a spinner would be a promise about a wait that isn't happening, so nothing is drawn for it.
  const [packs, setPacks] = useState<Pack[] | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let live = true;
    listCompletePacks().then((rows) => {
      if (live) setPacks(rows);
    });
    return () => {
      live = false;
    };
  }, []);

  // Deleting a pack takes two taps: the × swaps the card for a question, and
  // only the ✓ destroys data. The ✗ restores the card untouched.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirmingId) cancelRef.current?.focus();
  }, [confirmingId]);

  const removePack = async (id: string) => {
    await deleteCompletePack(id);
    setPacks(await listCompletePacks());
    setConfirmingId(null);
  };

  const now = Date.now();

  return (
    <main className="page">
      <header className="hero">
        <span className="kicker">{copy.APP_NAME}</span>
        <h1>{copy.HOME_TITLE}</h1>
      </header>

      {packs === null ? null : packs.length === 0 ? (
        <StateCard heading={copy.NO_PACKS_YET} detail={copy.NO_PACKS_HINT} />
      ) : (
        // Stored order. The packs are equals: nothing here ranks them, and the
        // first entry gets no visual weight.
        <ul className="list">
          {packs.map((p) => (
            <li key={p.id} className={confirmingId === p.id ? 'card' : 'card pack-card'}>
              {confirmingId === p.id ? (
                <>
                  <p>{copy.DELETE_PACK_QUESTION}</p>
                  <div className="card-confirm-actions">
                    <button
                      ref={cancelRef}
                      type="button"
                      className="card-confirm-no"
                      aria-label={copy.KEEP_THIS_PACK}
                      onClick={() => setConfirmingId(null)}
                    >
                      ✗
                    </button>
                    <button
                      type="button"
                      className="card-confirm-yes"
                      aria-label={copy.CONFIRM_DELETE_PACK}
                      onClick={() => void removePack(p.id)}
                    >
                      ✓
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="card-title-row">
                    <h2><Link to={`/packs/${p.id}`}>{p.name}</Link></h2>
                    <button
                      type="button"
                      className="card-delete"
                      aria-label={copy.DELETE_PACK}
                      onClick={() => setConfirmingId(p.id)}
                    >
                      ×
                    </button>
                  </div>
                  <p className="muted">{p.address}</p>
                  <p className="muted figure">{freshness(now, p.verifiedAt).label}</p>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="actions">
        <Link className="action main-action" to="/packs/new">
          {copy.BUILD_A_PACK}
        </Link>
        <HoldButton onHold={() => navigate('/blacksky')} hint={copy.HOLD_TO_ENTER}>
          {copy.HOLD_FOR_BLACKSKY}
        </HoldButton>
      </div>
    </main>
  );
}