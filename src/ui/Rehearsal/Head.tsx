import * as copy from '../../core/copy';
import TabLabel from '../components/TabLabel';

/** The Rehearse tab's label, set as Recover and Nearby open: the tab's name in
 *  teal capitals with its bar drawing, then the screen's large title where it has one. One
 *  component, so every rehearsal screen opens the same way. */
export default function Head({ title }: { title?: string }) {
  return (
    <header className="hero">
      <TabLabel tab="rehearse" text={copy.NAV_REHEARSE} />
      {title ? <h1>{title}</h1> : null}
    </header>
  );
}
