import type { Puzzle } from "@/lib/puzzleTypes";

/** Scheduled for 2026-06-26. 5×5, 3-digit code, 2 obstacles. */
export const PUZZLE_004: Puzzle = {
  id: 4,
  code: "352",
  gridSize: 5,
  source: { x: 0, y: 2, direction: "right" },
  flag: { x: 2, y: 3 },
  numbers: [
    { value: 3, x: 2, y: 1 },
    { value: 5, x: 4, y: 2 },
    { value: 2, x: 2, y: 4 },
  ],
  obstacles: [
    { x: 1, y: 1 },
    { x: 3, y: 0 },
  ],
};
