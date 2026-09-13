import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import * as copy from '../../core/copy';
import { rehearsalGate, type RehearsalGate, type RehearsalInput } from '../../core/rehearsal-entry';
import type { RehearsalCondition } from '../../core/rehearsal-condition';
import { isRunFor } from '../../core/rehearsal-run';
import type { UnfinishedRehearsal } from '../../core/types';
import { findUnfinishedRehearsal, readRehearsalSource } from '../../data/db';
import Condition from './Condition';
import { JourneyBefore, JourneyRunning } from './Journey';
import Result from './Result';
import Run from './Run';
import Unfinished from './Unfinished';
import { useRehearsalRun } from './run-state';
import StatusPage from '../components/StatusPage';

type EntryProps = {
  packId: string;
  loadSource?: (packId: string) => Promise<Omit<RehearsalInput, 'now'>>;
  loadUnfinished?: (packId: string) => Promise<UnfinishedRehearsal | null>;
  now?: number;
};

/** E5-US1-AC4 — the gate a rehearsal is entered through.
 *
 *  Four of the five states stop here, and each has its own screen saying what
 *  is missing from the pack and what would make a rehearsal possible. None of
 *  them writes anything: nothing on this screen creates a rehearsal record,
 *  because in four of these states there is no rehearsal to record.
 *
 *  ponytail: the only way in is one link on the pack page, so the gate is
 *  always asked about a pack the user just had open, and there is no picker
 *  and no home-screen entry; upgrade path: the entry design Sharon has yet to
 *  make, which is also what decides whether a rehearsal can be started for a
 *  pack other than the one on screen.
 *
 *  Every sentence is about the PACK. A pack that was not finished is a fact
 *  about a download that stopped, and this screen never turns it into a
 *  statement about the person reading it. */
export default function RehearsalEntry({
  packId,
  loadSource = readRehearsalSource,
  loadUnfinished = findUnfinishedRehearsal,
  now = Date.now(),
}: EntryProps) {
  // null = the store has not answered yet. It answers in a frame or two from
  // local IndexedDB, so nothing is drawn for the wait.
  const [gate, setGate] = useState<RehearsalGate | null>(null);
  // A run in progress, if there is one. Dies with the page, so a cold start
  // finds none.
  const run = useRehearsalRun();
  // E5-US1-AC5 — the condition she has chosen and not yet gone on. Setup, not
  // commitment: held by this screen alone, never written and never held beyond
  // it, so a curious tap leaves nothing behind once she leaves the screen.
  const [chosen, setChosen] = useState<RehearsalCondition | null>(null);
  // E5-US1-AC5 — a kept rehearsal still waiting for its ending. Read whenever no
  // run is in memory: on opening, and again when a run ends, so leaving a run
  // without an ending comes straight back to the question. undefined = not read
  // yet, and nothing is drawn for that wait. A read that fails finds nothing to
  // ask about, which decides no ending.
  const [unfinished, setUnfinished] = useState<UnfinishedRehearsal | null | undefined>(undefined);
  const runId = run?.id ?? null;

  useEffect(() => {
    if (runId !== null) return;
    let live = true;
    setUnfinished(undefined);
    loadUnfinished(packId).then(
      (row) => {
        if (live) setUnfinished(row);
      },
      () => {
        if (live) setUnfinished(null);
      },
    );
    return () => {
      live = false;
    };
  }, [loadUnfinished, packId, runId]);

  useEffect(() => {
    let live = true;
    loadSource(packId).then((source) => {
      if (live) setGate(rehearsalGate({ now, ...source }));
    });
    return () => {
      live = false;
    };
  }, [loadSource, packId, now]);

  if (gate === null) return null;

  // E5-US1-AC1 — a pack that CAN be rehearsed goes to the choice of condition.
  // The gate decides first and this is its only readable outcome, so a pack
  // that cannot be rehearsed never reaches an empty choice: it gets one of the
  // four stated screens below instead.
  //
  // E5-US1-AC3 — unless a rehearsal for THIS pack is already running, in which
  // case the user is coming back to it and it continues, bar and condition
  // intact. Leaving the screen never asked the rehearsal to end, so it did not.
  //
  // E5-US1-AC5 — the rehearsal is the journey. A running one shows the journey
  // screen, with the bar, until she gives it an ending; then the result.
  //
  // With no run in memory, a kept rehearsal that has no ending is asked about
  // before anything else: a new one cannot start over the top of it, and it is
  // never resumed as though it were still running. After that, a condition
  // chosen and not yet gone on; and after that, the choice itself.
  if (gate.state === 'ready') {
    if (isRunFor(run, gate.packId) && run !== null) {
      return (
        <Run run={run}>
          {run.ending ? <Result run={run} /> : <JourneyRunning run={run} />}
        </Run>
      );
    }
    if (unfinished === undefined) return null;
    if (unfinished !== null && unfinished.packId === gate.packId) {
      return <Unfinished rehearsal={unfinished} />;
    }
    return chosen !== null ? (
      <JourneyBefore packId={gate.packId} condition={chosen} onGone={() => setChosen(null)} />
    ) : (
      <Condition packId={gate.packId} onChoose={setChosen} />
    );
  }

  // The pack the user came from, offered only where the gate actually read one.
  // A store that could not be opened knows of no pack, so it offers no way back
  // to one: a link to a pack nothing could read would be a promise about data
  // this screen has just said it cannot see.
  const returnPackId =
    gate.state === 'nothing-to-rehearse' || gate.state === 'unreadable' ? gate.packId : null;

  return (
    <StatusPage
      page="rehearsal-entry"
      kicker={copy.REHEARSAL_LABEL}
      card={
        <>
          <h2>{heading(gate)}</h2>
          {detail(gate).map((line) => (
            <p key={line}>{line}</p>
          ))}
        </>
      }
      // The order is the order of what the reader most likely wants. They
      // arrived from the pack page one tap ago, so going back to that pack
      // comes first; building is what would make a rehearsal possible, so it
      // comes second and carries the accent; Home is the escape and stays last,
      // where it is on every other screen in the app.
      actions={
        <>
          {returnPackId ? (
            <Link className="action" to={`/packs/${returnPackId}`}>
              {copy.BACK_TO_THIS_PACK}
            </Link>
          ) : null}
          <Link className={buildingIsTheFix(gate) ? 'action main-action' : 'action'} to="/packs/new">
            {copy.BUILD_A_PACK}
          </Link>
        </>
      }
    />
  );
}

/** Whether building is the thing that would fix THIS state.
 *
 *  The accent means one thing across the gate: this is what would fix it. In
 *  three states building is exactly that. In 'nothing to rehearse' it is not:
 *  that state's own words say building helps only "once the official
 *  information covers this address", so building today changes nothing, and it
 *  would be the one action wearing the accent while being the one action that
 *  does not help.
 *
 *  That state therefore runs all three actions neutral rather than moving the
 *  accent onto going back. Moving it would make the accent mean "the fix" on
 *  one screen and "the way back" on the next, and there is no fix here to point
 *  at. A screen with no filled control is what this stylesheet already allows:
 *  .main-action is "the one filled control on a screen", not a required one. */
function buildingIsTheFix(gate: Exclude<RehearsalGate, { state: 'ready' }>): boolean {
  return gate.state !== 'nothing-to-rehearse';
}

/** What each stopped state is called. The two that are most easily confused
 *  carry deliberately unlike headings: one is about a build that stopped, the
 *  other about stored content that cannot be read back. */
function heading(gate: Exclude<RehearsalGate, { state: 'ready' }>): string {
  switch (gate.state) {
    case 'incomplete':
      return copy.PACK_NOT_FINISHED;
    case 'nothing-to-rehearse':
      return copy.NOTHING_TO_REHEARSE;
    case 'unreadable':
      return copy.PACK_COULD_NOT_BE_READ;
    default:
      return gate.otherCompletePacks > 0 ? copy.NO_PACK_ELSEWHERE : copy.NO_PACK_TO_REHEARSE;
  }
}

/** What is missing, then what would make a rehearsal possible. Both are named;
 *  neither is left as an unspecified problem. */
function detail(gate: Exclude<RehearsalGate, { state: 'ready' }>): string[] {
  switch (gate.state) {
    case 'incomplete':
      return [
        copy.PACK_NOT_FINISHED_DETAIL(gate.unfinishedCount),
        copy.PACK_NOT_FINISHED_NEXT,
      ];
    case 'nothing-to-rehearse':
      return [
        copy.NOTHING_TO_REHEARSE_DETAIL(gate.packName, gate.savedOn),
        copy.NOTHING_TO_REHEARSE_NEXT,
      ];
    case 'unreadable':
      return [
        gate.parts.includes('the-whole-pack')
          ? copy.PACK_STORE_UNREADABLE_DETAIL
          : copy.PACK_COULD_NOT_BE_READ_DETAIL(
              copy.AND_LIST(gate.parts.map((part) => copy.UNREADABLE_PART_NAMES[part])),
            ),
        copy.PACK_COULD_NOT_BE_READ_NEXT,
      ];
    default:
      return gate.otherCompletePacks > 0
        ? [copy.NO_PACK_OTHERS_DETAIL(gate.otherCompletePacks), copy.NO_PACK_TO_REHEARSE_DETAIL]
        : [copy.NO_PACK_TO_REHEARSE_DETAIL];
  }
}
