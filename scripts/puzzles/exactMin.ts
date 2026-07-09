/**
 * Exact min-mirror solver — beam-guided iterative-deepening branch & bound.
 *
 * The cheap grader (grader.ts) chooses k-of-N empty cells and blows past its
 * combinatorial budget at k≈4 on big grids, so it can only prove weak lower
 * bounds. This solver instead simulates the REAL laser and branches only at the
 * FIRST undecided empty cell the beam reaches: leave it straight (free) or drop a
 * "/" or "\\" mirror (cost 1). Deepening by a mirror budget K = 1, 2, 3, … the
 * first K that yields a valid solve is the exact minimum. A minimal solution
 * never contains an off-path mirror, so restricting placements to cells the beam
 * actually visits is complete.
 *
 * It is exponential in the worst case, so the search is bounded three ways, any
 * of which can stop it: a mirror-budget ceiling (`maxBudget`), a wall-clock
 * deadline (`deadlineMs`), and an optional node cap (`nodeCap`). Because the
 * outer loop deepens by whole budget levels, a run is RESUMABLE at budget
 * granularity (`startBudget = provenNoSolutionUpTo + 1`), so nightly jobs
 * accumulate progress instead of restarting. On any early stop it returns the
 * strongest lower bound it fully proved.
 *
 * PERFORMANCE (rewritten for speed; search semantics unchanged):
 *   - The board, cell decisions, and beam walk use flat typed arrays and integer
 *     cell indices — no per-node board rebuild, string keys, or allocations.
 *   - Each node resumes the beam from its parent's branch cell instead of
 *     re-tracing from the source: the prefix (position, direction, code index,
 *     step count at the branch cell) is saved on the recursion stack, and only
 *     the changed suffix is re-simulated.
 *   - When the mirror budget is exhausted, a node that still needs a decision is
 *     pruned immediately: committing "straight" never alters the beam, so the
 *     path can no longer change and the remaining straight-commit chain is
 *     provably dead. (This collapses the long unary tails of the search tree.)
 *
 * ACCURACY: identical proof semantics to the original solver — same branch
 * order, same locked-prefix pruning, same completion rule (collected sequence
 * exactly equals the code AND the flag is reached). As a belt-and-braces check,
 * every witnessing solution is re-validated with the real game engine
 * (calculateLaserPath + validateSequence) before being returned; a mismatch
 * throws instead of reporting a wrong minimum.
 */

import type {
  MirrorOrientation,
  MirrorPlacement,
  Puzzle,
} from "../../src/lib/puzzleTypes";
import { calculateLaserPath } from "../../src/lib/laserEngine";
import { validateSequence } from "../../src/lib/validation";
import { emptyCells } from "./grader";

export interface ExactMinResult {
  /** Exact minimum mirror count, when the search found and proved one. */
  minMirrors?: number;
  /** Proven lower bound (no solution with fewer), when no exact min was found. */
  minMirrorsAtLeast?: number;
  /** A witnessing solution for `minMirrors`. */
  solution?: MirrorPlacement[];
  /** Nodes (beam simulations) explored this call. */
  nodes: number;
  /**
   * Highest mirror budget searched to full exhaustion with no solution. The next
   * run should resume at `provenNoSolutionUpTo + 1`.
   */
  provenNoSolutionUpTo: number;
  /** True when the result is a complete proof (solved, or exhausted to maxBudget). */
  proven: boolean;
  /** True when the deadline or node cap cut the search short. */
  aborted: boolean;
}

export interface ExactMinOptions {
  /** Largest mirror count to try (ceiling on the answer). Default 16. */
  maxBudget?: number;
  /** Resume point: first budget level to search. Default 1. */
  startBudget?: number;
  /** Absolute epoch-ms wall-clock deadline; the search stops once reached. */
  deadlineMs?: number;
  /** Optional node cap; the search stops once reached. */
  nodeCap?: number;
}

const DEFAULT_MAX_BUDGET = 16;
const DEADLINE_CHECK_MASK = 0x1fff; // check the clock every ~8192 nodes

// Cell types on the flat board.
const T_EMPTY = 0;
const T_OBSTACLE = 1;
const T_NUMBER = 2;
const T_SOURCE = 3;
const T_FLAG = 4;

// Decisions on empty cells.
const D_NONE = 0;
const D_SLASH = 1;
const D_BACKSLASH = 2;
const D_STRAIGHT = 3;

// Directions: 0=right, 1=left, 2=up, 3=down (matches laserEngine's vectors).
const DIR_CODE: Record<string, number> = { right: 0, left: 1, up: 2, down: 3 };
const DX = [1, -1, 0, 0];
const DY = [0, 0, -1, 1];
// reflectDirection parity: "/" right→up, left→down, up→right, down→left.
const REFLECT_SLASH = [2, 3, 0, 1];
// "\\" right→down, left→up, up→left, down→right.
const REFLECT_BACKSLASH = [3, 2, 1, 0];

// walk() outcomes.
const W_SOLVED = 0; // full path collects the exact code and reaches the flag
const W_DEAD = 1; // locked-prefix digit mismatch, or no undecided cell left
const W_BRANCH = 2; // undecided empty cell found; branch state saved

export function solveExactMin(
  puzzle: Puzzle,
  options: ExactMinOptions = {}
): ExactMinResult {
  const maxBudget = options.maxBudget ?? DEFAULT_MAX_BUDGET;
  const startBudget = Math.max(1, options.startBudget ?? 1);
  const deadlineMs = options.deadlineMs;
  const nodeCap = options.nodeCap ?? Infinity;

  const size = puzzle.gridSize;
  const cellCount = size * size;
  const maxSteps = cellCount * 4; // same beam-loop guard as calculateLaserPath

  // Flat board (same precedence as buildBoard: obstacles, numbers, source, flag).
  const cellType = new Int8Array(cellCount); // T_EMPTY by default
  const cellDigit = new Int8Array(cellCount);
  for (const o of puzzle.obstacles) cellType[o.y * size + o.x] = T_OBSTACLE;
  for (const n of puzzle.numbers) {
    cellType[n.y * size + n.x] = T_NUMBER;
    cellDigit[n.y * size + n.x] = n.value;
  }
  cellType[puzzle.source.y * size + puzzle.source.x] = T_SOURCE;
  cellType[puzzle.flag.y * size + puzzle.flag.x] = T_FLAG;

  // Legal mirror cells, from the same source of truth as before (grader).
  const isEmpty = new Uint8Array(cellCount);
  for (const c of emptyCells(puzzle)) isEmpty[c.y * size + c.x] = 1;

  const codeDigits = Int8Array.from(puzzle.code, Number);
  const codeLen = codeDigits.length;

  const startX = puzzle.source.x;
  const startY = puzzle.source.y;
  const startDir = DIR_CODE[puzzle.source.direction];

  // Committed cell states for the current DFS path.
  const decision = new Int8Array(cellCount);

  let nodes = 0;
  let aborted = false;
  let found: MirrorPlacement[] | null = null;

  // Branch state produced by walk(): the beam's arrival state at the first
  // undecided empty cell. Scalars (not an object) to avoid per-node allocation.
  let bCell = 0;
  let bX = 0;
  let bY = 0;
  let bDir = 0;
  let bCodeIndex = 0;
  let bSteps = 0;

  /**
   * Trace the beam from an arrival state until it terminates, replicating
   * calculateLaserPath + validateSequence + the branch/prune walk in one pass:
   *   - a digit out of Target Code order before any undecided cell kills the
   *     node (that locked prefix can't be undone downstream);
   *   - the first undecided empty cell is recorded as the branch point;
   *   - a path that collects exactly the code then reaches the flag is a solve
   *     (checked on the full path, exactly like the original's isComplete-first
   *     ordering — even when an undecided cell sits earlier on the path).
   */
  const walk = (
    x: number,
    y: number,
    dir: number,
    codeIndex: number,
    steps: number
  ): number => {
    let branchFound = false;
    while (steps < maxSteps) {
      steps++;
      const idx = y * size + x;
      const t = cellType[idx];

      if (t === T_NUMBER) {
        if (codeIndex < codeLen && cellDigit[idx] === codeDigits[codeIndex]) {
          codeIndex++;
        } else if (!branchFound) {
          return W_DEAD; // locked-prefix mismatch
        } else {
          return W_BRANCH; // sequence broken → can't solve; branch already known
        }
      } else if (t === T_FLAG) {
        if (codeIndex === codeLen && codeLen > 0) return W_SOLVED;
        return branchFound ? W_BRANCH : W_DEAD;
      } else if (t === T_EMPTY) {
        const d = decision[idx];
        if (d === D_SLASH) {
          dir = REFLECT_SLASH[dir];
        } else if (d === D_BACKSLASH) {
          dir = REFLECT_BACKSLASH[dir];
        } else if (d === D_NONE && !branchFound && isEmpty[idx]) {
          branchFound = true;
          bCell = idx;
          bX = x;
          bY = y;
          bDir = dir;
          bCodeIndex = codeIndex;
          bSteps = steps - 1; // arrival state: before this cell was visited
        }
        // D_STRAIGHT (and undecided cells past the branch) pass through.
      }
      // T_SOURCE passes through.

      const nx = x + DX[dir];
      const ny = y + DY[dir];
      if (nx < 0 || nx >= size || ny < 0 || ny >= size) break; // boundary
      if (cellType[ny * size + nx] === T_OBSTACLE) break;
      x = nx;
      y = ny;
    }
    // Beam ended (boundary, obstacle, or step guard) without solving.
    return branchFound ? W_BRANCH : W_DEAD;
  };

  const collectMirrors = (): MirrorPlacement[] => {
    const out: MirrorPlacement[] = [];
    for (let idx = 0; idx < cellCount; idx++) {
      if (decision[idx] === D_SLASH || decision[idx] === D_BACKSLASH) {
        out.push({
          x: idx % size,
          y: Math.floor(idx / size),
          orientation: decision[idx] === D_SLASH ? "/" : ("\\" as MirrorOrientation),
        });
      }
    }
    return out;
  };

  /** Re-check a found witness with the real engine; a solver bug must not ship. */
  const verifyWitness = (mirrors: MirrorPlacement[]): void => {
    const laser = calculateLaserPath(puzzle, mirrors);
    if (!validateSequence(puzzle.code, laser).isComplete) {
      throw new Error(
        `exactMin internal error: witness for puzzle ${puzzle.id} failed real-engine validation`
      );
    }
  };

  const dfs = (
    x: number,
    y: number,
    dir: number,
    codeIndex: number,
    steps: number,
    mirrorCount: number,
    budget: number
  ): boolean => {
    nodes++;
    if (nodes >= nodeCap) {
      aborted = true;
      return false;
    }
    if (
      deadlineMs !== undefined &&
      (nodes & DEADLINE_CHECK_MASK) === 0 &&
      Date.now() >= deadlineMs
    ) {
      aborted = true;
      return false;
    }

    const outcome = walk(x, y, dir, codeIndex, steps);
    if (outcome === W_SOLVED) {
      const mirrors = collectMirrors();
      verifyWitness(mirrors);
      found = mirrors;
      return true;
    }
    if (outcome === W_DEAD) return false;

    // W_BRANCH. With no budget left, committing "straight" can never alter the
    // beam, so the path is frozen and unsolved — the whole tail is dead.
    if (mirrorCount >= budget) return false;

    // Save the branch state locally: recursion below overwrites the b* scalars.
    const cell = bCell;
    const rx = bX;
    const ry = bY;
    const rdir = bDir;
    const rci = bCodeIndex;
    const rsteps = bSteps;

    // Prefer dropping a mirror (both orientations) before committing to straight.
    decision[cell] = D_SLASH;
    if (dfs(rx, ry, rdir, rci, rsteps, mirrorCount + 1, budget)) return true;
    if (aborted) {
      decision[cell] = D_NONE;
      return false;
    }
    decision[cell] = D_BACKSLASH;
    if (dfs(rx, ry, rdir, rci, rsteps, mirrorCount + 1, budget)) return true;
    if (aborted) {
      decision[cell] = D_NONE;
      return false;
    }
    decision[cell] = D_STRAIGHT;
    if (dfs(rx, ry, rdir, rci, rsteps, mirrorCount, budget)) return true;
    decision[cell] = D_NONE;
    return false;
  };

  let provenNoSolutionUpTo = startBudget - 1; // levels below the resume point assumed proven
  for (let budget = startBudget; budget <= maxBudget; budget++) {
    decision.fill(D_NONE);
    found = null;
    aborted = false;

    if (dfs(startX, startY, startDir, 0, 0, 0, budget)) {
      return {
        minMirrors: found!.length,
        solution: found!,
        nodes,
        provenNoSolutionUpTo,
        proven: true,
        aborted: false,
      };
    }
    if (aborted) {
      // This budget was cut short; the strongest proof remains the prior level.
      return {
        minMirrorsAtLeast: provenNoSolutionUpTo + 1,
        nodes,
        provenNoSolutionUpTo,
        proven: false,
        aborted: true,
      };
    }
    provenNoSolutionUpTo = budget;
  }

  // Exhausted every budget up to maxBudget with no solution — a proven bound.
  return {
    minMirrorsAtLeast: maxBudget + 1,
    nodes,
    provenNoSolutionUpTo,
    proven: true,
    aborted: false,
  };
}
