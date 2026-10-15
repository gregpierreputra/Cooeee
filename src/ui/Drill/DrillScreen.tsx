import { useLocation, useNavigate } from 'react-router';
import { drillHome } from '../../core/back';
import Drill from './Drill';

/** The drill's own page, opened from its card on Rehearse, like the other
 *  quick games, or from a pack's Practice tab. It is the same game whatever is
 *  saved, so it needs no pack; Done goes back where it was opened from. */
export default function DrillScreen() {
  const navigate = useNavigate();
  const { search } = useLocation();
  return <Drill onDone={() => navigate(drillHome(search))} />;
}
