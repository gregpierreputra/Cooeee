import type { ReactNode } from 'react';
import BackHomeLink from './BackHomeLink';

/** The shared shell for a transient flow state: kicker label, one polite
 *  status card, optional actions. Every waiting/failed/result screen in the
 *  pack-build flow renders through this, so the announcement markup
 *  (role="status", aria-live="polite") can never drift between screens.
 *  A screen inside a tab sets `backHome` to false: the tab bar is its way out. */
export default function StatusPage({
  page,
  kicker,
  cardClass,
  card,
  actions,
  backHome = true,
}: {
  page: string;
  kicker: ReactNode;
  cardClass?: string;
  card: ReactNode;
  actions?: ReactNode;
  backHome?: boolean;
}) {
  return (
    <main className={`page ${page}`}>
      {typeof kicker === 'string' ? <span className="kicker">{kicker}</span> : kicker}
      <div className={cardClass ? `card ${cardClass}` : 'card'} role="status" aria-live="polite">
        {card}
      </div>
      <div className="actions">
        {actions}
        {backHome ? <BackHomeLink /> : null}
      </div>
    </main>
  );
}
