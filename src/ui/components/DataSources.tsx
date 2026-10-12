import * as copy from '../../core/copy';
import type { SourceLine } from '../../core/types';
import Hint from './Hint';

/** Where a screen's information comes from, behind a Data sources toggle like
 *  Not for you? on Home. Closed by default: the names and readings are for
 *  whoever wants them. Each source is its name, then its status beneath with a
 *  dot in the status's colour, like the place cards' Cached and Live. */
export default function DataSources({ lines }: { lines: SourceLine[] }) {
  return (
    <Hint className="hint data-sources" label={copy.DATA_SOURCES_LABEL} asText titled={false}>
      <ul className="source-health">
        {lines.map((line) => (
          <li key={line.lead}>
            <span className="source-health-name">{line.lead}</span>
            <span className={`source-health-state source-${line.status}`}>
              <span className="state-dot" aria-hidden="true" />
              {line.text}
            </span>
          </li>
        ))}
      </ul>
    </Hint>
  );
}
