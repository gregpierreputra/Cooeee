import * as copy from '../../core/copy';
import GameTile from '../Games/GameTile';

/** The way into the drill from the Rehearse screens: with a twist on, a line
 *  saying which and how long it stays, and its highest score once played. */
export default function DrillTile({
  onPlay,
  twist,
  highest,
}: {
  onPlay: () => void;
  twist?: { name: string; daysLeft: number; seconds: number; bag: number } | null;
  highest: number | null;
}) {
  return (
    <GameTile
      variant="drill"
      glyph="drill"
      title={copy.DRILL_TILE_TITLE}
      detail={twist ? copy.DRILL_TILE_DETAIL_FOR(twist.seconds, twist.bag) : copy.DRILL_TILE_DETAIL}
      note={twist ? copy.DRILL_TILE_TWIST(twist.name, twist.daysLeft) : undefined}
      pills={highest === null ? [] : [copy.GAME_HIGHEST(highest)]}
      onPlay={onPlay}
    />
  );
}
