import {
  AT_PLACE_M,
  AWAKE_MOVING_MPS,
  VOICE_MILESTONES_M,
  VOICE_MILESTONE_MARGIN,
  VOICE_MIN_GAP_MS,
  VOICE_SIDE_DWELL_MS,
  VOICE_SIDE_EDGES_DEG,
  VOICE_SILENCE_MS,
} from './constants';
import * as copy from './copy';

// When the phone speaks, and what it says (BS_Enhancement-AC3), and when the
// screen is kept awake (BS_Enhancement-AC4). Pure: the time, the record of what
// was last said and what the screen knows now all come in as arguments. The
// speaking itself, and the wake lock, belong to the UI layer.
//
// The aim is a voice a driver can ignore until it matters: it speaks when
// something has changed, never more often than the minimum gap, and says
// nothing at all while the person is still and nothing has changed.

export type Side = 'ahead' | 'right' | 'behind' | 'left';

/** Which side of the person the place is on, from the bearing relative to the
 *  top of the phone (0 is dead ahead, 90 the right-hand side). Null in, null
 *  out: with nothing turning the dial nobody knows which way the person faces,
 *  so no side is claimed and the sentence leaves it out. */
export function sideOf(relativeBearingDeg: number | null): Side | null {
  if (relativeBearingDeg === null) return null;
  const deg = ((relativeBearingDeg % 360) + 360) % 360;
  const { ahead, behind } = VOICE_SIDE_EDGES_DEG;
  if (deg < ahead || deg >= 360 - ahead) return 'ahead';
  if (deg < behind) return 'right';
  if (deg < 360 - behind) return 'behind';
  return 'left';
}

/** Faster than AWAKE_MOVING_MPS. A speed the browser did not give, or gave as
 *  NaN, is not movement. */
export const isMoving = (speedMps: number | null | undefined): boolean =>
  typeof speedMps === 'number' && Number.isFinite(speedMps) && speedMps > AWAKE_MOVING_MPS;

/** BS_Enhancement-AC4: the screen is kept awake while voice is on (a driver is
 *  listening, not touching the phone) or the person is moving. Still and
 *  silent, the phone sleeps on its own timer. */
export const shouldStayAwake = (voiceOn: boolean, speedMps: number | null | undefined): boolean =>
  voiceOn || isMoving(speedMps);

/** What the screen knows at this moment, in the terms the voice speaks. */
export type VoiceState = {
  placeId: string;
  site: string;
  point: string; // the compass point by name, as shown
  distanceM: number;
  about: boolean; // the figure comes from an old, vague or estimated position
  signalLost: boolean; // the GPS signal lost bar is up
  side: Side | null;
  moving: boolean;
  returned?: boolean; // the person has just come back to the page (AC4)
};

/** What was last said, kept between calls. Everything the rule needs to say a
 *  thing once and only once lives here, so the rule itself holds no state. */
export type VoiceRecord = {
  placeId: string;
  spokenAt: number;
  band: number; // how many milestones the last SPOKEN distance was inside
  crossed: { milestone: number; inward: boolean } | null; // the last one passed, and which way
  side: Side | null; // the last side spoken
  pending: { side: Side; since: number } | null; // a new side, waiting out the dwell
  signalLost: boolean; // the loss has been said
  atPlace: boolean; // being at the place has been said
};

export type Utterance = {
  reason:
    | 'first'
    | 'signal-lost'
    | 'signal-back'
    | 'place-changed'
    | 'returned'
    | 'at-place'
    | 'side'
    | 'milestone'
    | 'silence';
  text: string;
  cutIn: boolean; // stop whatever is being said and say this now
};

export type VoiceStep = { utterance: Utterance | null; record: VoiceRecord };

// How many milestones a distance is inside. The milestone last passed moves its
// own line by the margin, away from the person, so a position wandering either
// side of it does not pass it again and again.
const bandOf = (distanceM: number, crossed: VoiceRecord['crossed']): number =>
  VOICE_MILESTONES_M.filter((milestone) => {
    const margin = crossed?.milestone === milestone ? milestone * VOICE_MILESTONE_MARGIN : 0;
    return distanceM < milestone + (crossed?.inward ? margin : -margin);
  }).length;

const shortForm = (state: VoiceState): string =>
  copy.VOICE_SHORT(
    copy.spokenDistance(state.distanceM),
    state.point,
    state.side ? copy.SPOKEN_SIDES[state.side] : null,
    state.about,
  );
const longForm = (state: VoiceState): string => copy.VOICE_LONG(state.site, shortForm(state));

// The record after a message that carried the distance and the side: both are
// now known to the listener, so neither is news until it changes again.
const afterSpeaking = (last: VoiceRecord, now: number, state: VoiceState): VoiceRecord => {
  const band = bandOf(state.distanceM, last.crossed);
  const crossed =
    band === last.band
      ? last.crossed
      : band > last.band
        ? { milestone: VOICE_MILESTONES_M[band - 1], inward: true }
        : { milestone: VOICE_MILESTONES_M[band], inward: false };
  return {
    ...last,
    spokenAt: now,
    band,
    crossed,
    side: state.side ?? last.side,
    pending: null,
  };
};

/** The first message, said inside the tap that turns voice on: the long form.
 *  If the signal is already lost the message opens by saying so, which is more
 *  honest than a confident sentence followed by a correction. */
export function firstUtterance(now: number, state: VoiceState): VoiceStep {
  const text = state.signalLost ? `${copy.VOICE_SIGNAL_LOST} ${longForm(state)}` : longForm(state);
  return {
    utterance: { reason: 'first', text, cutIn: true },
    record: {
      placeId: state.placeId,
      spokenAt: now,
      band: bandOf(state.distanceM, null),
      crossed: null,
      side: state.side,
      pending: null,
      signalLost: state.signalLost,
      atPlace: state.distanceM <= AT_PLACE_M,
    },
  };
}

/**
 * What to say now, or nothing, and the record to keep for next time.
 *
 * Reasons, first match wins:
 *   1 GPS signal lost, and its return. These two ignore the minimum gap, and the
 *     loss cuts in on whatever is being said: a figure that has just stopped
 *     being true must not be left hanging in the air. While the signal is lost
 *     nothing else is said, because nothing else can be trusted.
 *   2 the main place has changed (the person picked another with Show, or moved
 *     so that another chosen place is now the nearest): the long form again.
 *   3 the person has just come back to the page: the current figures, once.
 *   4 at the place, once. Close in, the side swings with every step and the
 *     distance is inside the position's own error, so nothing more is said
 *     until the person has left again.
 *   5 the place has moved to another side and stayed there for the dwell time.
 *   6 a milestone has been passed, in either direction, once per passing.
 *   7 nothing said for the silence limit, while moving.
 * Reasons 2 to 7 wait for the minimum gap. A milestone or a side change that
 * falls inside the gap is not lost: the record is left as it was, so the same
 * comparison fires as soon as the gap is over, if it is still true then.
 */
export function nextUtterance(last: VoiceRecord, now: number, state: VoiceState): VoiceStep {
  const say = (reason: Utterance['reason'], text: string, record: VoiceRecord): VoiceStep => ({
    utterance: { reason, text, cutIn: reason === 'signal-lost' },
    record,
  });

  // 1
  if (state.signalLost && !last.signalLost)
    return say('signal-lost', copy.VOICE_SIGNAL_LOST, { ...last, spokenAt: now, signalLost: true });
  if (state.signalLost) return { utterance: null, record: last };
  if (last.signalLost)
    return say('signal-back', copy.VOICE_SIGNAL_BACK(shortForm(state)), {
      ...afterSpeaking(last, now, state),
      signalLost: false,
    });

  // The dwell clock runs whether or not anything may be said yet. A side that
  // goes back to the one last spoken, or changes again, starts it over.
  const pending =
    state.side === null || state.side === last.side || last.side === null
      ? null
      : last.pending?.side === state.side
        ? last.pending
        : { side: state.side, since: now };
  // Having left the place again (past the innermost milestone), being at it is
  // news once more.
  const innermost = VOICE_MILESTONES_M[VOICE_MILESTONES_M.length - 1];
  const record: VoiceRecord = {
    ...last,
    pending,
    atPlace: last.atPlace && state.distanceM < innermost,
  };

  if (now - last.spokenAt < VOICE_MIN_GAP_MS) return { utterance: null, record };

  // 2
  if (state.placeId !== last.placeId) {
    const first = firstUtterance(now, state);
    return say('place-changed', first.utterance!.text, first.record);
  }
  // 3
  if (state.returned) return say('returned', shortForm(state), afterSpeaking(record, now, state));
  // 4
  if (state.distanceM <= AT_PLACE_M) {
    if (record.atPlace) return { utterance: null, record };
    return say('at-place', copy.VOICE_AT_PLACE(state.site, AT_PLACE_M), {
      ...afterSpeaking(record, now, state),
      atPlace: true,
    });
  }
  // 5
  if (pending && now - pending.since >= VOICE_SIDE_DWELL_MS)
    return say('side', shortForm(state), afterSpeaking(record, now, state));
  // 6
  if (bandOf(state.distanceM, record.crossed) !== record.band)
    return say('milestone', shortForm(state), afterSpeaking(record, now, state));
  // 7
  if (state.moving && now - last.spokenAt > VOICE_SILENCE_MS)
    return say('silence', shortForm(state), afterSpeaking(record, now, state));

  return { utterance: null, record };
}
