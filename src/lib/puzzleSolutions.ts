import puzzleSolutionsData from "@/data/puzzleSolutions.json";
import type { MirrorPlacement } from "@/lib/puzzleTypes";

/**
 * Canonical proven-minimal solutions (exact-min solver witnesses), written by
 * scripts/puzzles/solutions.ts and maintained by the generation/nightly
 * pipeline. Powers the in-game HINT button.
 */
const solutions = puzzleSolutionsData as unknown as Record<
  string,
  MirrorPlacement[]
>;

/** The canonical solution for a puzzle, or null when no witness exists yet. */
export function getPuzzleSolution(puzzleId: number): MirrorPlacement[] | null {
  return solutions[String(puzzleId)] ?? null;
}
