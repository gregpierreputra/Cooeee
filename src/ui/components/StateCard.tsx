import type { ReactNode } from 'react';

/** The one card treatment. Presence and absence use it identically, so an
 *  absence never renders as an error and never renders as reassurance. */
export default function StateCard({
  heading,
  detail,
  children,
}: {
  heading: string;
  detail?: string;
  children?: ReactNode;
}) {
  return (
    <section className="card">
      <h2>{heading}</h2>
      {detail ? <p className="muted">{detail}</p> : null}
      {children}
    </section>
  );
}
