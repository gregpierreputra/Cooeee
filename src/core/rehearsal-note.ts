// E5-US1-AC5 — her note about the way.
//
// After a walked rehearsal she may write what she learnt about the way: the
// things the app cannot tell her. It becomes an ordinary note in this pack, so
// BlackSky reads it back to her on the day, with the network gone. It belongs to
// the pack and not to the rehearsal, as a completion does: it is read on the day,
// not in a rehearsal. It carries no mark of where it was written, and nothing
// judges, counts or summarises it.

import type { PackNote, Rehearsal } from './types';

/** Whether the result offers her a note about the way: after a walked rehearsal
 *  only. A dry run took no way to say anything about, and the pack's own notes
 *  are there for anything else. */
export const offersWayNote = (rehearsal: Pick<Rehearsal, 'ending'>): boolean =>
  rehearsal.ending === 'walked';

/** Her note, as an ordinary pack note: her words as she wrote them, and nothing
 *  added to them. The write goes through putNote, which applies the one rule
 *  every note follows. */
export const wayNote = (packId: string, text: string, id: string, updatedAt: number): PackNote => ({
  id,
  packId,
  text,
  updatedAt,
});
