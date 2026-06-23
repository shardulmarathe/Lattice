import type { Puzzle } from "@/lib/puzzleTypes";

/** Scheduled for 2026-07-09. 9×9, 6-digit code, 6 obstacles. */
export const PUZZLE_017: Puzzle = {
  id: 17,
  code: "356821",
  gridSize: 9,
  source: { x: 0, y: 4, direction: "right" },
  flag: { x: 5, y: 0 },
  numbers: [
    { value: 3, x: 5, y: 1 },
    { value: 5, x: 2, y: 6 },
    { value: 6, x: 7, y: 3 },
    { value: 8, x: 4, y: 7 },
    { value: 2, x: 8, y: 6 },
    { value: 1, x: 8, y: 2 },
  ],
  obstacles: [
    { x: 3, y: 4 },
    { x: 6, y: 5 },
    { x: 2, y: 3 },
    { x: 5, y: 6 },
    { x: 1, y: 2 },
    { x: 4, y: 0 },
  ],
};
