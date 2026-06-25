import type { MirrorPlacement, Puzzle } from "@/lib/puzzleTypes";

export interface TutorialScenario {
  id: string;
  caption: string;
  puzzle: Puzzle;
  mirrors: MirrorPlacement[];
  /** drawProgress (0–1) at which number glow / victory ring activates */
  effectThreshold: number;
  showVictoryLaser: boolean;
}

const TUTORIAL_PUZZLE_BASE = {
  gridSize: 2,
  obstacles: [] as { x: number; y: number }[],
};

export const TUTORIAL_SCENARIOS: TutorialScenario[] = [
  {
    id: "mirror",
    caption: "Mirrors redirect the laser.",
    puzzle: {
      id: 9001,
      code: "",
      ...TUTORIAL_PUZZLE_BASE,
      source: { x: 0, y: 1, direction: "up" },
      flag: { x: 1, y: 1 },
      numbers: [],
    },
    mirrors: [{ x: 0, y: 0, orientation: "/" }],
    effectThreshold: 1,
    showVictoryLaser: false,
  },
  {
    id: "correct-number",
    caption: "Collect numbers in target-code order.",
    puzzle: {
      id: 9002,
      code: "3",
      ...TUTORIAL_PUZZLE_BASE,
      source: { x: 0, y: 1, direction: "right" },
      flag: { x: 0, y: 0 },
      numbers: [{ x: 1, y: 1, value: 3 }],
    },
    mirrors: [],
    effectThreshold: 0.85,
    showVictoryLaser: false,
  },
  {
    id: "wrong-number",
    caption: "Numbers in the incorrect order are not collected.",
    puzzle: {
      id: 9003,
      code: "3",
      ...TUTORIAL_PUZZLE_BASE,
      source: { x: 0, y: 1, direction: "right" },
      flag: { x: 0, y: 0 },
      numbers: [{ x: 1, y: 1, value: 5 }],
    },
    mirrors: [],
    effectThreshold: 1,
    showVictoryLaser: false,
  },
  {
    id: "flag",
    caption: "Reach the flag after the full code.",
    puzzle: {
      id: 9004,
      code: "1",
      ...TUTORIAL_PUZZLE_BASE,
      source: { x: 0, y: 1, direction: "up" },
      flag: { x: 0, y: 0 },
      numbers: [],
    },
    mirrors: [],
    effectThreshold: 0.9,
    showVictoryLaser: true,
  },
];

export const TUTORIAL_CELL_SIZE = 44;

/** One full loop: draw beam, hold, reset (ms). */
export const TUTORIAL_DRAW_MS = 1200;
export const TUTORIAL_HOLD_MS = 800;
export const TUTORIAL_RESET_MS = 400;
