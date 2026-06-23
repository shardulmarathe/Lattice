import type { Puzzle } from "@/lib/puzzleTypes";

/** Scheduled for 2026-06-25. 8×8, 5-digit code, interior source, 7 obstacles. */
export const PUZZLE_003: Puzzle = {
  id: 3,
  code: "47291",
  gridSize: 8,
  source: { x: 3, y: 4, direction: "left" },
  flag: { x: 5, y: 4 },
  numbers: [
    { value: 4, x: 1, y: 2 },
    { value: 7, x: 5, y: 1 },
    { value: 2, x: 6, y: 4 },
    { value: 9, x: 2, y: 6 },
    { value: 1, x: 5, y: 7 },
  ],
  obstacles: [
    { x: 4, y: 4 },
    { x: 1, y: 5 },
    { x: 6, y: 2 },
    { x: 3, y: 1 },
    { x: 4, y: 6 },
    { x: 0, y: 3 },
    { x: 2, y: 3 },
  ],
};
