/**
 * Objective difficulty grading.
 *
 * The min-mirror solver brute-forces mirror placements using the REAL engine
 * (crossing/revisit allowed) and the REAL win check, up to an affordable cap
 * (config.solverCap). It's the anti-triviality floor: it proves a puzzle has no
 * solution with `cap` or fewer mirrors. Perceived difficulty is driven by mirror
 * density (the intended solution's size), reported here as `mirrorDensity`.
 */

import type { MirrorPlacement, Position, Puzzle } from "../../src/lib/puzzleTypes";
import { buildBoard, calculateLaserPath } from "../../src/lib/laserEngine";
import { validateSequence } from "../../src/lib/validation";
import { solverCap } from "./config";

export interface GradeOptions {
  /** Representative solution for path/density metrics (e.g. the generator's own). */
  fallbackSolution?: MirrorPlacement[];
  /**
   * Cap the mirror search at this count. The generator passes
   * `intendedSolution - 1` so the solver hunts only for a CHEAPER shortcut, not
   * the intended dense solution itself. Defaults to the affordable solver cap.
   */
  maxMirrors?: number;
}

export interface GradeResult {
  /** Smallest solvable mirror count found, or cap+1 meaning "more than the cap". */
  minMirrors: number;
  /** The cap the solver actually searched to. */
  cap: number;
  /** True if a solution was found within the cap (i.e. minMirrors <= cap). */
  solvableWithinCap: boolean;
  /** Visited-cell count of a representative solution path (null if none known). */
  pathLength: number | null;
  /** Obstacles orthogonally adjacent to the representative solution path. */
  obstacleInterference: number;
  /** Representative solution mirrors as a fraction of grid area. */
  mirrorDensity: number | null;
  /** Weighted heuristic difficulty score. */
  score: number;
}

const ORIENTATIONS = ["/", "\\"] as const;

/** Every empty cell — the only legal mirror positions. */
export function emptyCells(puzzle: Puzzle): Position[] {
  const board = buildBoard(puzzle, []);
  const cells: Position[] = [];
  for (let y = 0; y < puzzle.gridSize; y++) {
    for (let x = 0; x < puzzle.gridSize; x++) {
      if (board[y][x].type === "empty") cells.push({ x, y });
    }
  }
  return cells;
}

function isSolution(puzzle: Puzzle, mirrors: MirrorPlacement[]): boolean {
  const result = calculateLaserPath(puzzle, mirrors);
  return validateSequence(puzzle.code, result).isComplete;
}

/** Search for a solution using exactly `k` mirrors. Returns it, or null. */
function solveWithExactly(
  puzzle: Puzzle,
  cells: Position[],
  k: number
): MirrorPlacement[] | null {
  const n = cells.length;
  const combo: number[] = new Array(k);

  const recurse = (start: number, depth: number): MirrorPlacement[] | null => {
    if (depth === k) {
      for (let mask = 0; mask < 1 << k; mask++) {
        const mirrors: MirrorPlacement[] = combo.map((cellIdx, i) => ({
          x: cells[cellIdx].x,
          y: cells[cellIdx].y,
          orientation: ORIENTATIONS[(mask >> i) & 1],
        }));
        if (isSolution(puzzle, mirrors)) return mirrors;
      }
      return null;
    }
    for (let i = start; i <= n - (k - depth); i++) {
      combo[depth] = i;
      const found = recurse(i + 1, depth + 1);
      if (found) return found;
    }
    return null;
  };

  return recurse(0, 0);
}

/**
 * Smallest number of mirrors that solves the puzzle, searching k = 0..cap.
 * Returns minMirrors = cap+1 (and null solution) if nothing solves within the cap.
 */
export function minMirrorSolve(
  puzzle: Puzzle,
  cells: Position[],
  cap: number
): { minMirrors: number; solution: MirrorPlacement[] | null } {
  for (let k = 0; k <= cap; k++) {
    const solution = solveWithExactly(puzzle, cells, k);
    if (solution) return { minMirrors: k, solution };
  }
  return { minMirrors: cap + 1, solution: null };
}

function countObstacleInterference(
  puzzle: Puzzle,
  visitedCells: Position[]
): number {
  const obstacleKeys = new Set(puzzle.obstacles.map((o) => `${o.x},${o.y}`));
  const visitedKeys = new Set(visitedCells.map((c) => `${c.x},${c.y}`));
  const neighbours = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];
  let count = 0;
  for (const key of visitedKeys) {
    const [x, y] = key.split(",").map(Number);
    for (const { dx, dy } of neighbours) {
      if (obstacleKeys.has(`${x + dx},${y + dy}`)) count++;
    }
  }
  return count;
}

/**
 * Grade a puzzle. `fallbackSolution` (e.g. the generator's own dense constructed
 * solution) supplies path/density metrics when minMirrors exceeds the solver cap.
 */
export function grade(puzzle: Puzzle, options: GradeOptions = {}): GradeResult {
  const cells = emptyCells(puzzle);
  const affordable = solverCap(cells.length);
  const cap =
    options.maxMirrors === undefined
      ? affordable
      : Math.max(0, Math.min(affordable, options.maxMirrors));
  const { minMirrors, solution } = minMirrorSolve(puzzle, cells, cap);
  const representative = solution ?? options.fallbackSolution ?? null;

  let pathLength: number | null = null;
  let obstacleInterference = 0;
  let mirrorDensity: number | null = null;
  const area = puzzle.gridSize * puzzle.gridSize;
  if (representative) {
    const result = calculateLaserPath(puzzle, representative);
    pathLength = result.visitedCells.length;
    obstacleInterference = countObstacleInterference(puzzle, result.visitedCells);
    mirrorDensity = representative.length / area;
  }

  const score =
    3 * minMirrors +
    puzzle.code.length +
    (mirrorDensity ? 20 * mirrorDensity : 0) +
    0.5 * obstacleInterference +
    puzzle.gridSize / 7;

  return {
    minMirrors,
    cap,
    solvableWithinCap: minMirrors <= cap,
    pathLength,
    obstacleInterference,
    mirrorDensity: mirrorDensity === null ? null : Math.round(mirrorDensity * 1000) / 1000,
    score: Math.round(score * 100) / 100,
  };
}
