import type { Puzzle } from "@/lib/puzzleTypes";

/** Scheduled for 2026-07-01. 5×5, 3-digit code, 2 obstacles. */
export const PUZZLE_009: Puzzle = {
  id: 9,
  code: "418",
  gridSize: 5,
  source: { x: 0, y: 2, direction: "right" },
  flag: { x: 4, y: 4 },
  numbers: [
    { value: 4, x: 2, y: 0 },
    { value: 1, x: 3, y: 3 },
    { value: 8, x: 1, y: 4 },
  ],
  obstacles: [
    { x: 2, y: 2 },
    { x: 4, y: 1 },
  ],
};
