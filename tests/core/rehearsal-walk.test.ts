import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as copy from '../../src/core/copy';
import { detectGaps } from '../../src/core/rehearsal-checks';
import { REHEARSAL_CONDITIONS } from '../../src/core/rehearsal-condition';
import { rehearsalResult } from '../../src/core/rehearsal-result';
import {
  WALK_START,
  WALK_STEPS,
  advanceWalk,
  walkStep,
  type WalkStepView,
} from '../../src/core/rehearsal-walk';
import type {
  CompletePackContent,
  ExposureLayer,
  Rehearsal,
} from '../../src/core/types';
import type { RehearsalCondition } from '../../src/core/rehearsal-condition';
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

/** A complete pack that holds the whole journey. Overrides take one piece away. */
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

const finished = (condition: RehearsalCondition, held: CompletePackContent): Rehearsal => ({
  id: 'run-1',
  packId: 'pack-1',
  condition,
  startedAt: 1_756_100_000_000,
  finishedAt: 1_756_100_060_000,
  packVerifiedAt: held.pack.verifiedAt,
  gaps: detectGaps(condition, held),
});

const walk = (condition: RehearsalCondition, held: CompletePackContent): WalkStepView[] =>
  WALK_STEPS.map((step) => walkStep(step, condition, held));

const line = (view: WalkStepView, gapType: string) => {
  const found = view.lines.find((row) => row.gapType === gapType);
  if (!found) throw new Error(`no ${gapType} line`);
  return found;
};

describe('the order of the walk', () => {
  it('is two steps, the pack then BlackSky', () => {
    expect(WALK_STEPS).toEqual(['pack', 'blacksky']);
    expect(WALK_START).toBe('pack');
  });

  it('moves forward by exactly one, and only reaches the result through both steps', () => {
    expect(advanceWalk('pack')).toBe('blacksky');
    expect(advanceWalk('blacksky')).toBe('result');
    expect(advanceWalk('result')).toBe('result');
  });

  it('counts the steps, reuses the real headings, and adds none of its own', () => {
    const [first, second] = walk('no-data', content());
    expect([first.counter, first.heading]).toEqual(['Step 1 of 2', copy.YOUR_PACK]);
    expect([second.counter, second.heading]).toEqual(['Step 2 of 2', copy.BLACKSKY_TITLE]);
  });

  it('states the four checks across the two steps as the criterion splits them', () => {
    const [first, second] = walk('no-data', content());
    expect(first.lines.map((row) => row.title)).toEqual([copy.GAP_DESIGNATION, copy.GAP_PROVENANCE]);
    expect(second.lines.map((row) => row.title)).toEqual([copy.GAP_PLACES, copy.GAP_LIVE_DIRECTION]);
  });
});

// TC-5.1.5-A
describe('a complete pack under no mobile data', () => {
  it('holds on every line, in words, and reaches the existing no-gaps result', () => {
    const held = content();
    const [first, second] = walk('no-data', held);
    [...first.lines, ...second.lines].forEach((row) => expect(row.state).toBe('held'));
    expect(first.lines.map((row) => row.statement)).toEqual([
      'This information is in your pack.',
      'This information is in your pack.',
    ]);
    expect(line(second, 'places-missing').statement).toBe('This information is in your pack.');
    expect(line(second, 'live-direction-unavailable').statement).toBe(
      'This still works without mobile data.',
    );
    expect(rehearsalResult(finished('no-data', held)).state).toBe('no-gaps');
  });
});

// TC-5.1.5-B
describe('a pack whose official places were withheld', () => {
  it('states a gap on step 2 with the same sentence the result uses', () => {
    const held = content({ destinations: [] });
    const places = line(walkStep('blacksky', 'no-data', held), 'places-missing');
    expect(places.state).toBe('gap');
    expect(places.statement).toBe(copy.GAP_MEANING_PACK_CONTENT);

    const result = rehearsalResult(finished('no-data', held));
    if (result.state !== 'gaps') throw new Error('expected gaps');
    const row = result.rows.find((gap) => gap.gapType === 'places-missing');
    expect(row?.meaning).toBe(places.statement);
  });

  it('states a pack gap on step 1 the same way', () => {
    const held = content({ layers: [layer({ status: 'none-mapped-here' })] });
    const designation = line(walkStep('pack', 'no-data', held), 'designation-missing');
    expect(designation.state).toBe('gap');
    expect(designation.statement).toBe(copy.GAP_MEANING_PACK_CONTENT);
  });
});

// TC-5.1.5-C
describe('no location fix', () => {
  it('states live direction and distance as a gap, and leaves the action to the result', () => {
    const held = content();
    const live = line(walkStep('blacksky', 'no-location-fix', held), 'live-direction-unavailable');
    expect(live.state).toBe('gap');
    expect(live.statement).toBe(copy.GAP_MEANING_CONDITION_FACT);
    expect(live.statement).not.toContain(copy.GAP_MEANING_CONDITION_NEXT);

    const result = rehearsalResult(finished('no-location-fix', held));
    if (result.state !== 'gaps') throw new Error('expected gaps');
    const row = result.rows.find((gap) => gap.gapType === 'live-direction-unavailable');
    expect(row?.meaning).toBe(copy.GAP_MEANING_CONDITION);
    expect(row?.action).toBe(copy.ACTION_WRITE_THE_WAY_DOWN);
  });

  it('keeps what the pack holds held, since saved information does not need a fix', () => {
    const [first] = walk('no-location-fix', content());
    first.lines.forEach((row) => expect(row.state).toBe('held'));
  });
});

// TC-5.1.5-D. With every colour removed, only the words are left, so the words
// alone have to say which state a line is in.
describe('held and gap, told apart by words alone', () => {
  const everyGap = content({
    layers: [layer({ status: 'none-mapped-here' })],
    destinations: [destination({ source: source({ publisher: '' }) })],
  });

  it('never gives a held line and a gap line the same sentence, under either condition', () => {
    REHEARSAL_CONDITIONS.forEach((condition) => {
      WALK_STEPS.forEach((step) => {
        const held = walkStep(step, condition, content());
        const gaps = walkStep(step, condition, everyGap);
        held.lines.forEach((row) => {
          const other = gaps.lines.find((gap) => gap.gapType === row.gapType);
          if (other && other.state !== row.state) {
            expect(other.statement).not.toBe(row.statement);
          }
        });
      });
    });
  });

  it('says every line in a full sentence, with no figure, score or hazard name', () => {
    REHEARSAL_CONDITIONS.forEach((condition) => {
      [content(), everyGap, content({ destinations: [] })].forEach((held) => {
        walk(condition, held).forEach((view) => {
          view.lines.forEach((row) => {
            expect(row.statement).toMatch(/^[A-Z].+\.$/);
            expect(`${row.title} ${row.statement}`).not.toMatch(/\d|%/);
            Object.values(copy.HAZARD_NAME).forEach((hazard) => {
              expect(`${view.heading} ${row.title} ${row.statement}`).not.toContain(hazard);
            });
          });
        });
      });
    });
  });
});

// Amended 14 September 2026: a line that holds shows its value from the pack.
describe('a held line shows what the pack holds', () => {
  const DTP = 'Department of Transport and Planning';
  // 1_756_100_000_000 is 25 August 2025 in Melbourne.
  const SAVED = '25 August 2025';
  const held = content({
    layers: [layer({ source: source({ publisher: DTP }) })],
    destinations: [
      destination({ id: 'pack-1:c', name: 'Third Reserve' }),
      destination({ id: 'pack-1:b', name: 'Second Reserve', distanceOrder: 1 }),
      destination({ id: 'pack-1:a', name: undefined, distanceOrder: 0 }),
    ],
  });

  it('shows each value worded exactly as the rest of the app words it', () => {
    const [first, second] = walk('no-data', held);
    // The designation, as the area check states it.
    expect(line(first, 'designation-missing').values).toEqual([
      'This address is inside a Designated Bushfire Prone Area.',
    ]);
    // The shared provenance line, once for each distinct line: the three places
    // share one publisher and one saved date.
    expect(line(first, 'provenance-missing').values).toEqual([
      `Published by ${DTP} · Saved ${SAVED}`,
      `Published by Country Fire Authority · Saved ${SAVED}`,
    ]);
    // Named as the destinations list names them, in the order it listed them.
    expect(line(second, 'places-missing').values).toEqual([
      'Third Reserve',
      'Official place of last resort information',
      'Second Reserve',
    ]);
  });

  it('never shows a value for live direction and distance, under either condition', () => {
    REHEARSAL_CONDITIONS.forEach((condition) => {
      expect(line(walkStep('blacksky', condition, held), 'live-direction-unavailable').values).toEqual([]);
    });
  });

  it('shows no value on a gap line, so a gap has no empty slot', () => {
    const everyGap = content({
      layers: [layer({ status: 'none-mapped-here' })],
      destinations: [destination({ source: source({ publisher: '' }) })],
    });
    const gapLines = walk('no-location-fix', everyGap)
      .flatMap((view) => view.lines)
      .filter((row) => row.state === 'gap');
    expect(gapLines.map((row) => row.gapType)).toEqual([
      'designation-missing',
      'provenance-missing',
      'live-direction-unavailable',
    ]);
    gapLines.forEach((row) => expect(row.values, row.gapType).toEqual([]));

    const places = line(walkStep('blacksky', 'no-data', content({ destinations: [] })), 'places-missing');
    expect(places.state).toBe('gap');
    expect(places.values).toEqual([]);
  });

  it('shows no designation value it has no existing wording for', () => {
    // Only a BPA row is ever built. A designation held by BMO alone has no
    // area-check wording, so the line holds with no value rather than new words.
    const bmo = content({ layers: [layer({ id: 'pack-1:BMO', code: 'BMO' })] });
    const designation = line(walkStep('pack', 'no-data', bmo), 'designation-missing');
    expect(designation.state).toBe('held');
    expect(designation.values).toEqual([]);
  });
});

describe('a check the journey never looks for', () => {
  it('is not stated as held', () => {
    // No bushfire content, so the designation is never looked for. The gate
    // keeps such a pack out of a run; this only guards the claim itself.
    const first = walkStep('pack', 'no-data', content({ layers: [], destinations: [] }));
    expect(first.lines.map((row) => row.gapType)).toEqual(['provenance-missing']);
  });
});

describe('the condition sentence, split', () => {
  it('keeps the joined sentence byte-identical', () => {
    expect(copy.GAP_MEANING_CONDITION).toBe(
      'This is not available under this condition. Here is what to do instead.',
    );
    expect(`${copy.GAP_MEANING_CONDITION_FACT} ${copy.GAP_MEANING_CONDITION_NEXT}`).toBe(
      copy.GAP_MEANING_CONDITION,
    );
  });
});

// SEC-1. The rehearsal renders its own screens, so the live BlackSky path — its
// latch, its position permission, its resume — cannot be reached from a run.
describe('the rehearsal and the live BlackSky screen', () => {
  it('never imports BlackSky.tsx anywhere under src/ui/Rehearsal', () => {
    const dir = join('src', 'ui', 'Rehearsal');
    const files = readdirSync(dir).filter((name) => /\.tsx?$/.test(name));
    expect(files.length).toBeGreaterThan(0);
    files.forEach((name) => {
      const text = readFileSync(join(dir, name), 'utf8');
      expect(text, name).not.toMatch(/(from|import\()\s*['"][^'"]*\/BlackSky(\.tsx)?['"]/);
    });
  });
});
