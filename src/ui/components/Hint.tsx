import { useId, useState, type ReactNode } from 'react';
import InfoGlyph from './InfoGlyph';
import { useRevealedPanel } from './useRevealedPanel';

type HintProps = {
  /** The ring's accessible name, and the kicker over the panel. */
  label: string;
  /** What sits beside the ring: a label or a control. */
  head?: ReactNode;
  /** The detail the ring opens. */
  children: ReactNode;
  className?: string;
  ringClass?: string;
  panelClass?: string;
  /** False leaves the label off the open panel, where the content needs no title. */
  titled?: boolean;
  /** True shows the label as a text toggle in place of the ring. */
  asText?: boolean;
};

/** The one information ring. A screen shows its short line, and the detail
 *  behind it opens beneath on a tap and closes on a second one. Never on hover,
 *  so a passing pointer opens nothing. The panel opens in flow, covering
 *  nothing, and is brought into view and focused as it opens. */
export default function Hint({ label, head, children, className = 'hint', ringClass, panelClass = 'card', titled = true, asText = false }: HintProps) {
  const [open, setOpen] = useState(false);
  const panel = useRevealedPanel<HTMLElement>(open);
  const id = useId();
  return (
    <div className={className}>
      <button
        type="button"
        className={asText ? 'hint-text' : ringClass ? `info-ring ${ringClass}` : 'info-ring'}
        aria-label={asText ? undefined : label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        {asText ? label : <InfoGlyph />}
      </button>
      {head}
      {open ? (
        <section id={id} ref={panel} tabIndex={-1} className={`${panelClass} hint-panel info-panel`}>
          {titled ? <span className="kicker">{label}</span> : null}
          {children}
        </section>
      ) : null}
    </div>
  );
}
