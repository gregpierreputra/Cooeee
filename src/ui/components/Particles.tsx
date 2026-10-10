import { useEffect, useRef } from 'react';

const COUNT = 60;
const LINK_PX = 110;
/** About 30 frames a second: smooth for motes this slow, at half the battery. */
const FRAME_MS = 33;
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
 *  dissolving between the ones that pass close. Drawn behind every screen but
 *  BlackSky at a low alpha, so the words stay the thing on the screen.
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
    // The size the canvas is drawn at, in CSS pixels.
    let w = 0;
    let h = 0;

    // On a phone the height changes as the address bar hides and shows, and as
    // the keyboard opens: each a resize. The canvas is as tall as the screen
    // at its tallest (100lvh in the stylesheet) and never shrinks, and the
    // motes are kept, so scrolling neither scatters them nor uncovers the page.
    // Only a new width, such as turning the phone, starts them afresh.
    const size = () => {
      const width = document.documentElement.clientWidth || innerWidth;
      const newWidth = width !== w;
      // A new width measures the screen afresh; otherwise the canvas keeps its
      // height in pixels, as a desktop window's 100lvh shrinks with the window.
      if (newWidth) canvas.style.height = '';
      const height = Math.max(newWidth ? canvas.clientHeight : h, innerHeight);
      if (!newWidth && height === h) return;
      w = width;
      h = height;
      canvas.style.height = `${h}px`;
      const scale = devicePixelRatio || 1;
      canvas.width = w * scale;
      canvas.height = h * scale;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      if (newWidth) motes = Array.from({ length: COUNT }, () => mote(w, h));
      // Resizing clears the canvas, and a still frame has no next frame to redraw it.
      if (still) draw(performance.now());
    };

    const draw = (now: number) => {
      if (!still && now - last < FRAME_MS) {
        frame = requestAnimationFrame(draw);
        return;
      }
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = `rgba(${ACCENT}, 0.35)`;
      for (const m of motes) {
        m.y -= m.drift * dt;
        if (m.y < -4) m.y = h + 4;
        m.phase += dt * 0.6;
        const x = m.x + Math.sin(m.phase) * m.sway;
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
