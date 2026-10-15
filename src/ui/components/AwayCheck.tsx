import { useEffect, useId, useState } from 'react';
import { useLocation } from 'react-router';
import * as copy from '../../core/copy';
import { backAfterAWeek, recordVisit } from '../../core/visits';
import { localFlagStore } from '../../data/acknowledgement';
import GlassSpot from './GlassSpot';
import Glyph from './Glyph';

const TARGETS = ['.nav-blacksky'];

// Worked out once per page load and today recorded straight after, so a
// second render, or React's strict double call, never asks twice.
let away: boolean | null = null;
function awayOnce(): boolean {
  if (away === null) {
    const store = localFlagStore();
    away = backAfterAWeek(store, Date.now());
    recordVisit(store, Date.now());
  }
  return away;
}

/** For someone back after a week or more: on Home, a clear spotlight on the
 *  BlackSky compass asking whether they need a way out now, and how to open
 *  it. The words keep clear of the banned list (no danger, no directions). Gone with the cross, or once they leave Home. */
export default function AwayCheck() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(awayOnce);
  const titleId = useId();

  useEffect(() => {
    if (pathname !== '/') setOpen(false);
  }, [pathname]);

  if (!open || pathname !== '/') return null;
  return (
    <GlassSpot targets={TARGETS} labelledBy={titleId} className="away-check">
      <button type="button" className="glass-spot-close" aria-label={copy.CLOSE} onClick={() => setOpen(false)}>
        <Glyph kind="close" line />
      </button>
      <h2 id={titleId}>{copy.AWAY_CHECK_TITLE}</h2>
      <p className="muted">{copy.AWAY_CHECK_LINE}</p>
    </GlassSpot>
  );
}
