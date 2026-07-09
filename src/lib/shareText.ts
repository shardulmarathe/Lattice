import type { Puzzle } from "@/lib/puzzleTypes";
import { getPuzzleById } from "@/data/puzzles";
import {
  getMirrorEfficiency,
  getPuzzleStats,
  getSpeedLabel,
} from "@/lib/puzzleStats";
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

// Clipboard share text is plain text, which can't carry real formatting — so
// emphasized figures (the speed label, the efficiency percentage) are mapped to
// Unicode sans-serif bold code points (𝗙𝗮𝘀𝘁, 𝟴𝟲%), which render bold when
// pasted into most chat and social apps.
const BOLD_UPPER_A = 0x1d5d4; // 𝗔
const BOLD_LOWER_A = 0x1d5ee; // 𝗮
const BOLD_ZERO = 0x1d7ec; // 𝟬

export function toBoldSans(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x41 && code <= 0x5a) {
      out += String.fromCodePoint(BOLD_UPPER_A + code - 0x41);
    } else if (code >= 0x61 && code <= 0x7a) {
      out += String.fromCodePoint(BOLD_LOWER_A + code - 0x61);
    } else if (code >= 0x30 && code <= 0x39) {
      out += String.fromCodePoint(BOLD_ZERO + code - 0x30);
    } else {
      out += ch;
    }
  }
  return out;
}

/** Line 3: mirror efficiency, shown only when the exact minimum is known. */
function mirrorLine(puzzleId: number, mirrorsUsed: number): string {
  const base = pluralize(mirrorsUsed, "mirror");
  const efficiency = getMirrorEfficiency(puzzleId, mirrorsUsed);
  if (efficiency === null) return base;

  const { minMirrors } = getPuzzleStats(puzzleId);
  return `${base} (min ${minMirrors}) · ${toBoldSans(`${efficiency}%`)} efficient`;
}

/**
 * Fixed-size share text (no emoji grid). Line 2 pairs the completion time with
 * the puzzle's speed label. When the puzzle's exact minimum mirror count is
 * known, line 3 includes an efficiency figure; otherwise it lists the mirror
 * count alone. The speed label and efficiency percentage use Unicode bold
 * (toBoldSans) so they stand out when pasted.
 *
 *   Lattice #022 · 8×8
 *   02:14 · 𝗙𝗮𝘀𝘁
 *   6 mirrors (min 4) · 𝟲𝟳% efficient
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

  const timeLine = puzzle
    ? `${formatTime(timeSeconds)} · ${toBoldSans(getSpeedLabel(puzzle, timeSeconds))}`
    : formatTime(timeSeconds);

  return [
    header,
    timeLine,
    mirrorLine(puzzleId, mirrorsUsed),
    pluralize(wrongNumberHits, "misroute"),
    productionSiteUrl,
  ].join("\n");
}
