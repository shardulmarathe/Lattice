/**
 * Generation profile: every daily puzzle is "extra hard".
 *
 * Difficulty is driven by MIRROR DENSITY — the intended solution uses ~1/3 of the
 * grid as mirrors (anchor: a 5×5 wants ~8 mirrors). Grid size and code length are
 * randomized per day. The objective min-mirror solver (grader.ts) stays as an
 * anti-triviality floor: it proves no cheap shortcut exists up to an affordable cap.
 */

export const GRID_MIN = 4;
export const GRID_MAX = 9;
export const CODE_MIN = 4;
export const CODE_MAX = 8;

/** Target mirrors as a fraction of grid area (8×8 → round(0.37·64) = 24). */
export const MIRROR_DENSITY = 0.37;
/** Minimum acceptable mirror fraction if the target can't quite be reached. */
export const MIRROR_DENSITY_FLOOR = 0.32;
/** Obstacles as a fraction of grid area. */
export const OBSTACLE_DENSITY = 0.06;

/** Min-mirror solver: search up to a cap whose exhaustive cost stays under this. */
export const SOLVER_BUDGET = 1_000_000;
export const SOLVER_CAP_MIN = 3;
export const SOLVER_CAP_MAX = 8;

/**
 * Difficulty floor: reject any generated daily whose PROVEN exact minimum mirror
 * count is below this. This is the real difficulty signal — constructed mirror
 * density is decorative, because the player only has to route to the numbers +
 * flag in order, and a dense construction almost always hides a far cheaper true
 * solution (the naive anti-triviality grader can only rule out shortcuts up to a
 * ~3-mirror cap on large grids). Gating on the exact min (via the fast beam-guided
 * solver) is the only reliable knob. Small grids physically can't require this
 * many mirrors, so generation self-selects large, genuinely-hard boards. Matches
 * the harder curated puzzles (#16 = 12, #22 = 12).
 */
export const MIN_EXACT_MIRRORS = 12;

/**
 * Exact-min search budget used BOTH as the generation-time difficulty gate and to
 * record the shipped minimum + HINT witness. maxBudget 24 covers the real 17-18
 * minimums that exist (#8, #17); nodeCap ~500M is ~20s worst case on the rewritten
 * solver (~30M nodes/sec). A candidate with a cheap true solution is proven (and
 * rejected) fast; only genuinely hard boards pay the full cost.
 */
export const EXACT_MIN_GEN_OPTIONS = { maxBudget: 24, nodeCap: 500_000_000 } as const;

export interface GenParams {
  gridSize: number;
  codeLength: number;
  /** Mirror count the constructed solution aims for. */
  targetMirrors: number;
  /** Reject if the constructed solution ends up sparser than this. */
  minMirrorCount: number;
  obstacleCount: number;
}

function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let i = 0; i < k; i++) result = (result * (n - i)) / (i + 1);
  return result;
}

/**
 * Largest mirror count k the solver can exhaustively search within SOLVER_BUDGET
 * given `emptyCount` candidate cells. Small grids get a high cap (fully vetted),
 * large grids fall back to the minimum cap.
 */
export function solverCap(emptyCount: number): number {
  let cap = SOLVER_CAP_MIN;
  const top = Math.min(emptyCount, SOLVER_CAP_MAX);
  for (let k = SOLVER_CAP_MIN; k <= top; k++) {
    if (binomial(emptyCount, k) * 2 ** k <= SOLVER_BUDGET) cap = k;
    else break;
  }
  return cap;
}

/** Roll feasible generation parameters for one puzzle at a fixed grid size. */
export function rollParams(
  rng: { int(min: number, max: number): number },
  gridSize: number
): GenParams {
  const area = gridSize * gridSize;

  const targetMirrors = Math.min(
    area - 4,
    Math.max(4, Math.round(MIRROR_DENSITY * area))
  );
  const minMirrorCount = Math.max(4, Math.round(MIRROR_DENSITY_FLOOR * area));
  const obstacleCount = Math.min(
    Math.round(OBSTACLE_DENSITY * area),
    Math.max(0, area - targetMirrors - CODE_MIN - 3)
  );

  // Code length scales with grid size so big grids never get a short (easy) code:
  // 4×4→4, 5×5→5, 6×6→6, 7×7→6, 8×8→7, 9×9→8. Randomize within a tight band.
  const proportional = Math.round(
    CODE_MIN + ((gridSize - GRID_MIN) * (CODE_MAX - CODE_MIN)) / (GRID_MAX - GRID_MIN)
  );
  const spaceCap = Math.max(CODE_MIN, area - targetMirrors - obstacleCount - 3);
  const hi = Math.min(CODE_MAX, proportional, spaceCap);
  const lo = Math.min(hi, Math.max(CODE_MIN, proportional - 1));
  const codeLength = rng.int(lo, hi);

  return { gridSize, codeLength, targetMirrors, minMirrorCount, obstacleCount };
}
