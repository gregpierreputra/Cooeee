import type { ReactNode } from 'react';

/** The shared shell for a transient flow state: kicker label, one polite
 *  status card, optional actions. Every waiting/failed/result screen in the
 *  pack-build flow renders through this, so the announcement markup
 *  (role="status", aria-live="polite") can never drift between screens. */
export default function StatusPage({
  page,
  kicker,
  cardClass,
  card,
  actions,
}: {
  page: string;
  kicker: string;
  cardClass?: string;
  card: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <main className={`page ${page}`}>
      <span className="kicker">{kicker}</span>
      <div className={cardClass ? `card ${cardClass}` : 'card'} role="status" aria-live="polite">
        {card}
      </div>
      {actions ? <div className="actions">{actions}</div> : null}
    </main>
  );
}
