import type { Puzzle } from "@/lib/puzzleTypes";

/** Scheduled for 2026-07-04. 6×6, 5-digit code, 2 obstacles. */
export const PUZZLE_012: Puzzle = {
  id: 12,
  code: "46281",
  gridSize: 6,
  source: { x: 3, y: 2, direction: "down" },
  flag: { x: 1, y: 3 },
  numbers: [
    { value: 4, x: 1, y: 1 },
    { value: 6, x: 4, y: 0 },
    { value: 2, x: 0, y: 4 },
    { value: 8, x: 3, y: 5 },
    { value: 1, x: 4, y: 4 },
  ],
  obstacles: [
    { x: 4, y: 3 },
    { x: 1, y: 4 },
  ],
};
