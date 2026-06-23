import type { Puzzle } from "@/lib/puzzleTypes";

/** Scheduled for 2026-07-11. 7×7, 5-digit code, 4 obstacles. */
export const PUZZLE_019: Puzzle = {
  id: 19,
  code: "18346",
  gridSize: 7,
  source: { x: 3, y: 6, direction: "up" },
  flag: { x: 1, y: 0 },
  numbers: [
    { value: 1, x: 5, y: 2 },
    { value: 8, x: 0, y: 4 },
    { value: 4, x: 4, y: 3 },
    { value: 6, x: 6, y: 1 },
    { value: 3, x: 2, y: 5 },
  ],
  obstacles: [
    { x: 5, y: 5 },
    { x: 1, y: 2 },
    { x: 3, y: 1 },
    { x: 6, y: 4 },
  ],
};
