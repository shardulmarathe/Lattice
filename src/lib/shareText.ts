import type { Puzzle } from "@/lib/puzzleTypes";
import { getPuzzleById } from "@/data/puzzles";
import {
  getAccuracyScore,
  getEfficiencyScore,
  getPuzzleStats,
  getSpeedScore,
  type MeterScore,
} from "@/lib/puzzleStats";
import { productionSiteUrl } from "@/lib/site";

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

// --- Scorecard share text -----------------------------------------------
// Three 1–5 meters (Efficiency / Speed / Accuracy), each a row of five dots
// with a plain-language detail. Scores come from src/lib/puzzleStats.ts so the
// share always agrees with the completion screen.

const DOT_FILLED = "🔴";
const DOT_EMPTY = "⚫";
// Labels are padded to the longest ("Efficiency") so the dot columns line up
// in monospace contexts; proportional fonts stay close enough.
const METER_LABEL_WIDTH = "Efficiency".length;

function meterDots(score: MeterScore): string {
  return DOT_FILLED.repeat(score) + DOT_EMPTY.repeat(5 - score);
}

function meterLine(label: string, score: MeterScore, detail: string): string {
  return `${label.padEnd(METER_LABEL_WIDTH)}  ${meterDots(score)}   ${detail}`;
}

/** Share time as m:ss (no leading zero on minutes, "3:18", not "03:18"). */
export function formatShareTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/** Efficiency detail: mirror surplus over the proven minimum. */
export function getEfficiencyDetail(
  puzzleId: number,
  mirrorsUsed: number
): string {
  const { minMirrors } = getPuzzleStats(puzzleId);
  if (minMirrors === undefined) return pluralize(mirrorsUsed, "Mirror");
  const above = Math.max(0, mirrorsUsed - minMirrors);
  if (above === 0) return "Optimal";
  return `+${pluralize(above, "Mirror")} Above Optimal`;
}

/** Accuracy detail: mistakes (wrong numbers + early flag) in plain language. */
export function getAccuracyDetail(wrongNumberHits: number): string {
  return pluralize(wrongNumberHits, "Mistake");
}

/**
 * Fixed-size scorecard share text (no emoji grid): header, three 1–5 meters,
 * site URL.
 *
 *   Lattice #017 · 9×9
 *
 *   Efficiency  🔴🔴🔴🔴⚫   +2 Mirrors Above Optimal
 *   Speed       🔴🔴🔴⚫⚫   3:18
 *   Accuracy    🔴🔴🔴🔴🔴   0 Mistakes
 *
 *   https://playlattice.vercel.app
 *
 * Hinted solves disclose it on the header line ("Lattice #017 · 9×9 · 2
 * hints"), a hinted board can score Optimal efficiency, so the qualifier
 * belongs on the whole card. Zero hints leaves the share byte-identical to
 * the unhinted format.
 */
export function getShareText(
  puzzleId: number,
  timeSeconds: number,
  mirrorsUsed: number,
  wrongNumberHits: number,
  hintsUsed: number = 0
): string {
  const puzzle = getSharePuzzle(puzzleId);
  const paddedId = String(puzzleId).padStart(3, "0");

  const hintsSuffix =
    hintsUsed > 0 ? ` · ${pluralize(hintsUsed, "hint")}` : "";
  const header =
    (puzzle
      ? `Lattice #${paddedId} · ${puzzle.gridSize}×${puzzle.gridSize}`
      : `Lattice #${paddedId}`) + hintsSuffix;

  // Every registered puzzle has a proven exact minimum, so the efficiency
  // score is always available in practice; 3 dots is a neutral fallback for
  // an unresolvable id.
  const efficiencyScore = getEfficiencyScore(puzzleId, mirrorsUsed) ?? 3;
  const speedScore = puzzle ? getSpeedScore(puzzle, timeSeconds) : 3;

  return [
    header,
    "",
    meterLine("Efficiency", efficiencyScore, getEfficiencyDetail(puzzleId, mirrorsUsed)),
    meterLine("Speed", speedScore, formatShareTime(timeSeconds)),
    meterLine("Accuracy", getAccuracyScore(wrongNumberHits), getAccuracyDetail(wrongNumberHits)),
    "",
    productionSiteUrl,
  ].join("\n");
}
