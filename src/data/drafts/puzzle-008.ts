import type { Puzzle } from "@/lib/puzzleTypes";

/** Scheduled for 2026-06-30. 9×9, 7-digit code, 4 obstacles. */
export const PUZZLE_008: Puzzle = {
  id: 8,
  code: "3841672",
  gridSize: 9,
  source: { x: 4, y: 4, direction: "down" },
  flag: { x: 6, y: 6 },
  numbers: [
    { value: 3, x: 2, y: 1 },
    { value: 8, x: 6, y: 2 },
    { value: 4, x: 1, y: 4 },
    { value: 1, x: 5, y: 5 },
    { value: 6, x: 7, y: 3 },
    { value: 7, x: 3, y: 7 },
    { value: 2, x: 7, y: 5 },
  ],
  obstacles: [
    { x: 2, y: 3 },
    { x: 0, y: 6 },
    { x: 7, y: 1 },
    { x: 3, y: 0 },
  ],
};
