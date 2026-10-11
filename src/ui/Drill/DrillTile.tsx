import * as copy from '../../core/copy';
import GameTile from '../Games/GameTile';

/** The way into the drill from the Rehearse screens: with a twist on, a tag
 *  saying which and how long it stays, and its best score once played. */
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
      tag={twist ? { label: twist.name, detail: copy.DRILL_TILE_CHANGES(twist.daysLeft) } : undefined}
      pills={[]}
      stat={highest === null ? undefined : { figure: highest, label: copy.GAME_STAT_HIGHEST }}
      onPlay={onPlay}
    />
  );
}
