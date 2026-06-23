import type { Puzzle } from "@/lib/puzzleTypes";

/** Scheduled for 2026-06-29. 6×6, 4-digit code, 1 obstacle. */
export const PUZZLE_007: Puzzle = {
  id: 7,
  code: "5291",
  gridSize: 6,
  source: { x: 2, y: 5, direction: "up" },
  flag: { x: 5, y: 0 },
  numbers: [
    { value: 5, x: 1, y: 1 },
    { value: 2, x: 4, y: 2 },
    { value: 9, x: 1, y: 3 },
    { value: 1, x: 3, y: 4 },
  ],
  obstacles: [{ x: 2, y: 2 }],
};
