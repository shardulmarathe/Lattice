import type { Puzzle } from "@/lib/puzzleTypes";

/** Scheduled for 2026-06-27. 9×9, 5-digit code, 6 obstacles. */
export const PUZZLE_005: Puzzle = {
  id: 5,
  code: "29465",
  gridSize: 9,
  source: { x: 0, y: 4, direction: "right" },
  flag: { x: 8, y: 8 },
  numbers: [
    { value: 2, x: 3, y: 1 },
    { value: 9, x: 6, y: 2 },
    { value: 4, x: 2, y: 5 },
    { value: 6, x: 7, y: 5 },
    { value: 5, x: 4, y: 7 },
  ],
  obstacles: [
    { x: 4, y: 4 },
    { x: 1, y: 3 },
    { x: 7, y: 1 },
    { x: 2, y: 7 },
    { x: 6, y: 6 },
    { x: 8, y: 4 },
  ],
};
