import type { Puzzle } from "@/lib/puzzleTypes";

interface PuzzleThumbnailProps {
  puzzle: Puzzle;
  className?: string;
}

/** SVG user units per cell. Rendered size comes from CSS, not from this. */
const CELL = 10;

/**
 * A small shape-only snapshot of a puzzle's board: grid, obstacles, source and
 * flag. Deliberately no numbers and no laser.
 *
 * The previous version drew the number tiles, which put 7px digits on a 56px
 * square and made every board reduce to the same grey speckle. Shapes survive
 * the shrink where glyphs do not, so this reads as the board's face rather than
 * as unreadable data. Sizing is left to the caller so it can be responsive.
 */
export default function PuzzleThumbnail({
  puzzle,
  className,
}: PuzzleThumbnailProps) {
  const { gridSize, source, flag, obstacles } = puzzle;
  const dim = gridSize * CELL;

  return (
    <svg
      viewBox={`0 0 ${dim} ${dim}`}
      className={className}
      aria-hidden
      // Keeps the 1px-ish strokes below crisp instead of smeared when the SVG
      // is scaled down to 48px by CSS.
      shapeRendering="crispEdges"
    >
      <rect x={0} y={0} width={dim} height={dim} fill="#000" />

      {Array.from({ length: gridSize + 1 }).map((_, i) => (
        <g key={`g-${i}`} stroke="rgba(255,255,255,0.14)" strokeWidth={0.4}>
          <line x1={i * CELL} y1={0} x2={i * CELL} y2={dim} />
          <line x1={0} y1={i * CELL} x2={dim} y2={i * CELL} />
        </g>
      ))}

      {obstacles.map((o) => (
        <rect
          key={`o-${o.x}-${o.y}`}
          x={o.x * CELL + 1}
          y={o.y * CELL + 1}
          width={CELL - 2}
          height={CELL - 2}
          fill="rgba(255,255,255,0.55)"
        />
      ))}

      {/* Source: a filled laser dot rather than a ring, which holds its shape
          far better than a 1px annulus does at 48px. */}
      <circle
        cx={source.x * CELL + CELL / 2}
        cy={source.y * CELL + CELL / 2}
        r={CELL * 0.28}
        fill="var(--laser)"
        shapeRendering="geometricPrecision"
      />

      {/* Flag: a solid pennant, again for shape over stroke detail, and
          scaled up because at 48px the earlier version was a speck. Pure white
          against the greyed obstacles so the two are not confusable. */}
      <g
        transform={`translate(${flag.x * CELL + CELL * 0.26} ${flag.y * CELL + CELL * 0.15})`}
        shapeRendering="geometricPrecision"
      >
        <rect x={0} y={0} width={CELL * 0.16} height={CELL * 0.72} fill="#fff" />
        <path
          d={`M${CELL * 0.16} 0 L${CELL * 0.62} ${CELL * 0.2} L${CELL * 0.16} ${CELL * 0.4} Z`}
          fill="#fff"
        />
      </g>
    </svg>
  );
}
