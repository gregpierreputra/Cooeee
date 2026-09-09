import { describe, expect, it } from 'vitest';
import * as copy from '../../src/core/copy';
import {
  rehearsableHazards,
  rehearsalGate,
  type RehearsalInput,
} from '../../src/core/rehearsal-entry';
import type { CompletePackContent, ExposureLayer, LayerCode } from '../../src/core/types';
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

/** A readable complete pack. `counts` sets what the manifest says it holds, so
 *  a withheld group can be built by counting rows the content does not carry. */
const content = (
  over: Partial<CompletePackContent> = {},
  counts: { layers?: number; destinations?: number } = {},
): CompletePackContent => ({
  pack: pack({
    manifest: {
      version: 1,
      groups: {
        layers: { count: counts.layers ?? (over.layers?.length ?? 0), sha256: 'a' },
        destinations: {
          count: counts.destinations ?? (over.destinations?.length ?? 0),
          sha256: 'b',
        },
        recovery: { count: 0, sha256: '' },
        tiles: { count: 0, bytes: 0 },
      },
    },
  }),
  layers: [],
  destinations: [],
  recovery: [],
  files: [],
  notes: [],
  recoveryVerified: true,
  contentVerified: true,
  ...over,
});

const input = (over: Partial<RehearsalInput> = {}): RehearsalInput => ({
  now: 1_756_200_000_000,
  completeCount: 1,
  unfinishedCount: 0,
  content: null,
  ...over,
});

describe('no pack is stored', () => {
  it('is its own state, and not the state of a pack that was never finished', () => {
    const gate = rehearsalGate(input({ completeCount: 0, content: null }));
    expect(gate).toEqual({ state: 'no-pack', otherCompletePacks: 0 });
  });

  it('counts the packs that are stored, so it never claims an empty device', () => {
    const gate = rehearsalGate(input({ completeCount: 2, content: null }));
    expect(gate).toEqual({ state: 'no-pack', otherCompletePacks: 2 });
  });
});

describe('the pack was never finished', () => {
  it('reports the unfinished builds rather than reporting nothing at all', () => {
    const gate = rehearsalGate(input({ completeCount: 0, unfinishedCount: 1, content: null }));
    expect(gate).toEqual({ state: 'incomplete', unfinishedCount: 1 });
  });

  it('is a different state from no pack, on the same empty content', () => {
    const unfinished = rehearsalGate(input({ completeCount: 0, unfinishedCount: 1 }));
    const none = rehearsalGate(input({ completeCount: 0, unfinishedCount: 0 }));
    expect(unfinished.state).not.toBe(none.state);
  });
});

describe('the pack could not be read', () => {
  it('a store that cannot be opened names the whole pack, and no pack name', () => {
    expect(rehearsalGate(input({ content: 'unreadable' }))).toEqual({
      state: 'unreadable',
      packId: null,
      packName: null,
      parts: ['the-whole-pack'],
    });
  });

  // The screen offers a way back to the pack, so the state has to carry which
  // pack that is. A store that could not be opened carries none, because there
  // is no pack it could honestly send the reader back to.
  it('carries the pack to return to, except when the store itself would not open', () => {
    const readable = rehearsalGate(
      input({ content: content({ contentVerified: false }, { destinations: 1 }) }),
    );
    expect(readable).toMatchObject({ state: 'unreadable', packId: 'pack-1' });
    expect(rehearsalGate(input({ content: 'unreadable' }))).toMatchObject({ packId: null });
    expect(rehearsalGate(input({ content: content() }))).toMatchObject({ packId: 'pack-1' });
  });

  it('names the withheld group rather than describing an unspecified problem', () => {
    const gate = rehearsalGate(
      input({
        content: content({ layers: [layer()], contentVerified: false }, { destinations: 2 }),
      }),
    );
    expect(gate).toEqual({
      state: 'unreadable',
      packId: 'pack-1',
      packName: 'Kalorama',
      parts: ['saved-places'],
    });
  });

  it('names every withheld group at once', () => {
    const gate = rehearsalGate(
      input({ content: content({ contentVerified: false }, { layers: 1, destinations: 2 }) }),
    );
    expect(gate).toMatchObject({ parts: ['stored-items', 'saved-places'] });
  });

  // Shared rule 0.1, Honest wording: "Distinguish present, nothing mapped
  // here, not published here, failed check, stale data and absent data". A
  // failed check and absent data are two of those six. A withheld group has
  // not been shown to be empty, so the pack must never be described as holding
  // nothing on the strength of it.
  it('rule 0.1: a failed check is reported before the pack is called empty', () => {
    const gate = rehearsalGate(
      input({ content: content({ contentVerified: false }, { layers: 1, destinations: 1 }) }),
    );
    expect(gate.state).toBe('unreadable');
    expect(gate.state).not.toBe('nothing-to-rehearse');
  });

  it('a group the manifest counted nothing in was not withheld', () => {
    const gate = rehearsalGate(input({ content: content({ layers: [layer()] }) }));
    expect(gate.state).toBe('ready');
  });
});

describe('the pack holds nothing to rehearse', () => {
  it('a pack of absences is empty even though its manifest counts rows', () => {
    const gate = rehearsalGate(
      input({
        content: content({
          layers: [layer({ status: 'none-mapped-here' }), layer({ id: 'x', code: 'BMO', status: 'not-published' })],
          destinations: [destination({ kind: 'absence', reason: 'None in this area.' })],
        }),
      }),
    );
    expect(gate).toEqual({
      state: 'nothing-to-rehearse',
      packId: 'pack-1',
      packName: 'Kalorama',
      savedOn: '25 August 2025',
    });
  });

  it('states the date in the product format, day, full month, year', () => {
    const gate = rehearsalGate(input({ content: content() }));
    expect(gate).toMatchObject({ savedOn: expect.stringMatching(/^\d{1,2} [A-Z][a-z]+ \d{4}$/) });
  });
});

describe('the pack can be rehearsed', () => {
  it('a stored bushfire designation is enough on its own', () => {
    expect(rehearsalGate(input({ content: content({ layers: [layer()] }) }))).toEqual({
      state: 'ready',
      packId: 'pack-1',
      packName: 'Kalorama',
      hazards: ['bushfire'],
    });
  });

  it('a stored official place is enough on its own', () => {
    expect(
      rehearsalGate(input({ content: content({ destinations: [destination()] }) })),
    ).toMatchObject({ state: 'ready', hazards: ['bushfire'] });
  });
});

describe('rehearsableHazards', () => {
  it('reads the stored status, never the manifest count', () => {
    expect(rehearsableHazards(content({ layers: [layer()] }, { layers: 9 }))).toEqual(['bushfire']);
    expect(rehearsableHazards(content({ layers: [layer({ status: 'none-mapped-here' })] }))).toEqual(
      [],
    );
    expect(rehearsableHazards(content({ layers: [layer({ status: 'not-published' })] }))).toEqual([]);
  });

  it('BPA and BMO speak for bushfire', () => {
    expect(rehearsableHazards(content({ layers: [layer({ code: 'BPA' })] }))).toEqual(['bushfire']);
    expect(
      rehearsableHazards(content({ layers: [layer({ code: 'BMO', group: 'overlay' })] })),
    ).toEqual(['bushfire']);
  });

  // The flood overlays are deliberately not rehearsable in this iteration. They
  // stay in the pack as context for the address, and a third hazard is a team
  // decision rather than a line added to a lookup table.
  it('the flood overlays stay in the pack and are not rehearsable', () => {
    const floods: LayerCode[] = ['LSIO', 'FO', 'SBO'];
    floods.forEach((code) => {
      expect(rehearsableHazards(content({ layers: [layer({ code, group: 'overlay' })] }))).toEqual(
        [],
      );
    });
  });

  it('an absence row names no hazard', () => {
    expect(rehearsableHazards(content({ destinations: [destination({ kind: 'absence' })] }))).toEqual(
      [],
    );
  });

  it('does not repeat a hazard two rows both speak for', () => {
    expect(
      rehearsableHazards(
        content({ layers: [layer()], destinations: [destination()] }),
      ),
    ).toEqual(['bushfire']);
  });
});

// The four stopped states are what the user reads, so the wording is asserted
// here beside the state that chooses it.
describe('what each stopped state says', () => {
  // The two states are kept apart by BEING different, not by one explaining the
  // other. With the middle paragraph gone, the word "finished" no longer appears
  // in the unreadable state at all, so the separation is now total rather than
  // resting on a sentence that named the other state.
  it('"not finished" and "could not be read" share no sentence, and now no wording at all', () => {
    const notFinished = [copy.PACK_NOT_FINISHED, copy.PACK_NOT_FINISHED_DETAIL(1), copy.PACK_NOT_FINISHED_NEXT];
    const unreadable = [
      copy.PACK_COULD_NOT_BE_READ,
      copy.PACK_COULD_NOT_BE_READ_DETAIL('the saved places'),
      copy.PACK_STORE_UNREADABLE_DETAIL,
      copy.PACK_COULD_NOT_BE_READ_NEXT,
    ];
    notFinished.forEach((line) => expect(unreadable).not.toContain(line));
    expect(unreadable.join(' ')).not.toMatch(/\bfinish(ed)?\b/i);
    expect(notFinished.join(' ')).not.toMatch(/\bread\b|\bcould not be read\b/i);
  });

  /** EVERY string any of the four states, the trigger or the placeholder can
   *  render. A new line added to the block in copy.ts belongs here too: that is
   *  the point of listing them rather than scanning by hand. */
  const EVERY_REHEARSAL_STRING = [
    copy.REHEARSAL_LABEL,
    copy.REHEARSE_THIS_PACK,
    copy.BACK_TO_THIS_PACK,
    copy.PACK_NOT_FINISHED,
    copy.PACK_NOT_FINISHED_DETAIL(0),
    copy.PACK_NOT_FINISHED_DETAIL(1),
    copy.PACK_NOT_FINISHED_DETAIL(3),
    copy.PACK_NOT_FINISHED_NEXT,
    copy.NOTHING_TO_REHEARSE,
    copy.NOTHING_TO_REHEARSE_DETAIL('Kalorama', '3 March 2026'),
    copy.NOTHING_TO_REHEARSE_NEXT,
    copy.PACK_COULD_NOT_BE_READ,
    copy.PACK_COULD_NOT_BE_READ_DETAIL(copy.AND_LIST(Object.values(copy.UNREADABLE_PART_NAMES))),
    copy.PACK_STORE_UNREADABLE_DETAIL,
    copy.PACK_COULD_NOT_BE_READ_NEXT,
    copy.NO_PACK_TO_REHEARSE,
    copy.NO_PACK_ELSEWHERE,
    copy.NO_PACK_TO_REHEARSE_DETAIL,
    copy.NO_PACK_OTHERS_DETAIL(0),
    copy.NO_PACK_OTHERS_DETAIL(1),
    copy.NO_PACK_OTHERS_DETAIL(4),
    copy.REHEARSAL_READY_PLACEHOLDER('Kalorama'),
    ...Object.values(copy.UNREADABLE_PART_NAMES),
  ];

  // One pack holds bushfire and extreme heat, so no state may name either, and
  // none may name the flood overlays the pack also carries as context. Asserted
  // over EVERY string rather than the one line that once named bushfire: a
  // hazard name added to any other state tomorrow has to fail the build.
  it('no rehearsal string anywhere names a hazard', () => {
    const named = EVERY_REHEARSAL_STRING.filter((line) =>
      /\b(bushfire|fire|heat|hot|flood|flooding|storm|inundation|smoke|ember)\b/i.test(line),
    );
    expect(named).toEqual([]);
    // The list itself must not quietly shrink to nothing and pass on emptiness.
    expect(EVERY_REHEARSAL_STRING.length).toBeGreaterThanOrEqual(25);
    EVERY_REHEARSAL_STRING.forEach((line) => expect(line.length).toBeGreaterThan(0));
  });

  it('no state says anything about the reader being unprepared', () => {
    const everyLine = [
      copy.BACK_TO_THIS_PACK,
      copy.PACK_NOT_FINISHED,
      copy.PACK_NOT_FINISHED_DETAIL(1),
      copy.PACK_NOT_FINISHED_DETAIL(3),
      copy.PACK_NOT_FINISHED_NEXT,
      copy.NOTHING_TO_REHEARSE,
      copy.NOTHING_TO_REHEARSE_DETAIL('Kalorama', '3 March 2026'),
      copy.NOTHING_TO_REHEARSE_NEXT,
      copy.PACK_COULD_NOT_BE_READ,
      copy.PACK_COULD_NOT_BE_READ_DETAIL('the saved places'),
      copy.PACK_STORE_UNREADABLE_DETAIL,
      copy.PACK_COULD_NOT_BE_READ_NEXT,
      copy.NO_PACK_TO_REHEARSE,
      copy.NO_PACK_ELSEWHERE,
      copy.NO_PACK_TO_REHEARSE_DETAIL,
      copy.NO_PACK_OTHERS_DETAIL(1),
      copy.NO_PACK_OTHERS_DETAIL(4),
      copy.REHEARSAL_READY_PLACEHOLDER('Kalorama'),
      copy.REHEARSE_THIS_PACK,
      copy.REHEARSAL_LABEL,
    ].join(' ');
    expect(everyLine).not.toMatch(/\byou (are|aren't|are not|were) (not )?(ready|prepared)\b/i);
    expect(everyLine).not.toMatch(/\bunprepared\b|\bnot ready\b/i);
  });

  it('names what is missing rather than reporting an unspecified problem', () => {
    expect(copy.PACK_COULD_NOT_BE_READ_DETAIL(copy.AND_LIST(['the saved places']))).toContain(
      'the saved places',
    );
    expect(
      copy.PACK_COULD_NOT_BE_READ_DETAIL(
        copy.AND_LIST([
          copy.UNREADABLE_PART_NAMES['stored-items'],
          copy.UNREADABLE_PART_NAMES['saved-places'],
        ]),
      ),
    ).toContain('the stored information items and the saved places');
  });

  it('the part list reads as a sentence for one, two or three parts', () => {
    expect(copy.AND_LIST([])).toBe('');
    expect(copy.AND_LIST(['one'])).toBe('one');
    expect(copy.AND_LIST(['one', 'two'])).toBe('one and two');
    expect(copy.AND_LIST(['one', 'two', 'three'])).toBe('one, two and three');
  });

  // The gate never asks for either line with a count of zero, so these guard
  // the caller that forgets rather than the caller that exists: "0 packs were
  // started" is a sentence no user should ever be able to reach.
  it('neither count line can render a zero', () => {
    expect(copy.PACK_NOT_FINISHED_DETAIL(0)).toBe(copy.PACK_NOT_FINISHED_DETAIL(1));
    expect(copy.NO_PACK_OTHERS_DETAIL(0)).toBe(copy.NO_PACK_OTHERS_DETAIL(1));
    expect(copy.PACK_NOT_FINISHED_DETAIL(0)).not.toMatch(/\b0\b/);
    expect(copy.NO_PACK_OTHERS_DETAIL(0)).not.toMatch(/\b0\b/);
  });

  it('counts read as sentences in both the single and the plural case', () => {
    expect(copy.PACK_NOT_FINISHED_DETAIL(1)).toContain('One pack was started');
    expect(copy.PACK_NOT_FINISHED_DETAIL(2)).toContain('2 packs were started');
    expect(copy.PACK_NOT_FINISHED_DETAIL(3)).toContain('3 packs were started');
    expect(copy.PACK_NOT_FINISHED_DETAIL(21)).toContain('21 packs were started');
    expect(copy.NO_PACK_OTHERS_DETAIL(1)).toContain('One other pack is saved');
    expect(copy.NO_PACK_OTHERS_DETAIL(2)).toContain('2 other packs are saved');
    expect(copy.NO_PACK_OTHERS_DETAIL(4)).toContain('4 other packs are saved');
  });

  it('the ready state promises no rehearsal it does not yet run', () => {
    expect(copy.REHEARSAL_READY_PLACEHOLDER('Kalorama')).toContain('Kalorama');
    expect(copy.NOTHING_TO_REHEARSE_DETAIL('Kalorama', '3 March 2026')).toContain('3 March 2026');
  });
});
