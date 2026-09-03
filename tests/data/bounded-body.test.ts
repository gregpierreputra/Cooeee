import { describe, expect, it } from 'vitest';
import { readBodyBounded, readJsonBounded } from '../../src/data/bounded-body';

describe('readBodyBounded', () => {
  it('returns a body within the limit and refuses one over it', async () => {
    expect((await readBodyBounded(new Response('x'.repeat(10)), 10)).byteLength).toBe(10);
    await expect(readBodyBounded(new Response('x'.repeat(10)), 5)).rejects.toThrow(/exceeds 5 bytes/);
  });

  it('stops reading an endless body as soon as the limit is passed', async () => {
    let pulled = 0;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(new Uint8Array(4));
      },
    });
    await expect(readBodyBounded(new Response(endless), 10)).rejects.toThrow(/exceeds/);
    expect(pulled).toBeLessThanOrEqual(4); // three chunks pass 10 bytes; one may be read ahead
  });

  it('parses JSON the way response.json() would', async () => {
    expect(await readJsonBounded(new Response('{"a":1}'), 100)).toEqual({ a: 1 });
  });
});
