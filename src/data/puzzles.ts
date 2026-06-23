import type { Puzzle } from "@/lib/puzzleTypes";
import { PUZZLE_002 } from "./drafts/puzzle-002";
import { PUZZLE_003 } from "./drafts/puzzle-003";
import { PUZZLE_004 } from "./drafts/puzzle-004";
import { PUZZLE_005 } from "./drafts/puzzle-005";
import { PUZZLE_006 } from "./drafts/puzzle-006";
import { PUZZLE_007 } from "./drafts/puzzle-007";
import { PUZZLE_008 } from "./drafts/puzzle-008";
import { PUZZLE_009 } from "./drafts/puzzle-009";
import { PUZZLE_010 } from "./drafts/puzzle-010";
import { PUZZLE_011 } from "./drafts/puzzle-011";
import { PUZZLE_012 } from "./drafts/puzzle-012";
import { PUZZLE_013 } from "./drafts/puzzle-013";
import { PUZZLE_014 } from "./drafts/puzzle-014";
import { PUZZLE_015 } from "./drafts/puzzle-015";
import { PUZZLE_016 } from "./drafts/puzzle-016";
import { PUZZLE_017 } from "./drafts/puzzle-017";
import { PUZZLE_018 } from "./drafts/puzzle-018";
import { PUZZLE_019 } from "./drafts/puzzle-019";
import { PUZZLE_020 } from "./drafts/puzzle-020";
import { getScheduledPuzzleId } from "./schedule";

export const PUZZLE_001: Puzzle = {
  id: 1,
  code: "1234",
  gridSize: 7,
  source: { x: 0, y: 3, direction: "right" },
  flag: { x: 6, y: 3 },
  numbers: [
    { value: 1, x: 2, y: 1 },
    { value: 2, x: 4, y: 2 },
    { value: 3, x: 2, y: 5 },
    { value: 4, x: 5, y: 4 },
  ],
  obstacles: [
    { x: 1, y: 1 },
    { x: 3, y: 3 },
    { x: 5, y: 1 },
    { x: 4, y: 5 },
    { x: 1, y: 5 },
  ],
};

export const PUZZLES: Puzzle[] = [
  PUZZLE_001,
  PUZZLE_002,
  PUZZLE_003,
  PUZZLE_004,
  PUZZLE_005,
  PUZZLE_006,
  PUZZLE_007,
  PUZZLE_008,
  PUZZLE_009,
  PUZZLE_010,
  PUZZLE_011,
  PUZZLE_012,
  PUZZLE_013,
  PUZZLE_014,
  PUZZLE_015,
  PUZZLE_016,
  PUZZLE_017,
  PUZZLE_018,
  PUZZLE_019,
  PUZZLE_020,
];

export { PUZZLE_002 } from "./drafts/puzzle-002";
export { PUZZLE_003 } from "./drafts/puzzle-003";
export { PUZZLE_004 } from "./drafts/puzzle-004";
export { PUZZLE_005 } from "./drafts/puzzle-005";
export { PUZZLE_006 } from "./drafts/puzzle-006";
export { PUZZLE_007 } from "./drafts/puzzle-007";
export { PUZZLE_008 } from "./drafts/puzzle-008";
export { PUZZLE_009 } from "./drafts/puzzle-009";
export { PUZZLE_010 } from "./drafts/puzzle-010";
export { PUZZLE_011 } from "./drafts/puzzle-011";
export { PUZZLE_012 } from "./drafts/puzzle-012";
export { PUZZLE_013 } from "./drafts/puzzle-013";
export { PUZZLE_014 } from "./drafts/puzzle-014";
export { PUZZLE_015 } from "./drafts/puzzle-015";
export { PUZZLE_016 } from "./drafts/puzzle-016";
export { PUZZLE_017 } from "./drafts/puzzle-017";
export { PUZZLE_018 } from "./drafts/puzzle-018";
export { PUZZLE_019 } from "./drafts/puzzle-019";
export { PUZZLE_020 } from "./drafts/puzzle-020";

export function getPuzzleById(id: number): Puzzle | undefined {
  return PUZZLES.find((p) => p.id === id);
}

export function getPuzzleByIndex(index: number): Puzzle {
  return PUZZLES[index] ?? PUZZLE_001;
}

export function getPuzzleForDate(date: Date): Puzzle | undefined {
  const id = getScheduledPuzzleId(date);
  if (id === undefined) return undefined;
  return getPuzzleById(id);
}
