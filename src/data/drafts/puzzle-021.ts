import type { Puzzle } from "@/lib/puzzleTypes";

/** Scrapped — not registered or scheduled. */
export const PUZZLE_021: Puzzle = {
  id: 21,
  code: "415",
  gridSize: 3,
  source: { x: 0, y: 1, direction: "right" },
  flag: { x: 1, y: 0 },
  numbers: [
    { value: 4, x: 2, y: 0 },
    { value: 1, x: 0, y: 2 },
    { value: 5, x: 2, y: 2 },
  ],
  obstacles: [],
};
