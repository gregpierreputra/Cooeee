import { Link } from 'react-router';
import * as copy from '../../core/copy';

/** The accent-filled escape to the pack list, offered wherever a flow could
 *  otherwise strand the user. The fill colour follows the screen's own mode
 *  accent, so it always reads as the primary way out. */
export default function BackHomeLink() {
  return (
    <Link className="action back-home" to="/">
      {copy.BACK_TO_HOME}
    </Link>
  );
}
