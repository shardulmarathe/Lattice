import type { Puzzle } from "@/lib/puzzleTypes";
import { getPuzzleById } from "@/data/puzzles";
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

export function getShareText(
  puzzleId: number,
  timeSeconds: number,
  mirrorsUsed: number
): string {
  const puzzle = getSharePuzzle(puzzleId);
  if (!puzzle) {
    return [
      `Lattice #${puzzleId}`,
      "",
      `Time: ${formatTime(timeSeconds)}`,
      "",
      `Mirrors Used: ${mirrorsUsed}`,
      "",
      productionSiteUrl,
      "",
    ].join("\n");
  }

  const grid = buildPuzzleEmojiGrid(puzzle);

  return [
    `Lattice #${puzzle.id}`,
    "",
    grid,
    "",
    `Time: ${formatTime(timeSeconds)}`,
    "",
    `Mirrors Used: ${mirrorsUsed}`,
    "",
    productionSiteUrl,
    "",
  ].join("\n");
}
