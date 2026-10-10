import { createContext, useContext } from 'react';
import * as copy from '../../core/copy';
import Glyph from '../components/Glyph';

/** Goes back to a step already done, by its place in the bar, or null while
 *  the builder cannot step back (a check or the save is running, or the pack
 *  is saved). The builder provides it, so every screen's bar can use it. */
export const FlowStepBack = createContext<((index: number) => void) | null>(null);

/** Where the person is in building a pack: one glyph per step with its name
 *  beneath, the steps done filled, the current one marked. A picture of the
 *  whole journey, so how far there is to go is seen rather than read. A step
 *  already done is a button back to it; the steps ahead are not. */
export default function FlowSteps({ at }: { at: number }) {
  const goBack = useContext(FlowStepBack);
  return (
    <nav className="flow-steps" aria-label={copy.FLOW_STEPS_LABEL}>
      <ol>
        {copy.FLOW_STEPS.map((step, index) => {
          const face = (
            <>
              <Glyph kind={step.glyph} size={18} />
              <span className="flow-step-label">{step.label}</span>
            </>
          );
          return (
            <li key={step.label} className={index < at ? 'done' : index === at ? 'now' : undefined} aria-current={index === at ? 'step' : undefined}>
              {index < at && goBack ? (
                <button type="button" className="flow-step" aria-label={copy.BACK_TO_STEP(step.label)} onClick={() => goBack(index)}>
                  {face}
                </button>
              ) : (
                <span className="flow-step">{face}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
