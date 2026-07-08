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
 * It is exponential in the worst case, so both a mirror budget and a node cap
 * bound the run. On a cap-out it still returns the strongest lower bound it fully
 * proved (highest budget searched to exhaustion, + 1).
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
  /** Nodes (beam simulations) explored. */
  nodes: number;
  /** False when the node cap cut the search short (result is a bound, not proof). */
  proven: boolean;
}

export interface ExactMinOptions {
  /** Largest mirror count to try. */
  maxBudget?: number;
  /** Abort guard: stop after this many beam simulations. */
  nodeCap?: number;
}

const DEFAULT_MAX_BUDGET = 16;
const DEFAULT_NODE_CAP = 15_000_000;

const key = (x: number, y: number): string => `${x},${y}`;

export function solveExactMin(
  puzzle: Puzzle,
  options: ExactMinOptions = {}
): ExactMinResult {
  const maxBudget = options.maxBudget ?? DEFAULT_MAX_BUDGET;
  const nodeCap = options.nodeCap ?? DEFAULT_NODE_CAP;

  const emptySet = new Set(emptyCells(puzzle).map((c) => key(c.x, c.y)));
  const numberAt = new Map(
    puzzle.numbers.map((n) => [key(n.x, n.y), n.value] as const)
  );

  // Committed cell states: "/" and "\\" are mirrors; "-" is committed-straight.
  const decisions = new Map<string, MirrorOrientation | "-">();

  let nodes = 0;
  let aborted = false;
  let found: MirrorPlacement[] | null = null;

  const mirrorList = (): MirrorPlacement[] => {
    const out: MirrorPlacement[] = [];
    for (const [k, v] of decisions) {
      if (v === "-") continue;
      const [x, y] = k.split(",").map(Number);
      out.push({ x, y, orientation: v });
    }
    return out;
  };

  const dfs = (mirrorCount: number, budget: number): boolean => {
    if (found) return true;
    if (nodes >= nodeCap) {
      aborted = true;
      return false;
    }
    nodes++;

    const mirrors = mirrorList();
    const laser = calculateLaserPath(puzzle, mirrors);

    if (validateSequence(puzzle.code, laser).isComplete) {
      found = mirrors;
      return true;
    }

    // Walk the beam: confirm the locked prefix only collects in-order digits, and
    // find the first undecided empty cell to branch on.
    let codeIndex = 0;
    let branch: string | null = null;
    for (const cell of laser.visitedCells) {
      const k = key(cell.x, cell.y);
      const digit = numberAt.get(k);
      if (digit !== undefined) {
        // Number cells are always pass-through and can never hold a mirror.
        if (branch === null) {
          // Locked prefix: an out-of-order digit here can't be undone downstream.
          if (
            codeIndex >= puzzle.code.length ||
            digit !== Number(puzzle.code[codeIndex])
          ) {
            return false;
          }
          codeIndex++;
        }
        continue;
      }
      if (emptySet.has(k) && !decisions.has(k)) {
        branch = k;
        break;
      }
    }

    if (branch === null) return false; // nothing left to decide and not solved → dead

    // Prefer dropping a mirror (both orientations) before committing to straight.
    if (mirrorCount < budget) {
      for (const orientation of ["/", "\\"] as MirrorOrientation[]) {
        decisions.set(branch, orientation);
        if (dfs(mirrorCount + 1, budget)) return true;
        if (aborted) return false;
      }
    }
    decisions.set(branch, "-");
    if (dfs(mirrorCount, budget)) return true;
    decisions.delete(branch);
    return false;
  };

  let provenNoSolutionUpTo = 0; // highest budget searched to exhaustion, no solution
  for (let budget = 1; budget <= maxBudget; budget++) {
    decisions.clear();
    found = null;
    aborted = false;

    if (dfs(0, budget)) {
      return { minMirrors: found!.length, solution: found!, nodes, proven: true };
    }
    if (aborted) {
      // Budget `budget` was cut short; the strongest proof is the prior budget.
      return {
        minMirrorsAtLeast: provenNoSolutionUpTo + 1,
        nodes,
        proven: false,
      };
    }
    provenNoSolutionUpTo = budget;
  }

  // Exhausted every budget up to maxBudget with no solution — a proven bound.
  return { minMirrorsAtLeast: maxBudget + 1, nodes, proven: true };
}
