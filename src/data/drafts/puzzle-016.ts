import type { Puzzle } from "@/lib/puzzleTypes";

/** Scheduled for 2026-07-08. 8×8, 4-digit code, 3 obstacles. */
export const PUZZLE_016: Puzzle = {
  id: 16,
  code: "4819",
  gridSize: 8,
  source: { x: 7, y: 2, direction: "left" },
  flag: { x: 4, y: 5 },
  numbers: [
    { value: 4, x: 1, y: 6 },
    { value: 8, x: 5, y: 0 },
    { value: 1, x: 3, y: 4 },
    { value: 9, x: 6, y: 5 },
  ],
  obstacles: [
    { x: 4, y: 2 },
    { x: 1, y: 3 },
    { x: 3, y: 6 },
  ],
};
