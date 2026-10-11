import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import * as copy from '../../core/copy';
import { blockTileView } from '../../core/block';
import { melbourneDay } from '../../core/day';
import { rulesFor, twistForDay } from '../../core/drill-twists';
import type { BlockPlay, WordDay } from '../../core/types';
import { wordTileView } from '../../core/word';
import { listBlockPlays, listWordDays } from '../../data/db';
import DrillTile from '../Drill/DrillTile';
import { pinnedTwist } from '../Drill/drill-state';
import { useMinuteClock } from '../components/useMinuteClock';
import GameTile from './GameTile';

type Props = {
  onDrill: () => void;
  /** Injectable for tests: where the cards read the games' records. */
  loadWord?: () => Promise<WordDay[]>;
  loadBlock?: () => Promise<BlockPlay[]>;
  /** A fixed time, for tests. */
  now?: number;
};

/** The three games on the Rehearse screens, the drill first. The word and
 *  block cards say where each stands today; the drill's says its twist. */
export default function GameTiles({ onDrill, loadWord = listWordDays, loadBlock = listBlockPlays, now }: Props) {
  const navigate = useNavigate();
  const clock = useMinuteClock(now);
  const today = melbourneDay(clock);
  const [words, setWords] = useState<WordDay[]>([]);
  const [plays, setPlays] = useState<BlockPlay[]>([]);

  useEffect(() => {
    let live = true;
    // A store that cannot be read shows each card as never played.
    loadWord().then(
      (rows) => {
        if (live) setWords(rows);
      },
      () => undefined,
    );
    loadBlock().then(
      (rows) => {
        if (live) setPlays(rows);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [loadWord, loadBlock]);

  const rules = rulesFor(pinnedTwist() ?? twistForDay(today).id);
  const twist =
    rules.twist === 'classic'
      ? null
      : { name: rules.name, daysLeft: twistForDay(today).daysLeft, seconds: rules.seconds, bag: rules.bagLimit };
  const word = wordTileView(words, today);
  const block = blockTileView(plays, today);
  const wordToday = word.today === 'in-progress' ? copy.WORD_TILE_TODAY['in-progress'](word.guessesUsed) : copy.WORD_TILE_TODAY[word.today];

  return (
    <div className="game-tiles">
      <DrillTile onPlay={onDrill} twist={twist} />
      <GameTile
        variant="word"
        glyph="word"
        title={copy.WORD_TILE_TITLE}
        detail={copy.WORD_TILE_COUNTS(word.streak, word.played)}
        status={wordToday}
        onPlay={() => navigate('/rehearse/word')}
      />
      <GameTile
        variant="block"
        glyph="block"
        title={copy.BLOCK_TILE_TITLE}
        detail={copy.BLOCK_TILE_DETAIL}
        status={copy.BLOCK_TILE_STATUS(block.today, block.highest)}
        onPlay={() => navigate('/rehearse/block')}
      />
    </div>
  );
}
