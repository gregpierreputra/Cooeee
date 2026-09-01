import { useEffect, useState } from 'react';
import * as copy from '../../core/copy';

/** The connection notice, pinned above everything at the top of the page.
 *  Green when the browser reports a network connection, red when it reports
 *  none — reported state only, never a probe: this component makes no network
 *  request. Dismissing it leaves a thin always-visible full-width strip in the
 *  same colour, which reopens the bar. */
export default function NoticeBar() {
  const [online, setOnline] = useState(navigator.onLine);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  const tone = online ? 'notice-online' : 'notice-offline';
  const line = online ? copy.ONLINE_NOTICE : copy.OFFLINE_NOTICE;

  if (!open) {
    return (
      <button
        type="button"
        className={`notice-sliver ${tone}`}
        onClick={() => setOpen(true)}
        aria-label={line}
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
