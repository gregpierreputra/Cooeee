import { NAV_HOLD_HINT_MS } from "../core/constants";
import * as copy from "../core/copy";
import Glyph from "./components/Glyph";
import { Compass } from "./components/BottomNav";
import HoldButton from "./components/HoldButton";
import Mark from "./components/Mark";

/** The first screen a new person sees, before the disclosure: why the app is
 *  worth having, in three drawings and as few words as will carry them. It
 *  stands before the router like the disclosure and stores nothing. Its main
 *  control leads on to the disclosure, nothing is agreed to here, and a hold
 *  opens BlackSky for someone who cannot wait. */
export default function Welcome({
  onContinue,
  onWayOut,
}: {
  onContinue: () => void;
  onWayOut: () => void;
}) {
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
        <button
          type="button"
          className="action main-action"
          onClick={onContinue}
        >
          {copy.SEE_HOW_IT_WORKS}
        </button>
        {/* For someone with a fire close on their first visit: BlackSky on the
            same two second hold as everywhere else, before anything is read. */}
        {/* Drawn as the tab bar's BlackSky compass, the door it opens: the
            ring sweeps round the compass for the two seconds of the hold. */}
        <div className="way-out-slot">
          <HoldButton
            className="way-out"
            hint={copy.HOLD_TO_ENTER}
            hintMs={NAV_HOLD_HINT_MS}
            onHold={onWayOut}
          >
            <span className="way-out-compass">
              <Compass />
            </span>
            <span className="way-out-text">
              <span className="way-out-title">{copy.WAY_OUT_BUTTON}</span>
              <span className="way-out-sub">{copy.WAY_OUT_SUB}</span>
            </span>
          </HoldButton>
        </div>
      </div>
    </main>
  );
}
