import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { REGISTER_FIND_REUNITE_URL } from '../core/constants';
import * as copy from '../core/copy';
import { clearDone, readDone, toggleDone } from '../core/roadmap-done';
import { localFlagStore } from '../data/acknowledgement';
import CountRing from './components/CountRing';
import Glyph from './components/Glyph';
import { focusMain } from './components/focusMain';

/** Where a step's link goes, and what it says. */
function StepLink({ link }: { link: copy.RoadmapLink }) {
  if (link === 'redcross') {
    return (
      <a className="with-glyph roadmap-link" href={REGISTER_FIND_REUNITE_URL} target="_blank" rel="noopener noreferrer">
        <Glyph kind="web" line />
        {copy.ROADMAP_REDCROSS}
      </a>
    );
  }
  const [to, label] =
    link === 'nearby' ? ['/nearby', copy.ROADMAP_NEARBY]
    : link === 'calls' ? ['/recover?need=calls', copy.WHO_TO_CALL]
    : [`/recover?need=${link}`, copy.NEED_PHRASE[link]];
  return (
    <Link className="with-glyph roadmap-link" to={to}>
      <Glyph kind={link === 'nearby' ? 'place' : link} line />
      {label}
    </Link>
  );
}

/** R1: what usually comes first after a fire, in three stages. Each step can
 *  be ticked done; the ticks stay on this phone only, and each stage's ring
 *  fills as its steps are done. Bundled with the app, so it opens with no
 *  signal and no pack. */
export default function Roadmap() {
  const [done, setDone] = useState(() => readDone(localFlagStore()));
  const toggle = (id: string) => setDone((current) => toggleDone(localFlagStore(), current, id));

  // Clear progress asks once first, as Clear all does on the saved programs.
  // Focus goes to the choice that changes nothing, and back to Clear progress
  // if the person keeps their ticks.
  const [asking, setAsking] = useState(false);
  const keepRef = useRef<HTMLButtonElement>(null);
  const clearRef = useRef<HTMLButtonElement>(null);
  const asked = useRef(false);
  useEffect(() => {
    if (asking) {
      asked.current = true;
      keepRef.current?.focus();
    } else if (asked.current) {
      asked.current = false;
      clearRef.current?.focus();
    }
  }, [asking]);
  const clearAll = () => {
    clearDone(localFlagStore());
    setDone([]);
    asked.current = false;
    setAsking(false);
    focusMain();
  };

  return (
    <main className="page recover roadmap">
      <header className="hero">
        <span className="kicker">{copy.NAV_RECOVER}</span>
        <h1>{copy.ROADMAP_TITLE}</h1>
        <p className="muted">{copy.ROADMAP_LINE}</p>
      </header>
      {asking ? (
        <section className="card" aria-labelledby="roadmap-clear-question">
          <p id="roadmap-clear-question">{copy.ROADMAP_CLEAR_QUESTION}</p>
          <div className="card-confirm-actions">
            <button ref={keepRef} type="button" className="card-confirm-no" onClick={() => setAsking(false)}>
              {copy.KEEP_KEPT}
            </button>
            <button type="button" className="card-confirm-yes with-glyph" onClick={clearAll}>
              <Glyph kind="trash" line />
              {copy.ROADMAP_CLEAR}
            </button>
          </div>
        </section>
      ) : (
        <button
          ref={clearRef}
          type="button"
          className="clear-kept with-glyph"
          disabled={done.length === 0}
          onClick={() => setAsking(true)}
        >
          <Glyph kind="trash" line />
          {copy.ROADMAP_CLEAR}
        </button>
      )}
      {copy.ROADMAP_STAGES.map((stage) => {
        const count = stage.steps.filter((step) => done.includes(step.id)).length;
        return (
          <section key={stage.id} className="roadmap-stage" aria-labelledby={`stage-${stage.id}`}>
            <div className="roadmap-stage-head">
              <h2 id={`stage-${stage.id}`}>{stage.title}</h2>
              <CountRing count={count} total={stage.steps.length} label={copy.ROADMAP_DONE_COUNT(count, stage.steps.length)} />
            </div>
            <ul className="list">
              {stage.steps.map((step) => {
                const isDone = done.includes(step.id);
                return (
                  <li key={step.id} className={isDone ? 'card roadmap-step done' : 'card roadmap-step'}>
                    <button
                      type="button"
                      className="roadmap-tick"
                      aria-pressed={isDone}
                      aria-label={copy.ROADMAP_MARK(step.text)}
                      onClick={() => toggle(step.id)}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
                        <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <div className="roadmap-step-body">
                      <p>{step.text}</p>
                      {step.link ? <StepLink link={step.link} /> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <p className="muted roadmap-source">{copy.ROADMAP_SOURCE}</p>
    </main>
  );
}
