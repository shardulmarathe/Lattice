import type { Puzzle } from "@/lib/puzzleTypes";

/** Scheduled for 2026-07-05. 9×9, 6-digit code, 6 obstacles. */
export const PUZZLE_013: Puzzle = {
  id: 13,
  code: "591348",
  gridSize: 9,
  source: { x: 8, y: 4, direction: "left" },
  flag: { x: 0, y: 7 },
  numbers: [
    { value: 5, x: 6, y: 1 },
    { value: 9, x: 3, y: 2 },
    { value: 1, x: 5, y: 5 },
    { value: 3, x: 2, y: 6 },
    { value: 4, x: 7, y: 5 },
    { value: 8, x: 4, y: 7 },
  ],
  obstacles: [
    { x: 3, y: 4 },
    { x: 1, y: 3 },
    { x: 6, y: 6 },
    { x: 4, y: 2 },
    { x: 0, y: 2 },
    { x: 8, y: 7 },
  ],
};
