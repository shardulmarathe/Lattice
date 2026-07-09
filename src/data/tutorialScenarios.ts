import type { MirrorPlacement, Puzzle } from "@/lib/puzzleTypes";

export interface TutorialScenario {
  id: string;
  caption: string;
  puzzle: Puzzle;
  mirrors: MirrorPlacement[];
  /** drawProgress (0–1) at which number glow / victory ring activates */
  effectThreshold: number;
  showVictoryLaser: boolean;
  /**
   * When true, each loop first draws the beam with no mirrors and holds it
   * fully extended, then places the mirrors and draws the redirected beam —
   * showing the placement causing the redirect. Every demo runs the same
   * total loop (others hold their finished beam through the extra phases),
   * so all examples stay in sync.
   */
  placeMirrorMidLoop?: boolean;
}

const TUTORIAL_PUZZLE_BASE = {
  gridSize: 2,
  obstacles: [] as { x: number; y: number }[],
};

export const TUTORIAL_SCENARIOS: TutorialScenario[] = [
  {
    id: "mirror",
    caption: "Place a mirror on the laser to redirect it.",
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
    placeMirrorMidLoop: true,
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
    effectThreshold: 0.85,
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

/**
 * Every demo runs the same total loop so they reset in sync. Regular demos:
 * draw (1.2s), hold, reset. placeMirrorMidLoop demos fit a prelude into the
 * same window: quick straight draw (0.4s) + hold (0.2s), mirrors placed at
 * 0.6s, then the redirected beam draws (1.2s), hold, reset.
 */
export const TUTORIAL_DRAW_MS = 1200;
export const TUTORIAL_STRAIGHT_DRAW_MS = 400;
export const TUTORIAL_STRAIGHT_HOLD_MS = 200;
export const TUTORIAL_HOLD_MS = 800;
export const TUTORIAL_RESET_MS = 400;
