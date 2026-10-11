import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import * as copy from '../../core/copy';
import { blockTileView } from '../../core/block';
import { melbourneDay } from '../../core/day';
import { rulesFor, twistForDay } from '../../core/drill-twists';
import type { BlockPlay, Drill, WordDay } from '../../core/types';
import { solvedWeek, wordTileView } from '../../core/word';
import { listAllDrills, listBlockPlays, listWordDays } from '../../data/db';
import DrillTile from '../Drill/DrillTile';
import { pinnedTwist } from '../Drill/drill-state';
import { useMinuteClock } from '../components/useMinuteClock';
import GameTile from './GameTile';

type Props = {
  onDrill: () => void;
  /** Injectable for tests: where the cards read the games' records. */
  loadWord?: () => Promise<WordDay[]>;
  loadBlock?: () => Promise<BlockPlay[]>;
  loadDrills?: () => Promise<Drill[]>;
  /** A fixed time, for tests. */
  now?: number;
};

/** The three games on the Rehearse screens under their label, the drill
 *  first. Each card says where it stands in small pills: highest scores, the
 *  drill's twist, Word's streak and today, and a week of dots for Word. */
export default function GameTiles({ onDrill, loadWord = listWordDays, loadBlock = listBlockPlays, loadDrills = listAllDrills, now }: Props) {
  const navigate = useNavigate();
  const clock = useMinuteClock(now);
  const today = melbourneDay(clock);
  const [words, setWords] = useState<WordDay[]>([]);
  const [plays, setPlays] = useState<BlockPlay[]>([]);
  const [drills, setDrills] = useState<Drill[]>([]);

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
    loadDrills().then(
      (rows) => {
        if (live) setDrills(rows);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [loadWord, loadBlock, loadDrills]);

  const rules = rulesFor(pinnedTwist() ?? twistForDay(today).id);
  const twist =
    rules.twist === 'classic'
      ? null
      : { name: rules.name, daysLeft: twistForDay(today).daysLeft, seconds: rules.seconds, bag: rules.bagLimit };
  const word = wordTileView(words, today);
  const block = blockTileView(plays, today);
  const wordToday = word.today === 'in-progress' ? copy.WORD_TILE_TODAY['in-progress'](word.guessesUsed) : copy.WORD_TILE_TODAY[word.today];
  const week = solvedWeek(words, today);
  const drillHighest = drills.length === 0 ? null : Math.max(...drills.map((drill) => drill.score));

  return (
    <section className="game-tiles" aria-labelledby="games-title">
      <h2 id="games-title" className="kicker section-label">{copy.GAMES}</h2>
      <DrillTile onPlay={onDrill} twist={twist} highest={drillHighest} />
      <GameTile
        variant="word"
        glyph="word"
        title={copy.WORD_TILE_TITLE}
        detail={copy.WORD_TILE_DETAIL}
        pills={[wordToday]}
        stat={word.streak > 0 ? { figure: word.streak, label: copy.WORD_STAT_STREAK } : undefined}
        onPlay={() => navigate('/rehearse/word')}
      >
        <span className="word-week" role="img" aria-label={copy.WORD_WEEK_LABEL(week.filter(Boolean).length)}>
          {week.map((solved, i) => (
            <span key={i} className={solved ? 'solved' : undefined} />
          ))}
        </span>
      </GameTile>
      <GameTile
        variant="block"
        glyph="block"
        title={copy.BLOCK_TILE_TITLE}
        detail={copy.BLOCK_TILE_DETAIL}
        pills={[copy.BLOCK_TILE_TODAY(block.today)]}
        stat={block.highest === null ? undefined : { figure: block.highest, label: copy.GAME_STAT_HIGHEST }}
        onPlay={() => navigate('/rehearse/block')}
      />
    </section>
  );
}
