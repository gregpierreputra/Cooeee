/** Call `frame` on every animation frame with the seconds since the last one,
 *  until it returns false or the returned stop function runs. A long gap (the
 *  tab hidden, the phone locked) counts as a tenth of a second, so the drill's
 *  clock never runs down while nothing could be seen. */
export function startLoop(frame: (dt: number, now: number) => boolean): () => void {
  let last = 0;
  let handle = requestAnimationFrame(function tick(now) {
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    if (frame(dt, now / 1000)) handle = requestAnimationFrame(tick);
  });
  return () => cancelAnimationFrame(handle);
}
