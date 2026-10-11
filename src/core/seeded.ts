// A small seeded random source, so every daily choice is the same on every
// phone, with no network and no stored state: the word, the yard and the
// twist all follow from the day number alone.

/** mulberry32: a fast 32 bit generator. The same seed gives the same run. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One 32 bit seed from a few numbers and words, mixed so near inputs land
 *  far apart. */
export function seedFrom(...parts: (number | string)[]): number {
  let hash = 0x811c9dc5;
  const mix = (code: number) => {
    hash ^= code;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  };
  for (const part of parts) {
    const text = String(part);
    for (let i = 0; i < text.length; i++) mix(text.charCodeAt(i));
    mix(0x1f);
  }
  return hash >>> 0;
}

/** A shuffled copy, the same for the same seed. The original is untouched. */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const random = mulberry32(seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The order of `count` things for one cycle: a shuffle of every index, with
 *  the first swapped away when it would repeat the last of the cycle before. */
function cycleOrder(count: number, cycle: number, salt: string): number[] {
  const order = seededShuffle(
    Array.from({ length: count }, (_, i) => i),
    seedFrom(salt, cycle),
  );
  // With two things a swap would also move the last, so it is left alone.
  if (count > 2) {
    const before = seededShuffle(
      Array.from({ length: count }, (_, i) => i),
      seedFrom(salt, cycle - 1),
    );
    if (order[0] === before[count - 1]) [order[0], order[1]] = [order[1], order[0]];
  }
  return order;
}

/** Which of `count` things stretch number `step` shows. Every thing shows once
 *  in each cycle of `count` stretches, in an order shuffled afresh for each
 *  cycle, and never the same thing twice running across a cycle's edge. */
export function cyclePick(step: number, count: number, salt: string): number {
  const cycle = Math.floor(step / count);
  const position = step - cycle * count;
  return cycleOrder(count, cycle, salt)[position];
}
