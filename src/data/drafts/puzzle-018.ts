import type { Puzzle } from "@/lib/puzzleTypes";

/** Scheduled for 2026-07-10. 4×4, 3-digit code, 1 obstacle. */
export const PUZZLE_018: Puzzle = {
  id: 18,
  code: "792",
  gridSize: 4,
  source: { x: 3, y: 2, direction: "left" },
  flag: { x: 0, y: 3 },
  numbers: [
    { value: 7, x: 0, y: 1 },
    { value: 2, x: 1, y: 3 },
    { value: 9, x: 2, y: 0 },
  ],
  obstacles: [{ x: 2, y: 1 }],
};
