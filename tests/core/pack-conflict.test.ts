import { describe, expect, it } from 'vitest';

import { decidePackConflict } from '../../src/core/pack-conflict';
import * as copy from '../../src/core/copy';
import { pack } from '../fixtures';

describe('E1-US1-AC8 pack-conflict decision', () => {
  it('continues without conflict when no complete pack exists', () => {
    expect(decidePackConflict([])).toEqual({ kind: 'none' });
  });

  it('requires an explicit decision when exactly one complete pack exists', () => {
    const savedPack = pack();
    expect(decidePackConflict([savedPack])).toEqual({ kind: 'conflict', savedPack });
  });

  it('stops rather than silently choosing when the one-pack invariant is broken', () => {
    expect(decidePackConflict([pack({ id: 'one' }), pack({ id: 'two' })])).toEqual({
      kind: 'invalid-multiple',
    });
  });
});

describe('E1-US1-AC8 exact copy', () => {
  it('states the conflict and both outcomes exactly', () => {
    expect(copy.PLACE_ALREADY_SAVED).toBe('You already have a saved place.');
    expect(copy.KEEP_SAVED_PLACE).toBe('Keep the saved place');
    expect(copy.REPLACE_WITH_THIS_ONE).toBe('Replace it with this one');
  });

  it('states that blocked conflict checks change nothing', () => {
    expect(copy.NOTHING_CHANGED).toBe('Nothing has been changed.');
  });
});
