import type { Puzzle } from "@/lib/puzzleTypes";

/** Scheduled for 2026-06-24. 9×9, 6-digit code, sparse obstacles. */
export const PUZZLE_002: Puzzle = {
  id: 2,
  code: "628415",
  gridSize: 9,
  source: { x: 0, y: 4, direction: "right" },
  flag: { x: 8, y: 7 },
  numbers: [
    { value: 6, x: 2, y: 2 },
    { value: 2, x: 5, y: 1 },
    { value: 8, x: 7, y: 3 },
    { value: 4, x: 3, y: 6 },
    { value: 1, x: 6, y: 5 },
    { value: 5, x: 4, y: 7 },
  ],
  obstacles: [
    { x: 4, y: 4 },
    { x: 2, y: 5 },
    { x: 6, y: 2 },
  ],
};
