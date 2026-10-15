import { useEffect, useId, useState } from 'react';
import { useLocation } from 'react-router';
import * as copy from '../../core/copy';
import GlassSpot from './GlassSpot';
import Glyph from './Glyph';
import { TOUR_EVENT } from './Tour';

const TARGETS = ['.tour-ring'];

/** For a new person who went straight into BlackSky from the welcome: once
 *  BlackSky is left, the tour's ring is spotlit as the tour does it, with a
 *  box offering the tour. The ring starts it; the cross closes the offer. */
export default function TourOffer({ onDone }: { onDone: () => void }) {
  const { pathname } = useLocation();
  const [left, setLeft] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (pathname.startsWith('/blacksky')) setLeft(false);
    else setLeft((was) => was || pathname === '/');
  }, [pathname]);

  // Starting the tour from the ring ends the offer.
  useEffect(() => {
    window.addEventListener(TOUR_EVENT, onDone);
    return () => window.removeEventListener(TOUR_EVENT, onDone);
  }, [onDone]);

  if (!left || pathname !== '/') return null;
  return (
    <GlassSpot targets={TARGETS} labelledBy={titleId} className="card tour-offer" shade>
      <button type="button" className="glass-spot-close" aria-label={copy.CLOSE} onClick={onDone}>
        <Glyph kind="close" line />
      </button>
      <h2 id={titleId}>{copy.TOUR_OFFER_TITLE}</h2>
      <p className="muted">{copy.TOUR_OFFER_LINE}</p>
    </GlassSpot>
  );
}
