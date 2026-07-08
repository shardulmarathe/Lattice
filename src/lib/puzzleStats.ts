import puzzleStatsData from "@/data/puzzleStats.json";
import type { Puzzle } from "@/lib/puzzleTypes";

/**
 * Known min-mirror data for a puzzle. `minMirrors` is an exact minimum (found by
 * the offline solver within its cap); `minMirrorsAtLeast` is a lower bound when
 * the true minimum exceeds the affordable search cap. Either may be absent when
 * a puzzle has not been analyzed.
 */
export interface PuzzleStats {
  minMirrors?: number;
  minMirrorsAtLeast?: number;
}

const stats = puzzleStatsData as Record<string, PuzzleStats>;

/** Min-mirror stats for a puzzle, or an empty object when unknown. */
export function getPuzzleStats(puzzleId: number): PuzzleStats {
  return stats[String(puzzleId)] ?? {};
}

/**
 * Mirror efficiency as a whole percentage (minMirrors / mirrorsUsed · 100), or
 * null when the exact minimum is unknown. 100% means the solve used the fewest
 * mirrors possible.
 */
export function getMirrorEfficiency(
  puzzleId: number,
  mirrorsUsed: number
): number | null {
  const { minMirrors } = getPuzzleStats(puzzleId);
  if (minMirrors === undefined || mirrorsUsed <= 0) return null;
  return Math.round((minMirrors / mirrorsUsed) * 100);
}

// Difficulty-based par time. Driven mainly by grid area (a robust difficulty
// signal even when a puzzle's exact minimum isn't known), with smaller code-
// length and min-mirror terms. It's a heuristic target, not a measured average.
const PAR_BASE_SECONDS = 20;
const PAR_PER_CELL = 1.5;
const PAR_PER_DIGIT = 6;
const PAR_PER_MIRROR = 3;

/** Heuristic target time (seconds) for a puzzle, rounded to a clean 5s. */
export function getParSeconds(puzzle: Puzzle): number {
  const { minMirrors, minMirrorsAtLeast } = getPuzzleStats(puzzle.id);
  const mirrorRef = minMirrors ?? minMirrorsAtLeast ?? puzzle.gridSize;
  const raw =
    PAR_BASE_SECONDS +
    PAR_PER_CELL * puzzle.gridSize * puzzle.gridSize +
    PAR_PER_DIGIT * puzzle.code.length +
    PAR_PER_MIRROR * mirrorRef;
  return Math.round(raw / 5) * 5;
}

/**
 * Speed efficiency: par ÷ completion time, as a whole percent capped at 100%.
 * 100% means you solved at or under the par target. Null for a non-positive time.
 */
export function getSpeedEfficiency(
  puzzle: Puzzle,
  timeSeconds: number
): number | null {
  if (timeSeconds <= 0) return null;
  return Math.min(100, Math.round((getParSeconds(puzzle) / timeSeconds) * 100));
}
