/**
 * Manually curated fastest/target solve times (in seconds), keyed by puzzle id.
 *
 * When a puzzle has an entry here it overrides the heuristic par time used for
 * Speed Efficiency (see getParSeconds in @/lib/puzzleStats). This file is hand-
 * maintained and is never written by the puzzle scripts, so curated values are
 * safe from being overwritten.
 */
export const FASTEST_TIMES: Record<number, number> = {
  11: 12, // 0:12
};
