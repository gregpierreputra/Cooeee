import * as copy from '../../core/copy';
import GameTile from '../Games/GameTile';

/** The way into the drill from the Rehearse screens, as a family activity:
 *  with a challenge on, a tag saying which and how long it stays. No best
 *  score, so it reads as something to do together, not to beat. */
export default function DrillTile({
  onPlay,
  twist,
}: {
  onPlay: () => void;
  twist?: { name: string; daysLeft: number; seconds: number; bag: number } | null;
}) {
  return (
    <GameTile
      variant="drill"
      glyph="drill"
      title={copy.DRILL_TILE_TITLE}
      detail={twist ? copy.DRILL_TILE_DETAIL_FOR(twist.seconds, twist.bag) : copy.DRILL_TILE_DETAIL}
      tag={twist ? { label: twist.name, detail: copy.DRILL_TILE_CHANGES(twist.daysLeft) } : undefined}
      pills={[]}
      onPlay={onPlay}
    />
  );
}
