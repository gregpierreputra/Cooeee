import * as copy from '../../core/copy';
import type { SourceLine } from '../../core/types';
import Hint from './Hint';

/** Where a screen's information comes from, behind the information ring.
 *  Closed by default: the names and readings are for whoever wants them. The
 *  one way any screen shows its data sources, so they all read the same. */
export default function DataSources({ lines }: { lines: SourceLine[] }) {
  return (
    <Hint
      className="hint data-sources"
      label={copy.ABOUT_DATA_SOURCES}
      head={<span className="kicker">{copy.DATA_SOURCES_LABEL}</span>}
    >
      <ul className="info-lines">
        {lines.map((line) => (
          <li key={line.lead}>
            <b>{line.lead}.</b> {line.text}
          </li>
        ))}
      </ul>
    </Hint>
  );
}
