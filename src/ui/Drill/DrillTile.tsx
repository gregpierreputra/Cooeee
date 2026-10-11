import * as copy from '../../core/copy';
import GameTile from '../Games/GameTile';

/** The way into the drill from the Rehearse screens. With a twist on, it says
 *  which, and how long it stays. */
export default function DrillTile({ onPlay, twist }: { onPlay: () => void; twist?: { name: string; daysLeft: number; seconds: number; bag: number } | null }) {
  return (
    <GameTile
      variant="drill"
      glyph="drill"
      title={copy.DRILL_TILE_TITLE}
      detail={twist ? copy.DRILL_TILE_DETAIL_FOR(twist.seconds, twist.bag) : copy.DRILL_TILE_DETAIL}
      status={twist ? copy.DRILL_TILE_TWIST(twist.name, twist.daysLeft) : undefined}
      onPlay={onPlay}
    />
  );
}
