import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import * as copy from '../../core/copy';
import { WORD_GAME_SHOWN } from '../../core/constants';
import { melbourneDay } from '../../core/day';
import { rulesFor, twistForDay } from '../../core/drill-twists';
import type { WordDay } from '../../core/types';
import { solvedWeek, wordTileView } from '../../core/word';
import { listWordDays } from '../../data/db';
import DrillTile from '../Drill/DrillTile';
import { pinnedTwist } from '../Drill/drill-state';
import { useMinuteClock } from '../components/useMinuteClock';
import GameTile from './GameTile';

type Props = {
  onDrill: () => void;
  /** Injectable for tests: where the cards read the games' records. */
  loadWord?: () => Promise<WordDay[]>;
  /** A fixed time, for tests. */
  now?: number;
};

/** The activities on the Rehearse screens: the drill under With your kids,
 *  then the fire risk check under Around your home. Cooee Word's card shows
 *  only while WORD_GAME_SHOWN is on, with its streak, today and a week of
 *  dots. The drill's card names its challenge; neither carries a score. */
export default function GameTiles({ onDrill, loadWord = listWordDays, now }: Props) {
  const navigate = useNavigate();
  const clock = useMinuteClock(now);
  const today = melbourneDay(clock);
  const [words, setWords] = useState<WordDay[]>([]);

  useEffect(() => {
    let live = true;
    // A store that cannot be read shows Word's card as never played.
    loadWord().then(
      (rows) => {
        if (live) setWords(rows);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [loadWord]);

  const rules = rulesFor(pinnedTwist() ?? twistForDay(today).id);
  const twist =
    rules.twist === 'classic'
      ? null
      : { name: rules.name, daysLeft: twistForDay(today).daysLeft, seconds: rules.seconds, bag: rules.bagLimit };
  const word = wordTileView(words, today);
  const wordToday = word.today === 'in-progress' ? copy.WORD_TILE_TODAY['in-progress'](word.guessesUsed) : copy.WORD_TILE_TODAY[word.today];
  const week = solvedWeek(words, today);

  return (
    <section className="game-tiles">
      <h2 className="kicker section-label">{copy.GAMES_KIDS}</h2>
      <DrillTile onPlay={onDrill} twist={twist} />
      {WORD_GAME_SHOWN ? (
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
      ) : null}
      <h2 className="kicker section-label">{copy.GAMES_HOME}</h2>
      <GameTile
        variant="block"
        glyph="block"
        title={copy.BLOCK_TILE_TITLE}
        detail={copy.BLOCK_TILE_DETAIL}
        pills={[]}
        onPlay={() => navigate('/rehearse/block')}
      />
    </section>
  );
}
