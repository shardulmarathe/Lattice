import type {
  LaserResult,
  MirrorPlacement,
  Position,
  ValidationResult,
} from "@/lib/puzzleTypes";
import { cellKey } from "@/lib/validation";
import { TUTORIAL_PUZZLE } from "./tutorialPuzzle";

export type IllegalCellType = "number" | "flag" | "source";
export type TutorialControl = "hint" | "reset";

export interface TutorialStepContext {
  mirrors: MirrorPlacement[];
  laserResult: LaserResult;
  validation: ValidationResult;
  correctPrefixLength: number;
  incorrectKeys: Set<string>;
  rotatedCells: Set<string>;
  removedCells: Set<string>;
  triedIllegal: Set<IllegalCellType>;
  usedHint: boolean;
  usedReset: boolean;
}

export interface TutorialStep {
  id: string;
  caption: string;
  pulse: Position[];
  allowCells: Position[];
  seedMirrors?: MirrorPlacement[];
  pulseControls?: TutorialControl[];
  allowHint?: boolean;
  allowReset?: boolean;
  advanceWhen: (ctx: TutorialStepContext) => boolean;
}

export const TUTORIAL_SOLUTION: MirrorPlacement[] = [
  { x: 1, y: 2, orientation: "/" },
  { x: 1, y: 0, orientation: "/" },
  { x: 3, y: 0, orientation: "\\" },
  { x: 3, y: 1, orientation: "/" },
  { x: 0, y: 1, orientation: "/" },
  { x: 0, y: 4, orientation: "\\" },
];

/** Wrong tilt on the first mirror: laser hits 4 before 3. */
export const TUTORIAL_ERROR_SEED: MirrorPlacement[] = [
  { x: 1, y: 2, orientation: "\\" },
];

const PRACTICE: Position = { x: 4, y: 2 };
const PRACTICE_KEY = cellKey(PRACTICE.x, PRACTICE.y);
const NUMBER_THREE = TUTORIAL_PUZZLE.numbers[0];
const M1: Position = { x: 1, y: 2 };
const M2: Position = { x: 1, y: 0 };
const M3: Position = { x: 3, y: 0 };
const M4: Position = { x: 3, y: 1 };
const M5: Position = { x: 0, y: 1 };
const M6: Position = { x: 0, y: 4 };

function hasMirrorAt(mirrors: MirrorPlacement[], x: number, y: number): boolean {
  return mirrors.some((m) => m.x === x && m.y === y);
}

function mirrorOrientation(
  mirrors: MirrorPlacement[],
  x: number,
  y: number
): "/" | "\\" | null {
  return mirrors.find((m) => m.x === x && m.y === y)?.orientation ?? null;
}

export function pathPassesThroughSource(laserResult: LaserResult): boolean {
  const { x, y } = TUTORIAL_PUZZLE.source;
  return laserResult.visitedCells.some(
    (cell, i) => i > 0 && cell.x === x && cell.y === y
  );
}

export function pathRevisitsCell(laserResult: LaserResult): boolean {
  const seen = new Set<string>();
  for (const cell of laserResult.visitedCells) {
    const key = cellKey(cell.x, cell.y);
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

export function pathCrossesAndThroughSource(laserResult: LaserResult): boolean {
  return pathRevisitsCell(laserResult) && pathPassesThroughSource(laserResult);
}

/** RESET vs HINT branching after the error beat. */
export const TUTORIAL_ERROR_STEP_ID = "error_hint_reset";
export const TUTORIAL_REBUILD_STEP_ID = "rebuild_first";
export const TUTORIAL_HIT_THREE_STEP_ID = "hit_three";

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "place",
    caption: "Tap the glowing square to place a mirror.",
    pulse: [PRACTICE],
    allowCells: [PRACTICE],
    seedMirrors: [],
    advanceWhen: (ctx) => hasMirrorAt(ctx.mirrors, PRACTICE.x, PRACTICE.y),
  },
  {
    id: "rotate",
    caption: "Tap the mirror again to rotate it.",
    pulse: [PRACTICE],
    allowCells: [PRACTICE],
    advanceWhen: (ctx) =>
      mirrorOrientation(ctx.mirrors, PRACTICE.x, PRACTICE.y) === "\\" ||
      ctx.rotatedCells.has(PRACTICE_KEY),
  },
  {
    id: "remove",
    caption: "Tap a third time to remove it.",
    pulse: [PRACTICE],
    allowCells: [PRACTICE],
    advanceWhen: (ctx) =>
      !hasMirrorAt(ctx.mirrors, PRACTICE.x, PRACTICE.y) ||
      ctx.removedCells.has(PRACTICE_KEY),
  },
  {
    id: "around_block",
    caption:
      "White blocks stop the laser. Place here to turn around the block.",
    pulse: [M1],
    allowCells: [M1],
    seedMirrors: [],
    advanceWhen: (ctx) => hasMirrorAt(ctx.mirrors, M1.x, M1.y),
  },
  {
    id: TUTORIAL_ERROR_STEP_ID,
    caption:
      "Wrong number order. That is a mistake. Follow the arrows: tap HINT to fix a mirror, or RESET to clear the board.",
    pulse: [],
    allowCells: [],
    seedMirrors: TUTORIAL_ERROR_SEED,
    pulseControls: ["hint", "reset"],
    allowHint: true,
    allowReset: true,
    advanceWhen: (ctx) => ctx.usedHint || ctx.usedReset,
  },
  {
    // RESET path only (HINT skips this step in TutorialScreen).
    id: TUTORIAL_REBUILD_STEP_ID,
    caption:
      "Board cleared. Place the first mirror again to turn around the block.",
    pulse: [M1],
    allowCells: [M1],
    seedMirrors: [],
    advanceWhen: (ctx) =>
      mirrorOrientation(ctx.mirrors, M1.x, M1.y) === "/",
  },
  {
    id: TUTORIAL_HIT_THREE_STEP_ID,
    caption: "Place here so the laser hits 3 first.",
    pulse: [M2],
    allowCells: [M2],
    // No seed: HINT keeps the fixed mirror; RESET already rebuilt M1.
    advanceWhen: (ctx) =>
      mirrorOrientation(ctx.mirrors, M1.x, M1.y) === "/" &&
      hasMirrorAt(ctx.mirrors, M2.x, M2.y) &&
      mirrorOrientation(ctx.mirrors, M2.x, M2.y) === "/" &&
      ctx.correctPrefixLength >= 1 &&
      ctx.incorrectKeys.size === 0,
  },
  {
    id: "illegal_number",
    caption:
      "1 sits under the 3. A turn on the 3 would collect it next. Try placing there.",
    pulse: [NUMBER_THREE],
    allowCells: [NUMBER_THREE],
    seedMirrors: [TUTORIAL_SOLUTION[0], TUTORIAL_SOLUTION[1]],
    advanceWhen: (ctx) => ctx.triedIllegal.has("number"),
  },
  {
    id: "beside_number",
    caption:
      "You cannot place on a number, so the route is longer. Place beside it, then rotate to turn down.",
    pulse: [M3],
    allowCells: [M3],
    seedMirrors: [TUTORIAL_SOLUTION[0], TUTORIAL_SOLUTION[1]],
    advanceWhen: (ctx) =>
      mirrorOrientation(ctx.mirrors, M3.x, M3.y) === "\\",
  },
  {
    id: "collect_one",
    caption: "Place here to collect 1 next.",
    pulse: [M4],
    allowCells: [M4],
    seedMirrors: [
      TUTORIAL_SOLUTION[0],
      TUTORIAL_SOLUTION[1],
      TUTORIAL_SOLUTION[2],
    ],
    advanceWhen: (ctx) =>
      hasMirrorAt(ctx.mirrors, M4.x, M4.y) &&
      ctx.correctPrefixLength >= 2 &&
      ctx.incorrectKeys.size === 0,
  },
  {
    id: "toward_source",
    caption:
      "Place here to send the laser back through the source. It passes through on its own (you cannot place on it) and hits 2.",
    pulse: [M5],
    allowCells: [M5],
    seedMirrors: [
      TUTORIAL_SOLUTION[0],
      TUTORIAL_SOLUTION[1],
      TUTORIAL_SOLUTION[2],
      TUTORIAL_SOLUTION[3],
    ],
    advanceWhen: (ctx) =>
      hasMirrorAt(ctx.mirrors, M5.x, M5.y) &&
      pathPassesThroughSource(ctx.laserResult) &&
      ctx.correctPrefixLength >= 3,
  },
  {
    id: "finish",
    caption:
      "Place below the 2, then rotate to collect 4 and the flag.",
    pulse: [M6],
    allowCells: [M6],
    seedMirrors: [
      TUTORIAL_SOLUTION[0],
      TUTORIAL_SOLUTION[1],
      TUTORIAL_SOLUTION[2],
      TUTORIAL_SOLUTION[3],
      TUTORIAL_SOLUTION[4],
    ],
    advanceWhen: (ctx) =>
      mirrorOrientation(ctx.mirrors, M6.x, M6.y) === "\\" &&
      ctx.validation.isComplete &&
      pathCrossesAndThroughSource(ctx.laserResult),
  },
];
