import { useState, type ReactNode } from 'react';
import * as copy from '../../core/copy';

/** How many of a growing list show before the rest wait behind a toggle. */
const SHORT_LIST = 3;

/** A list that shows its first `limit` items, newest first as given, then
 *  one text toggle, set as About gaps is, for the rest. The first items are
 *  always in view, so a section never looks empty. Shared by the pack page's
 *  practice lists and Cooee Word's past words. */
export default function ShortList<T>({
  items,
  className,
  render,
  limit = SHORT_LIST,
}: {
  items: T[];
  className: string;
  render: (item: T) => ReactNode;
  limit?: number;
}) {
  const [all, setAll] = useState(false);
  const more = items.length - limit;
  return (
    <>
      <ul className={className}>{(all ? items : items.slice(0, limit)).map(render)}</ul>
      {more > 0 ? (
        <button type="button" className="hint-text more-toggle" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? copy.SHOW_FEWER : copy.SHOW_MORE(more)}
          {/* Points down to the items still to come, and up once they fold back
              up (see .more-toggle). */}
          <svg className="hint-chevron" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
            <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : null}
    </>
  );
}
