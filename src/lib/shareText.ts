import type { Puzzle } from "@/lib/puzzleTypes";
import { getPuzzleById } from "@/data/puzzles";
import { getPuzzleStats } from "@/lib/puzzleStats";
import { productionSiteUrl } from "@/lib/site";
import { formatTime } from "@/lib/validation";

const CELL_EMPTY = "🔳";
const CELL_OBSTACLE = "⬜";
const CELL_SOURCE = "⭕";
const CELL_FLAG = "🏳️";

function obstacleKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function buildPuzzleEmojiGrid(puzzle: Puzzle): string {
  const obstacleSet = new Set(
    puzzle.obstacles.map((o) => obstacleKey(o.x, o.y))
  );

  const rows: string[] = [];

  for (let y = 0; y < puzzle.gridSize; y++) {
    let row = "";
    for (let x = 0; x < puzzle.gridSize; x++) {
      if (puzzle.source.x === x && puzzle.source.y === y) {
        row += CELL_SOURCE;
      } else if (puzzle.flag.x === x && puzzle.flag.y === y) {
        row += CELL_FLAG;
      } else if (obstacleSet.has(obstacleKey(x, y))) {
        row += CELL_OBSTACLE;
      } else {
        row += CELL_EMPTY;
      }
    }
    rows.push(row);
  }

  return rows.join("\n");
}

export function getSharePuzzle(puzzleId: number): Puzzle | undefined {
  return getPuzzleById(puzzleId);
}

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** Line 3: mirror efficiency, shown only when the exact minimum is known. */
function mirrorLine(puzzleId: number, mirrorsUsed: number): string {
  const { minMirrors } = getPuzzleStats(puzzleId);
  const base = pluralize(mirrorsUsed, "mirror");

  if (minMirrors === undefined || mirrorsUsed <= 0) {
    return base;
  }

  const efficiency = Math.round((minMirrors / mirrorsUsed) * 100);
  return `${base} (min ${minMirrors}) · ${efficiency}% efficient`;
}

/**
 * Fixed-size share text (no emoji grid). When the puzzle's exact minimum mirror
 * count is known, line 3 includes an efficiency figure; otherwise it lists the
 * mirror count alone.
 *
 *   Lattice #022 · 8×8
 *   02:14
 *   6 mirrors (min 4) · 67% efficient
 *   1 misroute
 *   https://playlattice.vercel.app
 */
export function getShareText(
  puzzleId: number,
  timeSeconds: number,
  mirrorsUsed: number,
  wrongNumberHits: number
): string {
  const puzzle = getSharePuzzle(puzzleId);
  const paddedId = String(puzzleId).padStart(3, "0");

  const header = puzzle
    ? `Lattice #${paddedId} · ${puzzle.gridSize}×${puzzle.gridSize}`
    : `Lattice #${paddedId}`;

  return [
    header,
    formatTime(timeSeconds),
    mirrorLine(puzzleId, mirrorsUsed),
    pluralize(wrongNumberHits, "misroute"),
    productionSiteUrl,
  ].join("\n");
}
