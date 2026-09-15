import { useEffect, useRef } from 'react';

const COUNT = 60;
const LINK_PX = 110;
const ACCENT = '45, 212, 191'; // the accent teal, as rgb channels

type Mote = { x: number; y: number; r: number; drift: number; sway: number; phase: number };

const mote = (w: number, h: number): Mote => ({
  x: Math.random() * w,
  y: Math.random() * h,
  r: 1 + Math.random() * 1.5,
  drift: 6 + Math.random() * 10, // px per second, upward
  sway: 6 + Math.random() * 10, // px of side to side
  phase: Math.random() * Math.PI * 2,
});

/** The call carrying: motes rising slowly like embers, hairlines forming and
 *  dissolving between the ones that pass close. Drawn behind the welcome and
 *  the disclosure at a low alpha, so the words stay the thing on the screen.
 *  Decorative and inert: no pointer, no storage, no request. Stops while the
 *  tab is hidden, and under reduced motion draws one still frame. */
export default function Particles() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let motes: Mote[] = [];
    let frame = 0;
    let last = 0;

    const size = () => {
      const scale = devicePixelRatio || 1;
      canvas.width = innerWidth * scale;
      canvas.height = innerHeight * scale;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      motes = Array.from({ length: COUNT }, () => mote(innerWidth, innerHeight));
    };

    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const w = innerWidth;
      const h = innerHeight;
      ctx.clearRect(0, 0, w, h);
      for (const m of motes) {
        m.y -= m.drift * dt;
        if (m.y < -4) m.y = h + 4;
        m.phase += dt * 0.6;
        const x = m.x + Math.sin(m.phase) * m.sway;
        ctx.fillStyle = `rgba(${ACCENT}, 0.35)`;
        ctx.beginPath();
        ctx.arc(x, m.y, m.r, 0, Math.PI * 2);
        ctx.fill();
      }
      // ponytail: O(n²) link pass, fine at 60 motes; bucket by grid if the count grows.
      ctx.lineWidth = 1;
      for (let i = 0; i < motes.length; i += 1) {
        for (let j = i + 1; j < motes.length; j += 1) {
          const a = motes[i];
          const b = motes[j];
          const dx = a.x + Math.sin(a.phase) * a.sway - (b.x + Math.sin(b.phase) * b.sway);
          const dy = a.y - b.y;
          const d = Math.hypot(dx, dy);
          if (d > LINK_PX) continue;
          ctx.strokeStyle = `rgba(${ACCENT}, ${0.08 * (1 - d / LINK_PX)})`;
          ctx.beginPath();
          ctx.moveTo(a.x + Math.sin(a.phase) * a.sway, a.y);
          ctx.lineTo(b.x + Math.sin(b.phase) * b.sway, b.y);
          ctx.stroke();
        }
      }
      if (!still) frame = requestAnimationFrame(draw);
    };

    const start = () => {
      last = performance.now();
      frame = requestAnimationFrame(draw);
    };
    const onVisibility = () => {
      cancelAnimationFrame(frame);
      if (!document.hidden) start();
    };

    size();
    start();
    addEventListener('resize', size);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener('resize', size);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas ref={ref} className="particles" aria-hidden="true" />;
}
