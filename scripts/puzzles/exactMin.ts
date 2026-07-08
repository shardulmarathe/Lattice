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
 * granularity — pass `startBudget = provenNoSolutionUpTo + 1` from a prior run to
 * skip levels already proven empty, so nightly jobs accumulate progress instead
 * of restarting. On any early stop it returns the strongest lower bound it fully
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

const key = (x: number, y: number): string => `${x},${y}`;

export function solveExactMin(
  puzzle: Puzzle,
  options: ExactMinOptions = {}
): ExactMinResult {
  const maxBudget = options.maxBudget ?? DEFAULT_MAX_BUDGET;
  const startBudget = Math.max(1, options.startBudget ?? 1);
  const deadlineMs = options.deadlineMs;
  const nodeCap = options.nodeCap ?? Infinity;

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

  let provenNoSolutionUpTo = startBudget - 1; // levels below the resume point assumed proven
  for (let budget = startBudget; budget <= maxBudget; budget++) {
    decisions.clear();
    found = null;
    aborted = false;

    if (dfs(0, budget)) {
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
