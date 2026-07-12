import type { MirrorPlacement, Position, Puzzle } from "@/lib/puzzleTypes";
import { calculateLaserPath } from "@/lib/laserEngine";

export type HintType = "fix" | "place" | "remove";

export interface HintAction {
  type: HintType;
  /**
   * For "fix" and "place": the solution mirror (target cell + orientation).
   * For "remove": the player's extra mirror to take off the board.
   */
  mirror: MirrorPlacement;
}

function cellKey(pos: { x: number; y: number }): string {
  return `${pos.x},${pos.y}`;
}

function firstVisitIndex(visitedCells: Position[]): Map<string, number> {
  const index = new Map<string, number>();
  visitedCells.forEach((cell, i) => {
    const key = cellKey(cell);
    if (!index.has(key)) index.set(key, i);
  });
  return index;
}

/**
 * One step from the player's board toward the canonical solution, or null when
 * the board already matches it exactly. Priority:
 *   1. fix    — a player mirror on a solution cell with the wrong orientation
 *               (in solution-beam order);
 *   2. place  — the first missing solution mirror, ordered by when the solved
 *               beam first reaches its cell (every minimal-witness mirror lies
 *               on the solved path by construction);
 *   3. remove — an extra player mirror not in the solution, preferring ones on
 *               the player's current beam path.
 * Each step reduces (wrong + missing + extra) by exactly one, so repeated
 * hints always converge to the solved board.
 */
export function getNextHint(
  puzzle: Puzzle,
  solutionMirrors: MirrorPlacement[],
  playerMirrors: MirrorPlacement[]
): HintAction | null {
  const playerByCell = new Map(playerMirrors.map((m) => [cellKey(m), m]));
  const solutionCells = new Set(solutionMirrors.map((m) => cellKey(m)));

  const solvedVisit = firstVisitIndex(
    calculateLaserPath(puzzle, solutionMirrors).visitedCells
  );
  const ordered = [...solutionMirrors].sort(
    (a, b) =>
      (solvedVisit.get(cellKey(a)) ?? Infinity) -
      (solvedVisit.get(cellKey(b)) ?? Infinity)
  );

  for (const mirror of ordered) {
    const placed = playerByCell.get(cellKey(mirror));
    if (placed && placed.orientation !== mirror.orientation) {
      return { type: "fix", mirror };
    }
  }

  for (const mirror of ordered) {
    if (!playerByCell.has(cellKey(mirror))) {
      return { type: "place", mirror };
    }
  }

  const extras = playerMirrors.filter((m) => !solutionCells.has(cellKey(m)));
  if (extras.length > 0) {
    const playerVisit = firstVisitIndex(
      calculateLaserPath(puzzle, playerMirrors).visitedCells
    );
    const sorted = [...extras].sort(
      (a, b) =>
        (playerVisit.get(cellKey(a)) ?? Infinity) -
        (playerVisit.get(cellKey(b)) ?? Infinity)
    );
    return { type: "remove", mirror: sorted[0] };
  }

  return null;
}

/** The player's mirrors after applying a hint action. */
export function applyHint(
  mirrors: MirrorPlacement[],
  hint: HintAction
): MirrorPlacement[] {
  const { mirror } = hint;
  if (hint.type === "remove") {
    return mirrors.filter((m) => !(m.x === mirror.x && m.y === mirror.y));
  }
  if (hint.type === "fix") {
    return mirrors.map((m) =>
      m.x === mirror.x && m.y === mirror.y
        ? { ...m, orientation: mirror.orientation }
        : m
    );
  }
  return [...mirrors, mirror];
}
