import type { Puzzle } from "@/lib/puzzleTypes";

interface PuzzleThumbnailProps {
  puzzle: Puzzle;
  /** Rendered pixel size (square). */
  size?: number;
  className?: string;
}

const CELL = 10;
const LASER_RED = "#FF3B1F";

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

/**
 * A small, self-contained SVG snapshot of a puzzle's static board — source,
 * flag, obstacles and number tiles. No laser, mirrors or interaction. Used by
 * the Past Games archive cards. Deliberately not the heavy interactive Board.
 */
export default function PuzzleThumbnail({
  puzzle,
  size = 56,
  className,
}: PuzzleThumbnailProps) {
  const { gridSize, source, flag, numbers, obstacles } = puzzle;
  const dim = gridSize * CELL;
  const obstacleSet = new Set(obstacles.map((o) => cellKey(o.x, o.y)));

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${dim} ${dim}`}
      className={className}
      aria-hidden
    >
      <rect x={0} y={0} width={dim} height={dim} fill="#000" />

      {/* grid lines */}
      {Array.from({ length: gridSize + 1 }).map((_, i) => (
        <g key={`g-${i}`} stroke="rgba(255,255,255,0.12)" strokeWidth={0.5}>
          <line x1={i * CELL} y1={0} x2={i * CELL} y2={dim} />
          <line x1={0} y1={i * CELL} x2={dim} y2={i * CELL} />
        </g>
      ))}

      {/* obstacles */}
      {obstacles.map((o) => (
        <rect
          key={`o-${o.x}-${o.y}`}
          x={o.x * CELL + 1}
          y={o.y * CELL + 1}
          width={CELL - 2}
          height={CELL - 2}
          fill="#fff"
        />
      ))}

      {/* number tiles */}
      {numbers.map((n) =>
        obstacleSet.has(cellKey(n.x, n.y)) ? null : (
          <text
            key={`n-${n.x}-${n.y}`}
            x={n.x * CELL + CELL / 2}
            y={n.y * CELL + CELL / 2}
            fill="#fff"
            fontSize={CELL * 0.7}
            fontFamily="var(--font-geist-mono, monospace)"
            textAnchor="middle"
            dominantBaseline="central"
          >
            {n.value}
          </text>
        )
      )}

      {/* source */}
      <circle
        cx={source.x * CELL + CELL / 2}
        cy={source.y * CELL + CELL / 2}
        r={CELL * 0.32}
        fill="none"
        stroke={LASER_RED}
        strokeWidth={1.2}
      />
      <circle
        cx={source.x * CELL + CELL / 2}
        cy={source.y * CELL + CELL / 2}
        r={CELL * 0.12}
        fill={LASER_RED}
      />

      {/* flag */}
      <g
        transform={`translate(${flag.x * CELL + CELL * 0.3} ${
          flag.y * CELL + CELL * 0.22
        })`}
        stroke="#fff"
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <path d={`M0 ${CELL * 0.6} V0 M0 0 L${CELL * 0.42} ${CELL * 0.18} L0 ${CELL * 0.36}`} />
      </g>
    </svg>
  );
}
