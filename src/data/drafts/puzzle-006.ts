import type { Puzzle } from "@/lib/puzzleTypes";

/** Scheduled for 2026-06-28. 8×8, 6-digit code, 6 obstacles. */
export const PUZZLE_006: Puzzle = {
  id: 6,
  code: "481726",
  gridSize: 8,
  source: { x: 7, y: 3, direction: "left" },
  flag: { x: 2, y: 1 },
  numbers: [
    { value: 4, x: 5, y: 1 },
    { value: 8, x: 2, y: 0 },
    { value: 1, x: 1, y: 3 },
    { value: 7, x: 4, y: 4 },
    { value: 2, x: 6, y: 6 },
    { value: 6, x: 3, y: 7 },
  ],
  obstacles: [
    { x: 4, y: 2 },
    { x: 1, y: 5 },
    { x: 5, y: 5 },
    { x: 2, y: 2 },
    { x: 0, y: 1 },
    { x: 1, y: 7 },
  ],
};
