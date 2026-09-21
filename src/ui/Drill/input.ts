// E7 — the two ways to steer: the arrow keys and the thumb stick. Both end up
// as one vector at most one long, x to the right and y down the screen.

const KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
};

/** Listen for the arrow keys (and WASD) and report the held direction. The
 *  held keys are kept as a set, so letting go of Left while Right is still
 *  down keeps the figure going right. Returns the function that stops it. */
export function attachKeys(onSteer: (x: number, y: number) => void): () => void {
  const held = new Set<string>();
  const report = () => {
    let x = 0;
    let y = 0;
    for (const key of held) {
      x += KEYS[key][0];
      y += KEYS[key][1];
    }
    onSteer(Math.sign(x), Math.sign(y));
  };
  const onKey = (event: KeyboardEvent) => {
    if (!(event.key in KEYS)) return;
    event.preventDefault();
    if (event.type === 'keydown') held.add(event.key);
    else held.delete(event.key);
    report();
  };
  // A tab that loses focus never hears the key come up.
  const onBlur = () => {
    held.clear();
    report();
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  window.addEventListener('blur', onBlur);
  return () => {
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
    window.removeEventListener('blur', onBlur);
  };
}

/** The thumb's offset from where it landed, held inside a circle. Returns the
 *  offset in pixels (for the knob) and as a vector at most one long. */
export function stickVector(originX: number, originY: number, x: number, y: number, radius: number) {
  let dx = x - originX;
  let dy = y - originY;
  const length = Math.hypot(dx, dy);
  if (length > radius) {
    dx *= radius / length;
    dy *= radius / length;
  }
  return { dx, dy, x: dx / radius, y: dy / radius };
}
