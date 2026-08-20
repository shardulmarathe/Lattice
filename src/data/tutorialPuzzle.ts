import type { Puzzle } from "@/lib/puzzleTypes";

/**
 * Dedicated tutorial board (not in Past Games / schedule).
 *
 * Layout (y down):
 *   . . 3 . .
 *   . . 1 . .
 *   S . W . .
 *   2 . . . .
 *   . 4 . . F
 *
 * Empty board: laser runs into the white block — no number/flag error on load.
 *
 * Teachable illegal turns:
 *   - On 3 with \  ≡ longer legal route via (3,0)\
 * Laser passes through the source on the way from (0,1)/ onto 2.
 */
export const TUTORIAL_PUZZLE: Puzzle = {
  id: 9000,
  code: "3124",
  gridSize: 5,
  source: { x: 0, y: 2, direction: "right" },
  flag: { x: 4, y: 4 },
  numbers: [
    { value: 3, x: 2, y: 0 },
    { value: 1, x: 2, y: 1 },
    { value: 2, x: 0, y: 3 },
    { value: 4, x: 1, y: 4 },
  ],
  obstacles: [{ x: 2, y: 2 }],
};
