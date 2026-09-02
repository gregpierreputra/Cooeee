import { useState } from 'react';
import * as copy from '../../core/copy';
import { useOnline } from './useOnline';

/** The connection notice, pinned above everything at the top of the page.
 *  Green when the browser reports a network connection, red when it reports
 *  none — reported state only, never a probe: this component makes no network
 *  request. Dismissing it leaves a thin always-visible full-width strip in the
 *  same colour, which reopens the bar. That strip has no words on screen, so its
 *  whole meaning lives in its accessible name — the one honest statement this
 *  app can make about a connection, since it cannot detect phone signal. */
export default function NoticeBar() {
  const online = useOnline();
  const [open, setOpen] = useState(true);

  const tone = online ? 'notice-online' : 'notice-offline';
  const line = online ? copy.ONLINE_NOTICE : copy.OFFLINE_NOTICE;

  if (!open) {
    return (
      <button
        type="button"
        className={`notice-sliver ${tone}`}
        onClick={() => setOpen(true)}
        aria-label={online ? copy.CONNECTION_ONLINE_LABEL : copy.CONNECTION_OFFLINE_LABEL}
      />
    );
  }

  return (
    <div className={`notice-bar ${tone}`} role="status">
      <span>{line}</span>
      <button type="button" onClick={() => setOpen(false)} aria-label={copy.DISMISS_NOTICE}>
        ×
      </button>
    </div>
  );
}
