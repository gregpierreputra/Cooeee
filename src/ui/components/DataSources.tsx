import { useState } from 'react';
import * as copy from '../../core/copy';
import type { SourceLine } from '../../core/types';
import InfoGlyph from './InfoGlyph';
import { useRevealedPanel } from './useRevealedPanel';

/** Where a screen's information comes from, behind an information ring. Closed
 *  by default: the names and readings are for whoever wants them, not a
 *  footer everyone scrolls past. Opens on a tap, never on hover, and says in
 *  plain words what each list is and when it was last checked. The one way any
 *  screen shows its data sources, so they all read the same. */
export default function DataSources({ lines }: { lines: SourceLine[] }) {
  const [open, setOpen] = useState(false);
  const panel = useRevealedPanel<HTMLDivElement>(open);
  return (
    <section className="data-sources">
      <div className="data-sources-head">
        <button
          type="button"
          className="info-ring"
          aria-label={copy.ABOUT_DATA_SOURCES}
          aria-expanded={open}
          aria-controls="data-sources-panel"
          onClick={() => setOpen((v) => !v)}
        >
          <InfoGlyph />
        </button>
        <span className="kicker">{copy.DATA_SOURCES_LABEL}</span>
      </div>
      {open ? (
        <div id="data-sources-panel" ref={panel} tabIndex={-1} className="card info-panel">
          <p>{copy.DATA_SOURCES_PLAIN}</p>
          <ul className="info-lines">
            {lines.map((line) => (
              <li key={line.lead}>
                <b>{line.lead}.</b> {line.text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
