import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as copy from '../../src/core/copy';
import { journeyPlaces } from '../../src/core/rehearsal-journey';
import type { CompletePackContent, ExposureLayer } from '../../src/core/types';
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

/** A complete pack that passes the entry gate. Overrides take one piece away. */
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

// 1_756_100_000_000 is 25 August 2025 in Melbourne.
const SAVED = '25 August 2025';

describe('the places the journey screen names', () => {
  it('names each official place as the destinations list does, with its address and saved date, in list order', () => {
    const held = content({
      destinations: [
        destination({ id: 'pack-1:c', name: 'Third Reserve', addressText: '1 High Street, Kalorama' }),
        destination({
          id: 'pack-1:b',
          name: 'Second Reserve',
          distanceOrder: 1,
          source: source({ publisher: 'Another Publisher' }),
        }),
        destination({ id: 'pack-1:a', name: undefined, addressText: undefined, distanceOrder: 0 }),
        // A real stored row recording that the list holds nothing: not a place.
        destination({ id: 'pack-1:absence', kind: 'absence', reason: 'None here.' }),
      ],
    });

    expect(journeyPlaces(held)).toEqual([
      { id: 'pack-1:c', name: 'Third Reserve', where: '1 High Street, Kalorama', savedLine: `Saved ${SAVED}` },
      { id: 'pack-1:a', name: 'Official place of last resort information', where: '', savedLine: `Saved ${SAVED}` },
      { id: 'pack-1:b', name: 'Second Reserve', where: '', savedLine: `Saved ${SAVED}` },
    ]);
  });

  it('names none when the pack holds no official place', () => {
    expect(journeyPlaces(content({ destinations: [] }))).toEqual([]);
  });
});

describe("the journey screen's words", () => {
  const before = [
    copy.JOURNEY_BEFORE_HEADING,
    copy.JOURNEY_CONDITION_LINE('mobile data'),
    copy.JOURNEY_WHAT_IT_IS,
    copy.JOURNEY_WHAT_IT_IS_FOR,
    copy.I_AM_GOING_NOW,
  ];
  const running = [
    copy.JOURNEY_RUNNING_HEADING,
    copy.JOURNEY_RUNNING_DETAIL,
    copy.ENDING_ARRIVED,
    copy.ENDING_WITHOUT_GOING,
  ];
  const everyWord = [...before, ...running].join(' ');

  it('are exactly the draft wording, pending the copy review', () => {
    expect(before).toEqual([
      'Rehearse the way there',
      'This rehearsal is without mobile data.',
      'A rehearsal is a trip to one of the official places saved with this pack, in calm conditions, with BlackSky open. Go the way you would on the day.',
      'It is practice at knowing the way: how long it takes, which turns you take, and what you meet on it. It is not a choice of where to go on the day.',
      "I'm going now",
    ]);
    expect(running).toEqual([
      'Practising the way',
      'Go to one of these places in calm conditions, with BlackSky open. When you stop, come back here and say how it ended.',
      'I have arrived',
      'End without going',
    ]);
  });

  it('ask for a trip in calm conditions, with BlackSky open, before and during, however she gets there', () => {
    [copy.JOURNEY_BEFORE_HEADING, copy.JOURNEY_WHAT_IT_IS, copy.JOURNEY_RUNNING_DETAIL].forEach((line) => {
      expect(line).not.toMatch(/foot|walk/i);
    });
    [copy.JOURNEY_WHAT_IT_IS, copy.JOURNEY_RUNNING_DETAIL].forEach((line) => {
      expect(line).toContain('in calm conditions');
      expect(line).toContain('with BlackSky open');
    });
  });

  it('say it is practice at knowing the way, and not a choice of where to go on the day', () => {
    expect(copy.JOURNEY_WHAT_IT_IS_FOR).toContain('practice at knowing the way');
    expect(copy.JOURNEY_WHAT_IT_IS_FOR).toContain('It is not a choice of where to go on the day.');
  });

  it('never read as a plan for the day', () => {
    expect(everyWord).not.toMatch(
      /\b(destination|destinations|evacuat\w*|your plan|plan to go|where you will go|go there on the day|meeting point)\b/i,
    );
  });

  it('use no banned travel word', () => {
    expect(everyWord).not.toMatch(/\b(route|routes|directions|turn-by-turn|eta|arrival|arrive by)\b/i);
  });

  it('never judge the walk, and never call a rehearsal short of anything', () => {
    expect(everyWord).not.toMatch(
      /\b(fast|faster|slow|slower|quick|quicker|target|pace|beat|score|grade|pass|passed|fail|failed|partial|incomplete|so far)\b/i,
    );
  });
});

// SEC-1. The rehearsal renders its own screens, so the live BlackSky path — its
// latch, its position permission, its resume — cannot be reached from inside a
// run's code. It is reached only the way Home reaches it: by its route.
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

  it('reaches the real BlackSky by its route, through the shared hold, as Home does', () => {
    const journey = readFileSync(join('src', 'ui', 'Rehearsal', 'Journey.tsx'), 'utf8');
    expect(journey).toMatch(/import HoldButton from '\.\.\/components\/HoldButton'/);
    expect(journey).toContain("onHold={() => navigate('/blacksky')}");
    const app = readFileSync(join('src', 'app.tsx'), 'utf8');
    expect(app).toContain('<Route path="/blacksky" element={<BlackSky />} />');
  });
});
