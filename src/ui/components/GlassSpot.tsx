import { useEffect, useRef, useState, type ReactNode } from 'react';

type Ring = { left: number; top: number; width: number; height: number; borderRadius: string };

const PAD = 6; // px of room between a feature and its ring

/** A spotlight: a ring round each feature matched by `targets` and a box
 *  holding `children`. Clear by default: a glowing ring and a glass box, with
 *  nothing greyed and nothing blocked, so the whole screen stays in view and in
 *  reach. With `shade`, the tour's look: the screen greyed and closed to taps
 *  but for a hole at each feature, which still takes its tap. The rings follow
 *  their features every frame while shown, and take each feature's own
 *  corners. The box takes focus once, so a screen reader reads it out. */
export default function GlassSpot({
  targets,
  labelledBy,
  className,
  shade = false,
  children,
}: {
  targets: string[];
  labelledBy: string;
  className?: string;
  shade?: boolean;
  children: ReactNode;
}) {
  const [rings, setRings] = useState<Ring[]>([]);
  const box = useRef<HTMLElement>(null);

  useEffect(() => {
    box.current?.focus();
  }, []);

  useEffect(() => {
    let frame = 0;
    let last = '';
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const next = targets.flatMap((selector) => {
        const element = document.querySelector(selector);
        if (!element) return [];
        const rect = element.getBoundingClientRect();
        return [
          {
            left: rect.left - PAD,
            top: rect.top - PAD,
            width: rect.width + 2 * PAD,
            height: rect.height + 2 * PAD,
            // A drawing is ringed round, and a square cornered feature such as
            // a heading gets soft corners.
            borderRadius:
              element instanceof SVGElement ? '50%' : parseFloat(getComputedStyle(element).borderRadius) ? getComputedStyle(element).borderRadius : '12px',
          },
        ];
      });
      // Drawn only when something moved, so a still screen costs no renders.
      const key = JSON.stringify(next);
      if (key !== last) {
        last = key;
        setRings(next);
      }
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [targets]);

  return (
    <div className={shade ? 'glass-spot shaded' : 'glass-spot'}>
      {shade ? (
        <svg className="glass-spot-shade" aria-hidden="true">
          {/* The screen, less a hole for each ring: even-odd, so the holes take
              no tap and the feature under each one does. */}
          <path fillRule="evenodd" d={`M0 0H${innerWidth}V${innerHeight}H0Z${rings.map(hole).join('')}`} />
        </svg>
      ) : null}
      {rings.map((ring, index) => (
        <div key={index} className="glass-spot-ring" style={ring} />
      ))}
      <section
        ref={box}
        tabIndex={-1}
        role="dialog"
        aria-labelledby={labelledBy}
        className={className ? `glass-spot-box ${className}` : 'glass-spot-box'}
      >
        {children}
      </section>
    </div>
  );
}

/** A ring's box as a closed path, its corners rounded as the ring's are. */
function hole({ left, top, width, height, borderRadius }: Ring): string {
  const radius = borderRadius.endsWith('%') ? (parseFloat(borderRadius) / 100) * width : parseFloat(borderRadius) || 0;
  const r = Math.min(radius, width / 2, height / 2);
  const right = left + width;
  const bottom = top + height;
  return (
    `M${left + r} ${top}H${right - r}A${r} ${r} 0 0 1 ${right} ${top + r}V${bottom - r}` +
    `A${r} ${r} 0 0 1 ${right - r} ${bottom}H${left + r}A${r} ${r} 0 0 1 ${left} ${bottom - r}` +
    `V${top + r}A${r} ${r} 0 0 1 ${left + r} ${top}Z`
  );
}
