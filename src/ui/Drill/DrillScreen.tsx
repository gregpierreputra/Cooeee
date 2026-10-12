import { useNavigate } from 'react-router';
import Drill from './Drill';

/** The drill's own page, opened only from its card on Rehearse, like the other
 *  quick games. It is the same game whatever is saved, so it needs no pack. */
export default function DrillScreen() {
  const navigate = useNavigate();
  return <Drill onDone={() => navigate('/rehearse')} />;
}
