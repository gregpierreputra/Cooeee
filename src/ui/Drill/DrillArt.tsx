import * as copy from '../../core/copy';
import { ATLAS, SHEET } from '../../core/drill-atlas';

/** One thing's own picture from the game, drawn from the sprite sheet to fit a
 *  square `size` css pixels wide. The sheet is cached with the app, so it
 *  draws with no signal. Shared by the drill's debrief and the pack page. */
export function Sprite({
  id,
  size = 40,
  atlas = ATLAS,
  sheet = SHEET,
  className = 'debrief-sprite',
}: {
  id: string;
  size?: number;
  /** Another game's sheet: its atlas, its size, and the class naming its picture. */
  atlas?: Record<string, readonly (number | undefined)[]>;
  sheet?: readonly [number, number];
  className?: string;
}) {
  const [x = 0, y = 0, w = 1, h = 1] = atlas[id];
  const scale = Math.min(size / w, size / h, 3);
  return (
    <span
      className={className}
      aria-hidden="true"
      style={{
        width: w * scale,
        height: h * scale,
        backgroundSize: `${sheet[0] * scale}px ${sheet[1] * scale}px`,
        backgroundPosition: `${-x * scale}px ${-y * scale}px`,
      }}
    />
  );
}

/** The score as a ring filled to the score, green, amber or red. */
export function ScoreRing({ score }: { score: number }) {
  const band = score >= 80 ? 'good' : score >= 50 ? 'fair' : 'poor';
  const length = 2 * Math.PI * 52;
  return (
    <svg className={`debrief-ring ${band}`} viewBox="0 0 120 120" role="img" aria-label={copy.DEBRIEF_SCORE(score)}>
      <circle className="track" cx="60" cy="60" r="52" />
      {score > 0 ? <circle className="fill" cx="60" cy="60" r="52" strokeDasharray={`${(length * score) / 100} ${length}`} /> : null}
      {/* Centred on the ring by the digits' own height, at any size. */}
      <text x="60" y="60" dy="0.35em" textAnchor="middle">{score}</text>
    </svg>
  );
}
