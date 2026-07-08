import puzzleStatsData from "@/data/puzzleStats.json";

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
