import { useEffect, useRef, useState, type ReactNode } from 'react';

type Ring = { left: number; top: number; width: number; height: number; borderRadius: string };

const PAD = 6; // px of room between a feature and its ring

/** A clear spotlight: a glowing ring round each feature matched by `targets`
 *  and a glass box holding `children`. Nothing is greyed and nothing is
 *  blocked, so the whole screen stays in view and in reach. The rings follow
 *  their features every frame while shown, and take each feature's own
 *  corners. The box takes focus once, so a screen reader reads it out. */
export default function GlassSpot({
  targets,
  labelledBy,
  className,
  children,
}: {
  targets: string[];
  labelledBy: string;
  className?: string;
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
            borderRadius: getComputedStyle(element).borderRadius,
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
    <div className="glass-spot">
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
