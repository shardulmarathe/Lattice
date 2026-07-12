import type { MirrorPlacement, Position, Puzzle } from "@/lib/puzzleTypes";

export interface TutorialTap {
  /** Loop-relative time at which the tap ripple fires. */
  atMs: number;
  cell: Position;
}

/**
 * One beam pass within a demo loop. A scenario with two phases first draws
 * the phase-1 beam (e.g. straight, mirror-less), holds it, then switches to
 * the phase-2 mirror set and redraws — showing cause and effect.
 */
export interface TutorialPhase {
  /** Loop-relative time at which this phase's beam starts drawing. */
  startMs: number;
  drawMs: number;
  /** Full mirror set active during this phase. */
  mirrors: MirrorPlacement[];
  /** Linear reads better on long paths; default eases out. */
  easing?: "easeOutCubic" | "linear";
  /** Flash the flag red once the beam completes (early-flag mistake). */
  flagIncorrectOnHold?: boolean;
  /** Victory-mode beam; the ring fires when the draw completes. */
  victory?: boolean;
}

export interface TutorialScenario {
  id: string;
  title: string;
  caption: string;
  cellSize: number;
  puzzle: Puzzle;
  phases: TutorialPhase[];
  taps?: TutorialTap[];
}

/**
 * Every demo runs the same total loop so they all reset in sync. Beams and
 * effects blank at TUTORIAL_RESET_AT_MS, then the loop restarts.
 */
export const TUTORIAL_LOOP_MS = 4800;
export const TUTORIAL_RESET_AT_MS = 4400;
export const TAP_RIPPLE_MS = 450;

/** Demo boards render this much larger on md+ screens. */
export const TUTORIAL_DESKTOP_CELL_SCALE = 1.25;

/** The bespoke tap-to-place demo (no puzzle or laser — see MirrorCycleDemo). */
export const MIRROR_CYCLE_SECTION = {
  title: "PLACE MIRRORS",
  caption:
    "Tap an empty square to place a mirror. Tap again to rotate it. Tap a third time to remove it.",
  cellSize: 44,
  gridSize: 2,
  cell: { x: 1, y: 0 } as Position,
  tapsAtMs: [600, 1800, 3000],
  /** The mirror state changes this long after each tap ripple starts. */
  stateDelayMs: 120,
} as const;

export const TUTORIAL_SCENARIOS: TutorialScenario[] = [
  {
    id: "redirect",
    title: "REDIRECT THE LASER",
    caption: "Mirrors redirect the laser toward the target code.",
    cellSize: 44,
    puzzle: {
      id: 9001,
      code: "",
      gridSize: 2,
      obstacles: [],
      source: { x: 0, y: 1, direction: "right" },
      flag: { x: 0, y: 0 },
      numbers: [],
    },
    phases: [
      { startMs: 0, drawMs: 500, mirrors: [] },
      {
        startMs: 1250,
        drawMs: 700,
        mirrors: [{ x: 1, y: 1, orientation: "/" }],
      },
    ],
    taps: [{ atMs: 1100, cell: { x: 1, y: 1 } }],
  },
  {
    id: "collect",
    title: "COLLECT THE CODE",
    caption:
      "Collect every number in the target code, in order. Hitting one out of order breaks the code — reroute to avoid it.",
    cellSize: 36,
    puzzle: {
      id: 9002,
      code: "35",
      gridSize: 3,
      obstacles: [],
      source: { x: 0, y: 2, direction: "right" },
      flag: { x: 0, y: 0 },
      numbers: [
        { x: 1, y: 1, value: 3 },
        { x: 2, y: 2, value: 5 },
      ],
    },
    phases: [
      // Straight beam hits the 5 before the 3 — wrong order, flashes red.
      { startMs: 0, drawMs: 700, mirrors: [] },
      // Rerouted around the wrong-order hit: 3 first, then 5.
      {
        startMs: 1500,
        drawMs: 1800,
        mirrors: [
          { x: 1, y: 2, orientation: "/" },
          { x: 1, y: 0, orientation: "/" },
          { x: 2, y: 0, orientation: "\\" },
        ],
        easing: "linear",
      },
    ],
    taps: [{ atMs: 1300, cell: { x: 1, y: 2 } }],
  },
  {
    id: "advanced",
    title: "LASER RULES",
    caption:
      "Laser paths can cross, revisit squares, and pass through the source.",
    cellSize: 32,
    puzzle: {
      id: 9003,
      code: "",
      gridSize: 4,
      obstacles: [],
      source: { x: 0, y: 1, direction: "right" },
      flag: { x: 0, y: 0 },
      numbers: [],
    },
    phases: [
      {
        startMs: 0,
        drawMs: 3000,
        mirrors: [
          { x: 3, y: 1, orientation: "/" },
          { x: 3, y: 0, orientation: "\\" },
          { x: 2, y: 0, orientation: "/" },
          { x: 2, y: 2, orientation: "/" },
          { x: 0, y: 2, orientation: "\\" },
        ],
        easing: "linear",
        victory: true,
      },
    ],
  },
  {
    id: "finish",
    title: "REACH THE FLAG",
    caption: "Reach the flag only after collecting every number.",
    cellSize: 36,
    puzzle: {
      id: 9004,
      code: "7",
      gridSize: 3,
      obstacles: [],
      source: { x: 0, y: 2, direction: "up" },
      flag: { x: 0, y: 0 },
      numbers: [{ x: 1, y: 1, value: 7 }],
    },
    phases: [
      {
        startMs: 0,
        drawMs: 600,
        mirrors: [
          { x: 2, y: 1, orientation: "/" },
          { x: 2, y: 0, orientation: "\\" },
        ],
        flagIncorrectOnHold: true,
      },
      {
        startMs: 1500,
        drawMs: 1600,
        mirrors: [
          { x: 2, y: 1, orientation: "/" },
          { x: 2, y: 0, orientation: "\\" },
          { x: 0, y: 1, orientation: "/" },
        ],
        victory: true,
      },
    ],
    taps: [{ atMs: 1300, cell: { x: 0, y: 1 } }],
  },
];
