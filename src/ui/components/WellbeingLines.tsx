import * as copy from '../../core/copy';
import CallCard from './CallCard';

/** R3: the free wellbeing lines, as call cards, in Who to call and on every pack page. */
export default function WellbeingLines() {
  return (
    <ul className="list">
      {copy.WELLBEING_LINES.map((line) => (
        <CallCard key={line.number} name={line.name} detail={line.detail} number={line.number} />
      ))}
    </ul>
  );
}
