import { describe, expect, it } from 'vitest';
import { detectGaps } from '../../src/core/rehearsal-checks';
import { rehearsableHazards } from '../../src/core/rehearsal-entry';
import { GAP_ACTION_ID, GAP_KIND, actionFor } from '../../src/core/rehearsal-actions';
import type {
  CompletePackContent,
  DetectedGap,
  ExposureLayer,
  RehearsalGapType,
} from '../../src/core/types';
import { destination, pack, source } from '../fixtures';

const layer = (over: Partial<ExposureLayer> = {}): ExposureLayer => ({
  id: 'pack-1:BPA',
  packId: 'pack-1',
  group: 'designation',
  code: 'BPA',
  status: 'present',
  features: [],
  checkedAt: 1_756_100_000_000,
  source: source(),
  ...over,
});

/** A pack that passes the entry gate: complete, readable, and holding content a
 *  rehearsal can run from. Overrides take away one piece at a time. */
const content = (over: Partial<CompletePackContent> = {}): CompletePackContent => ({
  pack: pack(),
  layers: [layer()],
  destinations: [destination()],
  recovery: [],
  files: [],
  notes: [],
  recoveryVerified: true,
  contentVerified: true,
  ...over,
});

const types = (gaps: DetectedGap[]) => gaps.map((row) => row.gapType);

describe('what a rehearsal checks under no mobile data', () => {
  it('finds nothing when the pack holds the whole journey', () => {
    expect(detectGaps('no-data', content())).toEqual([]);
  });

  it('raises a gap when the official designation is not in the pack', () => {
    const gaps = detectGaps('no-data', content({ layers: [layer({ status: 'none-mapped-here' })] }));
    expect(types(gaps)).toEqual(['designation-missing']);
    expect(gaps[0].kind).toBe('pack-content');
    expect(gaps[0].hazard).toBe('bushfire');
  });

  it('raises a gap when no official place is saved with the pack', () => {
    // The absence row is a real row recording that the list holds nothing for
    // this area. It is not a place the journey can use.
    const gaps = detectGaps(
      'no-data',
      content({ destinations: [destination({ kind: 'absence', reason: 'None here.' })] }),
    );
    expect(types(gaps)).toEqual(['places-missing']);
  });

  // Shared rule 0.4: every stored item names its publisher and its saved date,
  // offline, or the reader cannot judge what they are reading.
  it('raises a gap when a stored item has lost its publisher or its saved date', () => {
    const noPublisher = detectGaps(
      'no-data',
      content({ destinations: [destination({ source: source({ publisher: '' }) })] }),
    );
    expect(types(noPublisher)).toContain('provenance-missing');

    const noDate = detectGaps(
      'no-data',
      content({ layers: [layer({ source: source({ retrievedAt: 0 }) })] }),
    );
    expect(types(noDate)).toContain('provenance-missing');
  });

  it('raises every gap that applies, not just the first', () => {
    // A designation is present, so the pack reaches a rehearsal; its place is
    // an absence row and its layer has lost its publisher, so two checks fail.
    const gaps = detectGaps(
      'no-data',
      content({
        layers: [layer({ source: source({ publisher: '' }) })],
        destinations: [destination({ kind: 'absence', reason: 'None here.' })],
      }),
    );
    expect(types(gaps)).toEqual(['places-missing', 'provenance-missing']);
  });

  // THE PRECONDITION, ASSERTED. A pack holding nothing to rehearse yields no
  // gaps, and an empty gap list reads as "nothing was missing" — which of an
  // empty pack would be a false reassurance, the one thing this product must
  // never give. What stops it is the entry gate: such a pack is told it holds
  // nothing to rehearse and never reaches a run. This test pins the coupling so
  // that a later caller reaching past the gate fails here rather than on a
  // screen.
  it('yields nothing for a pack the entry gate would have refused', () => {
    const refused = content({
      layers: [layer({ status: 'not-published' })],
      destinations: [destination({ kind: 'absence' })],
    });
    expect(detectGaps('no-data', refused)).toEqual([]);
    expect(rehearsableHazards(refused)).toEqual([]);
  });
});

describe('what a rehearsal checks under no location fix', () => {
  it('always raises the contingency, even on a pack that holds everything', () => {
    const gaps = detectGaps('no-location-fix', content());
    expect(types(gaps)).toEqual(['live-direction-unavailable']);
    expect(gaps[0].kind).toBe('condition-persistent');
  });

  // Losing the location fix does not excuse a pack that is short of something.
  it('still checks the saved information', () => {
    const gaps = detectGaps(
      'no-location-fix',
      content({ layers: [layer({ status: 'none-mapped-here' })] }),
    );
    expect(types(gaps)).toEqual(['designation-missing', 'live-direction-unavailable']);
  });

  // NOT A COVERAGE HOLE. Under no location fix the contingency always fires, so
  // a run under that condition can never produce "no gaps found". That state is
  // reachable only after a no-data run on a complete pack, which is the case
  // asserted at the top of this file — and it is why the no-gaps wording is
  // only ever read after a no-data run.
  it('can never produce an empty gap list, whatever the pack holds', () => {
    [content(), content({ layers: [] }), content({ destinations: [] })].forEach((value) => {
      expect(detectGaps('no-location-fix', value).length).toBeGreaterThan(0);
    });
  });
});

describe('every gap is one the reader can act on', () => {
  const everyGapType: RehearsalGapType[] = [
    'designation-missing',
    'places-missing',
    'provenance-missing',
    'live-direction-unavailable',
  ];

  // TC-5.2.1-A. One action per gap: never two, never none. The map is a
  // Record over the gap type, so a missing entry is a compile error; this
  // asserts the consequence.
  it('has exactly one action, and one action id, for every gap type', () => {
    everyGapType.forEach((gapType) => {
      const action = actionFor({ gapType, kind: GAP_KIND[gapType], hazard: 'bushfire' });
      expect(action.actionId).toBe(GAP_ACTION_ID[gapType]);
      expect(action.action.length).toBeGreaterThan(0);
      expect(action.title.length).toBeGreaterThan(0);
      expect(action.meaning.length).toBeGreaterThan(0);
    });
  });

  it('gives every gap type a distinct action id and a distinct action', () => {
    const ids = everyGapType.map((gapType) => GAP_ACTION_ID[gapType]);
    expect(new Set(ids).size).toBe(ids.length);
    const actions = everyGapType.map(
      (gapType) => actionFor({ gapType, kind: GAP_KIND[gapType], hazard: 'bushfire' }).action,
    );
    expect(new Set(actions).size).toBe(actions.length);
  });

  // TC-5.2.1-B. The two kinds are told apart by their words alone.
  it('explains the two kinds differently, and never by severity or rank', () => {
    const packContent = actionFor({
      gapType: 'places-missing',
      kind: 'pack-content',
      hazard: 'bushfire',
    });
    const persistent = actionFor({
      gapType: 'live-direction-unavailable',
      kind: 'condition-persistent',
      hazard: 'bushfire',
    });
    expect(packContent.meaning).not.toBe(persistent.meaning);
    expect(packContent.meaning).toBe('This information is missing from your pack.');
    expect(persistent.meaning).toBe(
      'This is not available under this condition. Here is what to do instead.',
    );
    [packContent, persistent].forEach((row) => {
      expect(`${row.meaning} ${row.action}`).not.toMatch(
        /\b(severe|severity|critical|urgent|worst|priority|rank|score|level)\b/i,
      );
    });
  });

  // A contingency action is something to do INSTEAD. It must never suggest the
  // capability has come back.
  it('never says a lost capability has returned', () => {
    const persistent = actionFor({
      gapType: 'live-direction-unavailable',
      kind: 'condition-persistent',
      hazard: 'bushfire',
    });
    expect(persistent.action).not.toMatch(
      /\brestored\b|\bback online\b|\bworking again\b|\bwill work\b|\bwill be available\b/i,
    );
  });

  it('says nothing about the reader being unprepared', () => {
    const everyString = everyGapType
      .flatMap((gapType) => {
        const action = actionFor({ gapType, kind: GAP_KIND[gapType], hazard: 'bushfire' });
        return [action.title, action.meaning, action.action];
      })
      .join(' ');
    expect(everyString).not.toMatch(/\bunprepared\b|\bnot ready\b|\byou (are|aren't) (ready|prepared)\b/i);
  });
});

describe('a gap names whose journey it belongs to', () => {
  it('carries the hazard, since one pack holds more than one', () => {
    detectGaps('no-location-fix', content()).forEach((row) => {
      expect(row.hazard).toBe('bushfire');
    });
  });
});
