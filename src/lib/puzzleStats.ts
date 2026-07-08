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
