import type { MirrorPlacement, Position, Puzzle } from "@/lib/puzzleTypes";

export interface TutorialTap {
  /** Loop-relative time at which the tap ripple fires. */
  atMs: number;
  cell: Position;
}

/**
 * One beam pass within a demo loop. A scenario with two phases first draws
 * the phase-1 beam (e.g. straight, mirror-less), holds it, then switches to
 * the phase-2 mirror set and redraws, showing cause and effect.
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
export const TUTORIAL_DESKTOP_CELL_SCALE = 1.3;

/** The bespoke tap-to-place demo (no puzzle or laser, see MirrorCycleDemo). */
export const MIRROR_CYCLE_SECTION = {
  title: "PLACE MIRRORS",
  caption: "Tap to place, tap again to rotate, tap a third time to remove.",
  cellSize: 37,
  gridSize: 3,
  /** The mirror state changes this long after each tap ripple starts. */
  stateDelayMs: 120,
  // Timed to the shared loop: early beat, corrective tap at 1300 (same as the
  // other demos), then a third place during their phase-2 draw window.
  taps: [
    { atMs: 400, cell: { x: 1, y: 0 } as Position, orientation: "/" as const },
    { atMs: 1300, cell: { x: 0, y: 2 } as Position, orientation: "\\" as const },
    { atMs: 2500, cell: { x: 2, y: 1 } as Position, orientation: "/" as const },
  ],
} as const;

export const TUTORIAL_SCENARIOS: TutorialScenario[] = [
  {
    id: "collect",
    title: "COLLECT THE CODE",
    caption: "Numbers must be collected in order.",
    cellSize: 37,
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
      // Straight beam hits the 5 before the 3, wrong order, flashes red.
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
    id: "finish",
    title: "REACH THE FLAG",
    caption: "Don't hit the flag until the code is complete.",
    cellSize: 37,
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
