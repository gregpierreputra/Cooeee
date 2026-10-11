import * as copy from '../../core/copy';
import GameTile from '../Games/GameTile';

/** The way into the drill from the Rehearse screens: its highest score once
 *  played, and with a twist on, which, and how long it stays. */
export default function DrillTile({
  onPlay,
  twist,
  highest,
}: {
  onPlay: () => void;
  twist?: { name: string; daysLeft: number; seconds: number; bag: number } | null;
  highest: number | null;
}) {
  const pills = [
    ...(highest === null ? [] : [copy.GAME_HIGHEST(highest)]),
    ...(twist ? [copy.DRILL_ROW_TWIST(twist.name), copy.DRILL_TILE_CHANGES(twist.daysLeft)] : []),
  ];
  return (
    <GameTile
      variant="drill"
      glyph="drill"
      title={copy.DRILL_TILE_TITLE}
      detail={twist ? copy.DRILL_TILE_DETAIL_FOR(twist.seconds, twist.bag) : copy.DRILL_TILE_DETAIL}
      pills={pills}
      onPlay={onPlay}
    />
  );
}
