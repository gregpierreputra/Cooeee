import { describe, expect, it } from 'vitest';
import {
  firstUtterance,
  isMoving,
  nextUtterance,
  shouldStayAwake,
  sideOf,
  type VoiceRecord,
  type VoiceState,
} from '../../src/core/blacksky-voice';
import {
  AT_PLACE_M,
  AWAKE_MOVING_MPS,
  VOICE_MILESTONES_M,
  VOICE_MIN_GAP_MS,
  VOICE_SIDE_DWELL_MS,
  VOICE_SILENCE_MS,
} from '../../src/core/constants';

const T0 = 1_800_000_000_000;
const GAP = VOICE_MIN_GAP_MS;

const state = (over: Partial<VoiceState> = {}): VoiceState => ({
  placeId: 'nsp-hall',
  site: 'Community Hall',
  point: 'North-east',
  distanceM: 12_100,
  about: false,
  signalLost: false,
  side: 'right',
  moving: true,
  ...over,
});

/** Voice turned on at T0 with `first`, then each step fed in order. Returns the
 *  text spoken at each step, or null, so a whole drive reads as one array. */
const drive = (first: VoiceState, steps: { at: number; state: VoiceState }[]) => {
  let record: VoiceRecord = firstUtterance(T0, first).record;
  return steps.map(({ at, state: s }) => {
    const step = nextUtterance(record, T0 + at, s);
    record = step.record;
    return step.utterance?.text ?? null;
  });
};

describe('which side the place is on', () => {
  it('splits the circle into four quarters, each edge opening the next quarter', () => {
    expect(sideOf(0)).toBe('ahead');
    expect(sideOf(44.9)).toBe('ahead');
    expect(sideOf(45)).toBe('right');
    expect(sideOf(134.9)).toBe('right');
    expect(sideOf(135)).toBe('behind');
    expect(sideOf(224.9)).toBe('behind');
    expect(sideOf(225)).toBe('left');
    expect(sideOf(314.9)).toBe('left');
    expect(sideOf(315)).toBe('ahead');
    expect(sideOf(360)).toBe('ahead');
    expect(sideOf(-90)).toBe('left');
  });

  it('claims no side when nothing is turning the dial', () => {
    expect(sideOf(null)).toBeNull();
  });
});

describe('the first message', () => {
  it('is the long form: site name, place of last resort, distance, compass point, side', () => {
    const { utterance } = firstUtterance(T0, state());
    expect(utterance).toEqual({
      reason: 'first',
      text: 'Community Hall, place of last resort. 12.1 kilometres. North-east. On your right.',
      cutIn: true,
    });
  });

  it('leaves the side out when the dial is north up', () => {
    expect(firstUtterance(T0, state({ side: null })).utterance!.text).toBe(
      'Community Hall, place of last resort. 12.1 kilometres. North-east.',
    );
  });

  it('says about, and says the signal is lost, when that is what the screen shows', () => {
    const step = firstUtterance(T0, state({ about: true, signalLost: true, distanceM: 500 }));
    expect(step.utterance!.text).toBe(
      'GPS signal lost. Community Hall, place of last resort. About 500 metres. North-east. On your right.',
    );
    // Already said, so the rule does not say it again a second later.
    expect(nextUtterance(step.record, T0 + 1_000, state({ about: true, signalLost: true })).utterance).toBeNull();
  });
});

describe('milestones', () => {
  it('the milestones are 10, 5, 2 and 1 km, then 500, 200 and 100 m', () => {
    expect([...VOICE_MILESTONES_M]).toEqual([10_000, 5_000, 2_000, 1_000, 500, 200, 100]);
  });

  it('each one speaks the short form once as it is passed going in', () => {
    const inside = VOICE_MILESTONES_M.map((m) => m - 1);
    const spoken = drive(
      state(),
      inside.flatMap((distanceM, i) => [
        { at: (2 * i + 1) * GAP, state: state({ distanceM }) },
        { at: (2 * i + 2) * GAP, state: state({ distanceM: distanceM - 1 }) }, // further in: nothing new
      ]),
    );
    expect(spoken).toEqual([
      '10 kilometres. North-east. On your right.', null,
      '5 kilometres. North-east. On your right.', null,
      '2 kilometres. North-east. On your right.', null,
      '1 kilometre. North-east. On your right.', null,
      '500 metres. North-east. On your right.', null,
      '200 metres. North-east. On your right.', null,
      '100 metres. North-east. On your right.', null,
    ]);
  });

  it('each one speaks once as it is passed going out', () => {
    const outside = [...VOICE_MILESTONES_M].reverse().map((m) => Math.round(m * 1.06));
    const spoken = drive(
      state({ distanceM: 60 }),
      outside.map((distanceM, i) => ({ at: (i + 1) * GAP, state: state({ distanceM }) })),
    );
    expect(spoken).toEqual([
      '110 metres. North-east. On your right.',
      '210 metres. North-east. On your right.',
      '530 metres. North-east. On your right.',
      '1.1 kilometres. North-east. On your right.',
      '2.1 kilometres. North-east. On your right.',
      '5.3 kilometres. North-east. On your right.',
      '10.6 kilometres. North-east. On your right.',
    ]);
  });

  it('a position wandering either side of a milestone does not repeat it', () => {
    const spoken = drive(state({ distanceM: 5_100 }), [
      { at: 1 * GAP, state: state({ distanceM: 4_990 }) }, // passed: spoken
      { at: 2 * GAP, state: state({ distanceM: 5_010 }) }, // back over the line, inside the margin
      { at: 3 * GAP, state: state({ distanceM: 4_990 }) },
      { at: 4 * GAP, state: state({ distanceM: 5_240 }) }, // still inside the margin
      { at: 5 * GAP, state: state({ distanceM: 5_260 }) }, // truly passed going out
      { at: 6 * GAP, state: state({ distanceM: 4_990 }) }, // wandering back: inside the margin
      { at: 7 * GAP, state: state({ distanceM: 4_740 }) }, // truly passed going in
    ]);
    expect(spoken).toEqual([
      '5 kilometres. North-east. On your right.',
      null,
      null,
      null,
      '5.3 kilometres. North-east. On your right.',
      null,
      '4.7 kilometres. North-east. On your right.',
    ]);
  });

  it('several milestones passed at once are one message', () => {
    expect(drive(state(), [{ at: GAP, state: state({ distanceM: 1_500 }) }])).toEqual([
      '1.5 kilometres. North-east. On your right.',
    ]);
  });
});

describe('the minimum gap', () => {
  it('holds a milestone back until the gap is over, then says it', () => {
    const spoken = drive(state({ distanceM: 5_100 }), [
      { at: GAP - 1, state: state({ distanceM: 4_900 }) },
      { at: GAP, state: state({ distanceM: 4_800 }) },
    ]);
    expect(spoken).toEqual([null, '4.8 kilometres. North-east. On your right.']);
  });

  it('says nothing for a milestone passed and passed back inside the gap', () => {
    const spoken = drive(state({ distanceM: 5_100 }), [
      { at: 5_000, state: state({ distanceM: 4_900 }) },
      { at: GAP, state: state({ distanceM: 5_100 }) },
    ]);
    expect(spoken).toEqual([null, null]);
  });
});

describe('GPS signal lost', () => {
  it('cuts in ahead of anything, ignoring the gap, and is said once', () => {
    const first = firstUtterance(T0, state());
    const lost = nextUtterance(first.record, T0 + 1_000, state({ signalLost: true, about: true }));
    expect(lost.utterance).toEqual({ reason: 'signal-lost', text: 'GPS signal lost.', cutIn: true });
    expect(
      nextUtterance(lost.record, T0 + 10 * GAP, state({ signalLost: true, about: true })).utterance,
    ).toBeNull();
  });

  it('beats a milestone that is waiting', () => {
    const spoken = drive(state({ distanceM: 5_100 }), [
      { at: 5_000, state: state({ distanceM: 4_900 }) }, // waiting out the gap
      { at: 6_000, state: state({ distanceM: 4_900, signalLost: true, about: true }) },
    ]);
    expect(spoken).toEqual([null, 'GPS signal lost.']);
  });

  it('says nothing else while lost, then says the return with the current figures', () => {
    const spoken = drive(state({ distanceM: 5_100 }), [
      { at: GAP, state: state({ distanceM: 5_100, signalLost: true, about: true }) },
      { at: 2 * GAP, state: state({ distanceM: 5_100, signalLost: true, about: true, side: 'left' }) },
      { at: 2 * GAP + 1_000, state: state({ distanceM: 4_200 }) }, // back, inside the gap all the same
      { at: 4 * GAP, state: state({ distanceM: 4_100 }) }, // the milestone went with the return
    ]);
    expect(spoken).toEqual([
      'GPS signal lost.',
      null,
      'GPS signal is back. 4.2 kilometres. North-east. On your right.',
      null,
    ]);
  });
});

describe('a change of side', () => {
  const DWELL = VOICE_SIDE_DWELL_MS;

  it('is spoken only once it has stayed for the dwell time', () => {
    const spoken = drive(state(), [
      { at: GAP, state: state({ side: 'left' }) },
      { at: GAP + DWELL - 1, state: state({ side: 'left' }) },
      { at: GAP + DWELL, state: state({ side: 'left' }) },
      { at: 3 * GAP, state: state({ side: 'left' }) },
    ]);
    expect(spoken).toEqual([null, null, '12.1 kilometres. North-east. On your left.', null]);
  });

  it('a side that flickers and comes back is never spoken', () => {
    const spoken = drive(state(), [
      { at: GAP, state: state({ side: 'left' }) },
      { at: GAP + 2_000, state: state({ side: 'right' }) },
      { at: GAP + 4_000, state: state({ side: 'left' }) },
      { at: GAP + 6_000, state: state({ side: 'ahead' }) }, // a different side restarts the dwell
      { at: GAP + 8_000, state: state({ side: 'right' }) },
      { at: GAP + 20_000, state: state({ side: 'right' }) },
    ]);
    expect(spoken).toEqual([null, null, null, null, null, null]);
  });

  it('no side is claimed or compared while the dial is north up', () => {
    const spoken = drive(state(), [
      { at: GAP, state: state({ side: null }) },
      { at: 2 * GAP, state: state({ side: null }) },
      { at: 3 * GAP, state: state({ side: null, distanceM: 9_900 }) },
      { at: 4 * GAP, state: state({ side: 'right', distanceM: 9_900 }) }, // same side as last spoken
    ]);
    expect(spoken).toEqual([null, null, '9.9 kilometres. North-east.', null]);
  });
});

describe('at the place', () => {
  it('is said once, and nothing more is said while there', () => {
    const spoken = drive(state({ distanceM: 150 }), [
      { at: 1 * GAP, state: state({ distanceM: AT_PLACE_M }) },
      { at: 2 * GAP, state: state({ distanceM: 30, side: 'behind' }) },
      { at: 3 * GAP, state: state({ distanceM: 49, side: 'behind' }) },
      { at: 2 * VOICE_SILENCE_MS, state: state({ distanceM: 20, side: 'left' }) },
    ]);
    expect(spoken).toEqual(['Community Hall is within 50 metres.', null, null, null]);
  });

  it('is news again only after the person has left, past the innermost milestone', () => {
    const spoken = drive(state({ distanceM: 150 }), [
      { at: 1 * GAP, state: state({ distanceM: 40 }) },
      { at: 2 * GAP, state: state({ distanceM: 60 }) }, // wandering at the edge: not a leaving
      { at: 3 * GAP, state: state({ distanceM: 40 }) },
      { at: 4 * GAP, state: state({ distanceM: 120 }) }, // left, past 100 m
      { at: 5 * GAP, state: state({ distanceM: 40 }) },
    ]);
    expect(spoken).toEqual([
      'Community Hall is within 50 metres.',
      null,
      null,
      '120 metres. North-east. On your right.',
      'Community Hall is within 50 metres.',
    ]);
  });

  it('turning voice on at the place does not say it a second time', () => {
    expect(drive(state({ distanceM: 30 }), [{ at: GAP, state: state({ distanceM: 30 }) }])).toEqual([null]);
  });
});

describe('silence', () => {
  it('after the silence limit, while moving, the figures are said once', () => {
    const spoken = drive(state(), [
      { at: VOICE_SILENCE_MS, state: state() },
      { at: VOICE_SILENCE_MS + 1, state: state() },
      { at: VOICE_SILENCE_MS + 2_000, state: state() },
    ]);
    expect(spoken).toEqual([null, '12.1 kilometres. North-east. On your right.', null]);
  });

  it('still and unchanged says nothing, however long', () => {
    const still = state({ moving: false });
    const spoken = drive(still, [
      { at: GAP, state: still },
      { at: VOICE_SILENCE_MS + 1, state: still },
      { at: 10 * VOICE_SILENCE_MS, state: still },
    ]);
    expect(spoken).toEqual([null, null, null]);
  });
});

describe('the main place changes, or the person comes back to the page', () => {
  it('another main place is introduced with the long form, after the gap', () => {
    const other = state({ placeId: 'nsp-oval', site: 'Recreation Reserve Oval', distanceM: 3_400, side: 'behind' });
    const spoken = drive(state(), [
      { at: 1_000, state: other },
      { at: GAP, state: other },
      { at: 2 * GAP, state: other },
    ]);
    expect(spoken).toEqual([
      null,
      'Recreation Reserve Oval, place of last resort. 3.4 kilometres. North-east. Behind you.',
      null,
    ]);
  });

  it('coming back to the page says the current figures once, never inside the gap', () => {
    expect(drive(state(), [{ at: 1_000, state: state({ returned: true }) }])).toEqual([null]);
    const spoken = drive(state(), [
      { at: 6 * GAP, state: state({ returned: true, distanceM: 11_800, moving: false }) },
      { at: 7 * GAP, state: state({ distanceM: 11_800, moving: false }) },
    ]);
    expect(spoken).toEqual(['11.8 kilometres. North-east. On your right.', null]);
  });

  it('coming back to an old position says the signal is lost instead', () => {
    expect(
      drive(state(), [{ at: 6 * GAP, state: state({ returned: true, signalLost: true, about: true }) }]),
    ).toEqual(['GPS signal lost.']);
  });
});

describe('when the screen is kept awake', () => {
  it('moving is faster than the limit, and a missing speed is not movement', () => {
    expect(AWAKE_MOVING_MPS).toBe(1);
    expect(isMoving(1)).toBe(false);
    expect(isMoving(1.01)).toBe(true);
    expect(isMoving(0)).toBe(false);
    expect(isMoving(null)).toBe(false);
    expect(isMoving(undefined)).toBe(false);
    expect(isMoving(Number.NaN)).toBe(false);
  });

  it('truth table: awake when voice is on or the person is moving', () => {
    expect(shouldStayAwake(false, 0)).toBe(false);
    expect(shouldStayAwake(false, null)).toBe(false);
    expect(shouldStayAwake(false, 5)).toBe(true);
    expect(shouldStayAwake(true, 0)).toBe(true);
    expect(shouldStayAwake(true, undefined)).toBe(true);
    expect(shouldStayAwake(true, 5)).toBe(true);
  });
});
