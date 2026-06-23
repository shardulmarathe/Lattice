import type { Puzzle } from "@/lib/puzzleTypes";

/** Scheduled for 2026-07-06. 7×7, 4-digit code, 4 obstacles. */
export const PUZZLE_014: Puzzle = {
  id: 14,
  code: "2758",
  gridSize: 7,
  source: { x: 3, y: 5, direction: "up" },
  flag: { x: 6, y: 6 },
  numbers: [
    { value: 2, x: 1, y: 1 },
    { value: 7, x: 5, y: 2 },
    { value: 5, x: 0, y: 4 },
    { value: 8, x: 5, y: 3 },
  ],
  obstacles: [
    { x: 2, y: 4 },
    { x: 4, y: 1 },
    { x: 5, y: 5 },
    { x: 1, y: 3 },
  ],
};
