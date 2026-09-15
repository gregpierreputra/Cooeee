import { describe, expect, it } from 'vitest';
import * as copy from '../../src/core/copy';
import { REHEARSAL_CONDITIONS, conditionLabel } from '../../src/core/rehearsal-condition';
import { barParts, isRunFor, type RehearsalRun } from '../../src/core/rehearsal-run';

const run = (over: Partial<RehearsalRun> = {}): RehearsalRun => ({
  id: 'run-1',
  packId: 'pack-1',
  condition: 'no-data',
  startedAt: 1_756_100_000_000,
  ...over,
});

// E5-US1-AC2. The bar is the whole of what keeps a rehearsal from being taken
// for the real thing, so what it states is decided here and tested here.
describe('what the bar states', () => {
  it('always states both the word and the condition', () => {
    REHEARSAL_CONDITIONS.forEach((condition) => {
      const parts = barParts(run({ condition }));
      expect(parts.marker).toBe('Rehearsal');
      expect(parts.condition).toBe(conditionLabel(condition));
      expect(parts.marker.length).toBeGreaterThan(0);
      expect(parts.condition.length).toBeGreaterThan(0);
    });
  });

  it('names the condition that was chosen, and never the other', () => {
    REHEARSAL_CONDITIONS.forEach((condition) => {
      const parts = barParts(run({ condition }));
      REHEARSAL_CONDITIONS.filter((other) => other !== condition).forEach((other) => {
        expect(parts.condition).not.toBe(conditionLabel(other));
      });
    });
  });

  // Two separate strings, not one sentence: neither half can be quietly dropped
  // in favour of a colour or an icon, and a screen reader meets them as two
  // pieces rather than a run-on line.
  it('keeps the marker and the condition as separate pieces', () => {
    const parts = barParts(run());
    expect(Object.keys(parts).sort()).toEqual(['condition', 'marker']);
    expect(parts.marker).not.toContain(parts.condition);
    expect(parts.condition).not.toContain(parts.marker);
  });

  it('states the marker in the same word the rest of the flow uses', () => {
    expect(barParts(run()).marker).toBe(copy.REHEARSAL_LABEL);
  });
});

// E5-US1-AC3. A run belongs to one pack. Returning to the rehearsal entry for
// that pack is a resumption; opening it for a different pack is not.
describe('which pack a run belongs to', () => {
  it('is a resumption only for the pack the run is against', () => {
    expect(isRunFor(run({ packId: 'pack-1' }), 'pack-1')).toBe(true);
    expect(isRunFor(run({ packId: 'pack-1' }), 'pack-2')).toBe(false);
  });

  it('is never a resumption when no rehearsal is running', () => {
    expect(isRunFor(null, 'pack-1')).toBe(false);
    expect(isRunFor(null, '')).toBe(false);
  });

  it('does not match on a partial or empty id', () => {
    expect(isRunFor(run({ packId: 'pack-1' }), 'pack')).toBe(false);
    expect(isRunFor(run({ packId: 'pack-1' }), '')).toBe(false);
    expect(isRunFor(run({ packId: '' }), 'pack-1')).toBe(false);
  });
});

// The shape itself is the AC3 guarantee: a run holds nothing that is written
// down while it is in progress, so there is nothing that could later be found
// half-finished.
describe('the shape of a run', () => {
  // The id and the start time are the identity a FINISHED record would be
  // written under. Neither is stored while the run is in progress, and there is
  // no progress field: progress that outlived the page would be a partial
  // result, which E5-US1-AC3 forbids.
  it('carries only what a finished record needs, and no progress', () => {
    expect(Object.keys(run()).sort()).toEqual(['condition', 'id', 'packId', 'startedAt']);
    expect(run()).not.toHaveProperty('progress');
    expect(run()).not.toHaveProperty('finishedAt');
    expect(run()).not.toHaveProperty('gaps');
  });

  it('has no field for a second condition', () => {
    const value = run();
    expect(Array.isArray(value.condition)).toBe(false);
    expect(value).not.toHaveProperty('conditions');
  });
});

describe('the wording of a running rehearsal', () => {
  it('says what a rehearsal does not do, and never implies something was sent', () => {
    expect(copy.NOTHING_IS_SENT).toBe(
      'Nothing is sent from this rehearsal. Nothing leaves this phone.',
    );
    // "sent" appears only as something that does NOT happen.
    expect(copy.NOTHING_IS_SENT).not.toMatch(/\bhas been sent\b|\bwe sent\b|\bmessage sent\b|\bsending\b/i);
    expect(copy.LEAVE_REHEARSAL).toBe('Leave the rehearsal');
  });

  it('names no hazard, and says nothing about the reader', () => {
    const lines = [copy.NOTHING_IS_SENT, copy.LEAVE_REHEARSAL, copy.REHEARSAL_LABEL];
    lines.forEach((line) => {
      expect(line).not.toMatch(/\b(bushfire|fire|heat|hot|flood|storm|smoke|ember)\b/i);
      expect(line).not.toMatch(/\bunprepared\b|\bnot ready\b/i);
    });
  });
});
