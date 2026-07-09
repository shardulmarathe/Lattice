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

// Speed pacing, derived entirely from a puzzle's minimum mirror count. The
// "fastest" floor is what a speed-runner who already knows the solution needs
// to physically place the mirrors: a small orient/read base plus ~1s per mirror.
// Calibrated to the one real record we have (#11: 9 mirrors solved in 12s → 3 +
// 9·1 = 12). The "good" target is a competent (non-record) solve at 2.5× that
// floor. Both scale with mirror count, a robust difficulty signal that works
// even from a lower bound (minMirrorsAtLeast) until the exact min is proven.
const FASTEST_BASE_SECONDS = 3;
const FASTEST_SECONDS_PER_MIRROR = 1.0;
const GOOD_MULTIPLIER = 2.5;

/**
 * Fastest achievable solve time (seconds) — the record floor a puzzle is paced
 * against. Uses the exact minimum when known, else the proven lower bound, else
 * grid size as a last-resort proxy.
 */
export function getFastestSeconds(puzzle: Puzzle): number {
  const { minMirrors, minMirrorsAtLeast } = getPuzzleStats(puzzle.id);
  const mirrorRef = minMirrors ?? minMirrorsAtLeast ?? puzzle.gridSize;
  return Math.round(
    FASTEST_BASE_SECONDS + FASTEST_SECONDS_PER_MIRROR * mirrorRef
  );
}

/**
 * "Good" target time (seconds): a realistic goal for a competent solver, set at
 * GOOD_MULTIPLIER × the fastest floor.
 */
export function getGoodSeconds(puzzle: Puzzle): number {
  return Math.round(getFastestSeconds(puzzle) * GOOD_MULTIPLIER);
}

export type SpeedLabel = "Blazing" | "Fast" | "Steady" | "Relaxed";

/**
 * Player-facing pace label for a completion time. Bands, from a puzzle's fastest
 * floor (F) and good target (G):
 *   time ≤ F      → "Blazing"  (at/under the record floor)
 *   time ≤ G      → "Fast"     (competent pace)
 *   time ≤ 2·G    → "Steady"
 *   otherwise     → "Relaxed"
 * Positive-to-neutral across the whole range — never a negative label.
 */
export function getSpeedLabel(puzzle: Puzzle, timeSeconds: number): SpeedLabel {
  const fastest = getFastestSeconds(puzzle);
  const good = getGoodSeconds(puzzle);
  if (timeSeconds <= fastest) return "Blazing";
  if (timeSeconds <= good) return "Fast";
  if (timeSeconds <= good * 2) return "Steady";
  return "Relaxed";
}
