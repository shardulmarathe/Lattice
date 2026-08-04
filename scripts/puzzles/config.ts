/**
 * Generation profile: every daily puzzle is "extra hard".
 *
 * Difficulty is driven by MIRROR DENSITY, the intended solution uses ~1/3 of the
 * grid as mirrors (anchor: a 5×5 wants ~8 mirrors). Grid size and code length are
 * randomized per day. The objective min-mirror solver (grader.ts) stays as an
 * anti-triviality floor: it proves no cheap shortcut exists up to an affordable cap.
 */

export const GRID_MIN = 4;
export const GRID_MAX = 8;
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
 * count is below this. This is the real difficulty signal, constructed mirror
 * density is decorative, because the player only has to route to the numbers +
 * flag in order, and a dense construction almost always hides a far cheaper true
 * solution (the naive anti-triviality grader can only rule out shortcuts up to a
 * ~3-mirror cap on large grids). Gating on the exact min (via the fast beam-guided
 * solver) is the only reliable knob. Small grids physically can't require this
 * many mirrors, so generation self-selects large, genuinely-hard boards. Matches
 * the harder curated puzzles (#16 = 12, #22 = 12).
 *
 * This is now an ANTI-TRIVIALITY floor, not the primary difficulty signal, craft is
 * (see CRAFT_REUSE_WEIGHT / minCraft). Deliberately LOWER than the count-era value of
 * 12: mirror reuse does double duty and thus *lowers* the mirror count, so a floor of
 * 12 rejected exactly the craftiest boards. Difficulty comes from the non-obvious
 * path, not the tally, so we only require enough mirrors to rule out trivial boards
 * and let the craft gate carry the rest.
 */
export const MIN_EXACT_MIRRORS = 9;

/**
 * Best-of-N selection: within a grid size, keep generating until this many
 * candidates clear the difficulty floor, then ship the one with the highest PROVEN
 * exact minimum (ties prefer a proven witness for day-one HINT support). Turns the
 * gate from "first board hard enough" into "hardest of several", so a raised floor
 * isn't needed to lift the typical difficulty, and well-placed obstacles finally
 * translate end-to-end into harder shipped puzzles. Cost scales roughly linearly
 * with N (each passing candidate pays a full exact-min solve); 1 restores the old
 * first-past-the-floor behavior.
 */
export const BEST_OF_N = 6;

/**
 * Craft, the REAL difficulty signal, measured on the MINIMAL (player-facing)
 * solution rather than on the constructed scaffold. Mirror count alone is a poor
 * proxy: a 14-mirror serpentine sweep is tedious, not hard. Difficulty comes from a
 * non-obvious path, the beam crossing itself, and a single mirror doing double duty
 * (struck from two directions, so its one placement must serve two beam segments at
 * once). We score both and (a) reject solutions below a floor and (b) make best-of-N
 * ship the CRAFTIEST candidate, not merely the one with the most mirrors.
 *
 * craft = reuse·CRAFT_REUSE_WEIGHT + crossings, where `reuse` = mirrors the beam
 * strikes from ≥2 distinct directions and `crossings` = empty cells the beam passes
 * through ≥2 times. Reuse is weighted higher, it's the harder constraint to see.
 */
export const CRAFT_REUSE_WEIGHT = 2;

/**
 * Soft craft floor on the minimal solution, scaled by grid size (bigger boards can
 * sustain more craft). Kept low so yield stays healthy, best-of-N ranking, not this
 * floor, is what lifts the typical craft. Only proven candidates (with a witness to
 * measure) are craft-gated; rare node-capped fallbacks skip it and rank last.
 */
export function minCraft(gridSize: number): number {
  return gridSize >= 8 ? 4 : gridSize >= 6 ? 3 : 2;
}

/**
 * Rigidity, how forced the solve is. A board with ONE minimal solution makes every
 * mirror placement mandatory (brutal); one with many is forgiving, because the player
 * only has to stumble on any of them. We count minimal solutions up to this cap (all
 * that "few vs many" ranking needs) and fold "cap − count" into the difficulty score,
 * so a near-unique board outranks a same-craft board with lots of solutions. This
 * partly offsets the multiplicity that the lower mirror floor introduced.
 */
export const SOLUTION_COUNT_CAP = 8;
/** Weight of each "missing" solution below the cap in the composite difficulty score. */
export const RIGIDITY_WEIGHT = 1;

/**
 * Ordering-inversion weight. The numbers must be collected in code order; if their
 * spatial layout runs COUNTER to the source→flag flow, the beam has to weave back on
 * itself to hit them in sequence rather than trace a clean sweep. We count how many
 * number pairs are spatially out of collection order and add a small per-inversion
 * bonus to the difficulty score, a tiebreaker that favors weaving layouts.
 */
export const INVERSION_WEIGHT = 0.5;
/** Deterministic node cap for the solution enumeration (proving uniqueness is the costly case). */
export const COUNT_MIN_OPTIONS = { nodeCap: 30_000_000 } as const;

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

  // Code length is deliberately NOT a difficulty lever and NOT tied to grid size -
  // difficulty comes from path craft, not from more digits to route. Keep it a short,
  // grid-independent band (4–6), capped only by the number slots the board can host.
  // Fewer, order-constrained numbers on a big grid is fine and often harder to route.
  const spaceCap = Math.max(CODE_MIN, area - targetMirrors - obstacleCount - 3);
  const hi = Math.min(CODE_MIN + 2, spaceCap);
  const codeLength = rng.int(CODE_MIN, Math.max(CODE_MIN, hi));

  return { gridSize, codeLength, targetMirrors, minMirrorCount, obstacleCount };
}
