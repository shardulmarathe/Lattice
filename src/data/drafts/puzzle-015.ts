import type { Puzzle } from "@/lib/puzzleTypes";

/** Scheduled for 2026-07-07. 6×6, 5-digit code, 1 obstacle. */
export const PUZZLE_015: Puzzle = {
  id: 15,
  code: "71623",
  gridSize: 6,
  source: { x: 0, y: 3, direction: "right" },
  flag: { x: 2, y: 2 },
  numbers: [
    { value: 7, x: 4, y: 1 },
    { value: 1, x: 2, y: 5 },
    { value: 6, x: 5, y: 4 },
    { value: 2, x: 3, y: 2 },
    { value: 3, x: 2, y: 1 },
  ],
  obstacles: [{ x: 0, y: 5 }],
};
