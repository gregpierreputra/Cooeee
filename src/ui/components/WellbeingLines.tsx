import * as copy from '../../core/copy';
import Glyph from './Glyph';

/** R3: the wellbeing lines as tap-to-call cards, the same on Recover's Who to
 *  call and on every pack page. */
export default function WellbeingLines() {
  return (
    <ul className="list">
      {copy.WELLBEING_LINES.map((line) => (
        <li key={line.number} className="card">
          <h3>{line.name}</h3>
          <p className="muted">{line.detail}</p>
          <a className="with-glyph call-link" href={`tel:${line.number.replaceAll(' ', '')}`}>
            <Glyph kind="calls" line />
            {copy.CALL_LINE(line.number)}
          </a>
        </li>
      ))}
    </ul>
  );
}
