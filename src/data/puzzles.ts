import type { Puzzle } from "@/lib/puzzleTypes";

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

export const PUZZLES: Puzzle[] = [PUZZLE_001];

export function getPuzzleById(id: number): Puzzle | undefined {
  return PUZZLES.find((p) => p.id === id);
}

export function getPuzzleByIndex(index: number): Puzzle {
  return PUZZLES[index] ?? PUZZLE_001;
}
