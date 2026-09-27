import { useEffect, useRef } from 'react';
import * as copy from '../../core/copy';
import Glyph from '../components/Glyph';

/** Between the minute and the report, after every drill, at the door or not:
 *  how far a grassfire can travel in the same minute. One figure, a flame
 *  crossing a 400 metre track, and the reason to prepare. The whole screen, as
 *  the minute was, so nothing else competes with it. */
export default function MinuteFact({ onContinue }: { onContinue: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
    document.body.classList.add('drill-open');
    return () => document.body.classList.remove('drill-open');
  }, []);

  return (
    <section className="minute-fact" aria-labelledby="minute-fact-figure">
      <h1 id="minute-fact-figure" ref={heading} tabIndex={-1} className="minute-fact-figure">
        <span aria-hidden="true">{copy.DRILL_MINUTE_FIGURE}</span>
        <span className="visually-hidden">{copy.DRILL_MINUTE_LINE}</span>
      </h1>
      {/* The flame runs the length of the track in the time it takes to read
          the figure. Still under reduced motion: it simply sits at the end. */}
      <div className="minute-fact-track" aria-hidden="true">
        <span className="minute-fact-flame">
          <Glyph kind="drill" size={28} line />
        </span>
      </div>
      <p className="minute-fact-line" aria-hidden="true">{copy.DRILL_MINUTE_LINE}</p>
      <p className="minute-fact-run">{copy.DRILL_MINUTE_RUN}</p>
      <p className="minute-fact-call">{copy.DRILL_MINUTE_CALL}</p>
      <button type="button" className="main-action" onClick={onContinue}>
        {copy.CONTINUE}
      </button>
      <p className="muted minute-fact-source">{copy.DRILL_MINUTE_SOURCE}</p>
    </section>
  );
}
