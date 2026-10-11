import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { newestPlaceFirst } from '../../core/home';
import type { Pack } from '../../core/types';
import { listCompletePacks } from '../../data/db';
import Drill from './Drill';

/** The drill's own page, opened only from its card on Rehearse, like the other
 *  quick games. It is kept with the newest pack, the place most likely lived
 *  in, so its scores sit on that pack's page. With no pack it goes back to
 *  Rehearse, which offers none. */
export default function DrillScreen() {
  const navigate = useNavigate();
  const [packs, setPacks] = useState<Pack[] | null>(null);

  useEffect(() => {
    let live = true;
    listCompletePacks().then(
      (rows) => live && setPacks(rows),
      () => live && setPacks([]),
    );
    return () => {
      live = false;
    };
  }, []);

  if (packs === null) return null;
  if (packs.length === 0) return <Navigate to="/rehearse" replace />;
  const newest = [...packs].sort(newestPlaceFirst)[0];
  return <Drill packId={newest.id} onDone={() => navigate('/rehearse')} />;
}
