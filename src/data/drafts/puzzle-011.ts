import type { Puzzle } from "@/lib/puzzleTypes";

/** Scheduled for 2026-07-03. 8×8, 4-digit code, 5 obstacles. */
export const PUZZLE_011: Puzzle = {
  id: 11,
  code: "7138",
  gridSize: 8,
  source: { x: 4, y: 7, direction: "up" },
  flag: { x: 7, y: 0 },
  numbers: [
    { value: 7, x: 2, y: 2 },
    { value: 1, x: 5, y: 3 },
    { value: 3, x: 1, y: 5 },
    { value: 8, x: 6, y: 6 },
  ],
  obstacles: [
    { x: 3, y: 4 },
    { x: 5, y: 5 },
    { x: 0, y: 3 },
    { x: 7, y: 4 },
    { x: 4, y: 1 },
  ],
};
