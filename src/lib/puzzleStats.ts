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

// ---------------------------------------------------------------------------
// 1–5 meter scores — the shared scorecard basis for the completion screen and
// the share text (Efficiency / Speed / Accuracy, five dots each).
// ---------------------------------------------------------------------------

export type MeterScore = 1 | 2 | 3 | 4 | 5;

/**
 * Efficiency meter. Banded on the percentage of optimal (minMirrors /
 * mirrorsUsed) rather than the raw mirror surplus, so the meter is fair across
 * puzzle sizes: +2 extra mirrors on a 4-mirror mini is far sloppier than +2 on
 * an 18-mirror 9×9. Returns null when the exact minimum is unknown.
 *   5: 100% (optimal) · 4: 85–99% · 3: 75–84% · 2: 65–74% · 1: below 65%
 */
export function getEfficiencyScore(
  puzzleId: number,
  mirrorsUsed: number
): MeterScore | null {
  const pct = getMirrorEfficiency(puzzleId, mirrorsUsed);
  if (pct === null) return null;
  if (pct >= 100) return 5;
  if (pct >= 85) return 4;
  if (pct >= 75) return 3;
  if (pct >= 65) return 2;
  return 1;
}

/**
 * Speed meter. Banded on seconds-per-required-mirror (time ÷ the puzzle's
 * proven minimum, after a small orient/read base), so pacing scales with
 * difficulty automatically. Unlike the record floor (getFastestSeconds, ~1
 * s/mirror with the solution memorized), these bands describe live solves that
 * include thinking time:
 *   5: ≤4 s/mirror (expert) · 4: ≤8 (brisk) · 3: ≤15 (solid) · 2: ≤30 · 1: slower
 * Falls back from exact min → proven lower bound → grid size, like the floor.
 */
const SPEED_METER_BASE_SECONDS = 3;
const SPEED_METER_BANDS_SECONDS_PER_MIRROR: [number, number, number, number] = [
  4, 8, 15, 30,
];

export function getSpeedScore(puzzle: Puzzle, timeSeconds: number): MeterScore {
  const { minMirrors, minMirrorsAtLeast } = getPuzzleStats(puzzle.id);
  const mirrorRef = minMirrors ?? minMirrorsAtLeast ?? puzzle.gridSize;
  const [expert, brisk, solid, leisurely] = SPEED_METER_BANDS_SECONDS_PER_MIRROR;
  if (timeSeconds <= SPEED_METER_BASE_SECONDS + expert * mirrorRef) return 5;
  if (timeSeconds <= SPEED_METER_BASE_SECONDS + brisk * mirrorRef) return 4;
  if (timeSeconds <= SPEED_METER_BASE_SECONDS + solid * mirrorRef) return 3;
  if (timeSeconds <= SPEED_METER_BASE_SECONDS + leisurely * mirrorRef) return 2;
  return 1;
}

/**
 * Accuracy meter, from misroute count (number tiles hit out of Target Code
 * order):
 *   5: 0–1 · 4: 2–4 · 3: 5–6 · 2: 7–8 · 1: 9+
 */
export function getAccuracyScore(wrongNumberHits: number): MeterScore {
  if (wrongNumberHits <= 1) return 5;
  if (wrongNumberHits <= 4) return 4;
  if (wrongNumberHits <= 6) return 3;
  if (wrongNumberHits <= 8) return 2;
  return 1;
}

export type SpeedLabel = "Blazing" | "Fast" | "Steady" | "Relaxed" | "Unhurried";

const SPEED_LABELS: Record<MeterScore, SpeedLabel> = {
  5: "Blazing",
  4: "Fast",
  3: "Steady",
  2: "Relaxed",
  1: "Unhurried",
};

/**
 * Player-facing pace word, mapped 1:1 from the five speed-meter scores so the
 * label and the dots can never disagree. Positive-to-neutral across the whole
 * range — never a negative label.
 */
export function getSpeedLabel(puzzle: Puzzle, timeSeconds: number): SpeedLabel {
  return SPEED_LABELS[getSpeedScore(puzzle, timeSeconds)];
}
