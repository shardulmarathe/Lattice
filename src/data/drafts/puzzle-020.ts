import type { Puzzle } from "@/lib/puzzleTypes";

/** Scheduled for 2026-07-12. 10×10, 6-digit code, 7 obstacles. */
export const PUZZLE_020: Puzzle = {
  id: 20,
  code: "591284",
  gridSize: 10,
  source: { x: 9, y: 5, direction: "left" },
  flag: { x: 2, y: 0 },
  numbers: [
    { value: 5, x: 3, y: 2 },
    { value: 9, x: 7, y: 8 },
    { value: 1, x: 1, y: 6 },
    { value: 2, x: 5, y: 4 },
    { value: 8, x: 8, y: 1 },
    { value: 4, x: 0, y: 3 },
  ],
  obstacles: [
    { x: 4, y: 6 },
    { x: 7, y: 3 },
    { x: 2, y: 2 },
    { x: 5, y: 8 },
    { x: 9, y: 2 },
    { x: 1, y: 8 },
    { x: 6, y: 0 },
  ],
};
