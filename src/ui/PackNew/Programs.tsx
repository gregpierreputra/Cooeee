import { useState } from 'react';

import * as copy from '../../core/copy';
import { monogram } from '../../core/recover';
import type { RecoveryProgram } from '../../core/types';

type ProgramsProps = {
  programs: RecoveryProgram[];
  kept: readonly string[];
  onContinue: (ids: string[]) => void;
  onSkip: () => void;
};

/** E4-US8: the programs step of the pack wizard, after the note. The kept
 *  programs start ticked; the ticks become the kept list and the pack carries
 *  them with their page copies. Not now changes nothing and builds on. */
export function Programs({ programs, kept, onContinue, onSkip }: ProgramsProps) {
  const [ticked, setTicked] = useState<string[]>(kept.filter((id) => programs.some((p) => p.id === id)));
  const toggle = (id: string) =>
    setTicked(ticked.includes(id) ? ticked.filter((t) => t !== id) : [...ticked, id]);

  return (
    <main className="page programs-page">
      <header className="hero">
        <span className="kicker">{copy.PROGRAMS_STEP_KICKER}</span>
        <h1>{copy.PROGRAMS_STEP_TITLE}</h1>
        <p className="muted">{copy.PROGRAMS_STEP_LINE}</p>
      </header>
      <ul className="list">
        {programs.map((program) => {
          const inputId = `program-${program.id}`;
          return (
            <li key={program.id} className={ticked.includes(program.id) ? 'card kept' : 'card'}>
              <div className="destination-item-head">
                <input
                  type="checkbox"
                  id={inputId}
                  checked={ticked.includes(program.id)}
                  onChange={() => toggle(program.id)}
                />
                <span className="monogram" aria-hidden="true">{monogram(program.org)}</span>
                <h2><label htmlFor={inputId}>{program.title}</label></h2>
              </div>
              <p className="muted">{program.org}</p>
            </li>
          );
        })}
      </ul>
      <div className="actions">
        <button className="main-action" type="button" onClick={() => onContinue(ticked)}>
          {copy.CARRY_PROGRAMS(ticked.length)}
        </button>
        <button type="button" onClick={onSkip}>{copy.CHOOSE_LATER}</button>
      </div>
    </main>
  );
}
