import * as copy from '../../core/copy';
import Glyph from '../components/Glyph';

/** Where the person is in building a pack: one glyph per step, the steps done
 *  filled, the current one named. A picture of the whole journey, so how far
 *  there is to go is seen rather than read. A screen reader hears one line. */
export default function FlowSteps({ at }: { at: number }) {
  const steps = copy.FLOW_STEPS;
  return (
    <div className="flow-steps">
      <span className="visually-hidden">{copy.FLOW_STEP_OF(at + 1, steps.length, steps[at].label)}</span>
      <ol aria-hidden="true">
        {steps.map((step, index) => (
          <li key={step.label} className={index < at ? 'done' : index === at ? 'now' : undefined}>
            <Glyph kind={step.glyph} size={18} />
          </li>
        ))}
      </ol>
      <span className="kicker" aria-hidden="true">{steps[at].label}</span>
    </div>
  );
}
