import { describe, expect, it } from 'vitest';
import { classify } from '../../src/core/connectivity';

describe('classify — the full truth table', () => {
  it.each([
    [false, true, 'offline'],
    [false, false, 'offline'],
    [false, null, 'offline'],
    [true, true, 'online'],
    [true, false, 'no-data'],
    [true, null, 'no-data'],
  ] as const)('onLine=%s probeOk=%s -> %s', (onLine, probeOk, expected) => {
    expect(classify(onLine, probeOk)).toBe(expected);
  });

  it('treats an unanswered probe as no-data, not as evidence of a connection', () => {
    expect(classify(true, null)).toBe('no-data');
  });

  it('has no state that could be worded "no service" — the platform cannot observe it', () => {
    const states = new Set([
      classify(false, null),
      classify(true, null),
      classify(true, true),
      classify(true, false),
    ]);
    expect([...states].sort()).toEqual(['no-data', 'offline', 'online']);
  });
});
