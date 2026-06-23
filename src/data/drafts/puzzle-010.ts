import type { Puzzle } from "@/lib/puzzleTypes";

/** Scheduled for 2026-07-02. 7×7, 5-digit code, 5 obstacles. */
export const PUZZLE_010: Puzzle = {
  id: 10,
  code: "29356",
  gridSize: 7,
  source: { x: 6, y: 3, direction: "left" },
  flag: { x: 2, y: 0 },
  numbers: [
    { value: 2, x: 4, y: 1 },
    { value: 9, x: 2, y: 2 },
    { value: 3, x: 5, y: 4 },
    { value: 5, x: 3, y: 6 },
    { value: 6, x: 1, y: 5 },
  ],
  obstacles: [
    { x: 3, y: 3 },
    { x: 5, y: 2 },
    { x: 1, y: 1 },
    { x: 4, y: 5 },
    { x: 0, y: 5 },
  ],
};
