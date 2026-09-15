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
        <Mark className="mark" size={44} />
        <h1>{copy.APP_NAME}</h1>
        <p className="muted welcome-tagline">{copy.APP_TAGLINE}</p>
      </header>

      <ul className="list welcome-steps">
        {copy.WELCOME_STEPS.map((step) => (
          <li key={step.kicker} className="card welcome-step">
            <Glyph kind={step.glyph} />
            <span className="kicker">{step.kicker}</span>
            <p>{step.line}</p>
          </li>
        ))}
      </ul>

      <ul className="list welcome-facts">
        {copy.WELCOME_FACTS.map((fact) => (
          <li key={fact.line} className="welcome-fact">
            <Glyph kind={fact.glyph} />
            <span>{fact.line}</span>
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
