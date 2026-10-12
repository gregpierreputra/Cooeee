import * as copy from '../core/copy';
import Glyph from './components/Glyph';
import Mark from './components/Mark';

/** The first screen a new person sees, before the disclosure: why the app is
 *  worth having, in three drawings and as few words as will carry them. It
 *  stands before the router like the disclosure, stores nothing, and its one
 *  control leads on to the disclosure — nothing is agreed to here. */
export default function Welcome({ onContinue }: { onContinue: () => void }) {
  return (
    <main className="page first-open welcome">
      <header className="hero first-open-hero">
        {/* The mark in its ring, as on the tour's welcome. */}
        <span className="first-open-mark">
          <Mark className="mark" size={40} />
        </span>
        <h1>{copy.APP_NAME}</h1>
        <p className="muted welcome-tagline">{copy.APP_TAGLINE}</p>
      </header>

      {/* Before, during and after as one card of three moments in order, their
          drawings joined by a line as the pack builder's steps are. */}
      <ol className="card welcome-steps">
        {copy.WELCOME_STEPS.map((step) => (
          <li key={step.kicker} className="welcome-step">
            <Glyph kind={step.glyph} />
            <span className="kicker">{step.kicker}</span>
            <p>{step.line}</p>
          </li>
        ))}
      </ol>

      {/* Two facts as footnotes: small line drawings, grey words, one row. */}
      <ul className="welcome-facts">
        {copy.WELCOME_FACTS.map((fact) => (
          <li key={fact.line} className="welcome-fact with-glyph">
            <Glyph kind={fact.glyph} line />
            {fact.line}
          </li>
        ))}
      </ul>

      <div className="actions">
        <button type="button" className="action main-action" onClick={onContinue}>
          {copy.SEE_HOW_IT_WORKS}
        </button>
      </div>
    </main>
  );
}
