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

// ---------------------------------------------------------------------------
// 1–5 meter scores, the shared scorecard basis for the completion screen and
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
 * difficulty automatically. The bands describe live solves that include
 * thinking time, not memorised speed-runs:
 *   5: ≤2 s/mirror (expert) · 4: ≤4 (brisk) · 3: ≤8 (solid) · 2: ≤16 · 1: slower
 * Falls back from exact min → proven lower bound → grid size.
 */
const SPEED_METER_BASE_SECONDS = 3;
const SPEED_METER_BANDS_SECONDS_PER_MIRROR: [number, number, number, number] = [
  2, 4, 8, 16,
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
 * Player-facing pace word, mapped 1:1 from the five speed-meter scores so the
 * word and the dots can never disagree. Lower case because it sits in the
 * meter's detail slot next to "optimal" and "clean", not as a heading.
 */
export type SpeedLabel = "blazing" | "fast" | "normal" | "slowish" | "slow";

const SPEED_LABELS: Record<MeterScore, SpeedLabel> = {
  5: "blazing",
  4: "fast",
  3: "normal",
  2: "slowish",
  1: "slow",
};

export function getSpeedLabel(puzzle: Puzzle, timeSeconds: number): SpeedLabel {
  return SPEED_LABELS[getSpeedScore(puzzle, timeSeconds)];
}

/**
 * Accuracy meter, from mistake count (wrong-number collections + premature
 * flag hits):
 *   5: 0–1 · 4: 2–4 · 3: 5–6 · 2: 7–8 · 1: 9+
 */
export function getAccuracyScore(wrongNumberHits: number): MeterScore {
  if (wrongNumberHits <= 1) return 5;
  if (wrongNumberHits <= 4) return 4;
  if (wrongNumberHits <= 6) return 3;
  if (wrongNumberHits <= 8) return 2;
  return 1;
}
