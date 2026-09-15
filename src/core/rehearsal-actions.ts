// E5-US2-AC1 — the predefined gap-to-action map (decision D-D, 10 September).
//
// Exactly one action for every gap: never two, and never none. That is enforced
// by the TYPE, not by a check at render time — the maps below are
// Record<RehearsalGapType, …>, so a gap type added without an action, or with a
// second one, does not compile. A gap left without an action would be a gap
// presented as an unexplained failure, which is the thing this criterion exists
// to prevent.
//
// The actions are written once, here, and are the same words every time. They
// are not generated, not chosen from alternatives, and never say the missing
// capability has come back.

import * as copy from './copy';
import type { DetectedGap, RehearsalGapKind, RehearsalGapType } from './types';

/** Which kind each gap is. Read by the checks when they raise a gap, so the
 *  kind can never disagree with the type it belongs to. */
export const GAP_KIND: Record<RehearsalGapType, RehearsalGapKind> = {
  'designation-missing': 'pack-content',
  'places-missing': 'pack-content',
  'provenance-missing': 'pack-content',
  'live-direction-unavailable': 'condition-persistent',
};

/** The stable id of the one action for each gap. Written into the completion
 *  record, so a rename is a migration rather than an edit. */
export const GAP_ACTION_ID: Record<RehearsalGapType, string> = {
  'designation-missing': 'build-pack-again-for-designation',
  'places-missing': 'build-pack-again-for-places',
  'provenance-missing': 'build-pack-again-for-provenance',
  'live-direction-unavailable': 'write-the-way-down',
};

/** What each gap is, in the reader's words: the thing they could not rely on. */
export const GAP_TITLE: Record<RehearsalGapType, string> = {
  'designation-missing': copy.GAP_DESIGNATION,
  'places-missing': copy.GAP_PLACES,
  'provenance-missing': copy.GAP_PROVENANCE,
  'live-direction-unavailable': copy.GAP_LIVE_DIRECTION,
};

/** The one written action. */
const GAP_ACTION: Record<RehearsalGapType, string> = {
  'designation-missing': copy.ACTION_BUILD_AGAIN_DESIGNATION,
  'places-missing': copy.ACTION_BUILD_AGAIN_PLACES,
  'provenance-missing': copy.ACTION_BUILD_AGAIN_PROVENANCE,
  'live-direction-unavailable': copy.ACTION_WRITE_THE_WAY_DOWN,
};

/** What the kind means, in plain language. The two kinds are told apart by
 *  these words and by nothing else: no severity, no ranking, no separate list,
 *  no colour. */
const KIND_MEANING: Record<RehearsalGapKind, string> = {
  'pack-content': copy.GAP_MEANING_PACK_CONTENT,
  'condition-persistent': copy.GAP_MEANING_CONDITION,
};

export type GapAction = {
  actionId: string;
  /** What could not be relied on. */
  title: string;
  /** Which of the two kinds this is, said in words. */
  meaning: string;
  /** The one thing to do about it. */
  action: string;
};

/** The action for a gap. Total over every gap type by construction. */
export const actionFor = (detected: DetectedGap): GapAction => ({
  actionId: GAP_ACTION_ID[detected.gapType],
  title: GAP_TITLE[detected.gapType],
  meaning: KIND_MEANING[detected.kind],
  action: GAP_ACTION[detected.gapType],
});
